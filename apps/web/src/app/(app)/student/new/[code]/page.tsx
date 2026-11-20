'use client';

import {
  GENERAL_LIMITS, GENERAL_WANT_LABEL, LEVEL_LABEL, formDefaults, fullName, generalDefaults, generalFormSchema, getRequestType, validateForm,
  type FormData, type GeneralFormData, type GeneralWant, type PositionKey, type RequestDetail, type RequestSummary,
} from '@csis/shared';
import { ArrowLeft, Check, Eye, EyeOff, Minus, Plus, Send, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FormFields } from '@/components/FormFields';
import { FixedPreview, PreviewFrame } from '@/components/PreviewFrame';
import { Alert, Button, Card, Field, Input, Spinner, cx } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/me';
import { sheetsFor } from '@/sheets';

const WANTS: GeneralWant[] = ['student_cert', 'transcript', 'other'];

function NewRequestForm() {
  const { code } = useParams<{ code: string }>();
  const search = useSearchParams();
  const editId = search.get('edit');
  const topic = search.get('topic')?.slice(0, 60) ?? '';
  const router = useRouter();
  const { me } = useMe();
  const type = getRequestType(code);

  const isGeneral = type?.template === 'general';
  const [data, setData] = useState<FormData | null>(type?.ready && isGeneral ? ({ ...generalDefaults(type), ...(topic ? { wants: ['other'], other: topic } : {}) } as unknown as FormData) : null);
  const [returnedReason, setReturnedReason] = useState('');
  const [loadingEdit, setLoadingEdit] = useState(!!editId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  // 1 คีย์ต่อการเปิดฟอร์ม 1 ครั้ง: กดยื่นซ้ำ/เน็ตหลุดแล้วกดใหม่ ได้คำร้องใบเดิม ไม่ซ้ำ
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [openSame, setOpenSame] = useState<RequestSummary | null>(null);
  const [officials, setOfficials] = useState<Partial<Record<PositionKey, string>>>({});

  useEffect(() => {
    api.get<Partial<Record<PositionKey, string>>>('/requests/officials').then(setOfficials).catch(() => undefined);
    if (!editId) {
      api.get<RequestSummary[]>('/requests/mine')
        .then((mine) => setOpenSame(mine.find((r) => r.typeCode === code && (r.status === 'pending' || r.status === 'returned')) ?? null))
        .catch(() => undefined);
    }
  }, [code, editId]);

  // ฟอร์มเฉพาะ: ค่าตั้งต้นต้องรู้ภาคเรียนปัจจุบันและคาบที่ลงทะเบียน
  useEffect(() => {
    if (editId || !type?.ready || isGeneral || !me?.student) return;
    const student = me.student;
    api.get<{ current: { year: number; term: number }; registeredPeriods: number }>('/student/form-context')
      .then((ctx) => setData(formDefaults(type, { student, ...ctx })))
      .catch(() => setData(formDefaults(type, { student, current: { year: new Date().getFullYear() + 543, term: 1 } })));
  }, [editId, type, isGeneral, me?.student]);

  useEffect(() => {
    if (!editId) return;
    api.get<RequestDetail>(`/requests/${editId}`)
      .then((d) => {
        if (!d.can.edit) {
          router.replace(`/requests/${editId}`);
          return;
        }
        setData(d.data as FormData);
        const last = [...d.approvals].reverse().find((a) => a.decision === 'return');
        setReturnedReason(last?.comment ?? '');
      })
      .catch((e) => setServerError(errorMessage(e)))
      .finally(() => setLoadingEdit(false));
  }, [editId, router]);

  const student = me?.student;
  const parsed = useMemo(() => (data && isGeneral ? generalFormSchema.safeParse(data) : null), [data, isGeneral]);

  if (!type) return <Alert>ไม่พบประเภทคำร้อง {code}</Alert>;
  if (type.hidden && !editId) return <Alert tone="info">คำร้อง “{type.name}” ไม่มีแบบฟอร์มเฉพาะแล้ว ใช้ <Link href={`/student/new/D01?topic=${encodeURIComponent(type.name)}`} className="font-medium underline">แบบคำร้องทั่วไป (เรื่องอื่น ๆ)</Link> แทน</Alert>;
  if (!type.ready) return <Alert tone="info">คำร้อง “{type.name}” กำลังจัดทำแบบฟอร์มออนไลน์ ระหว่างนี้ยื่นแบบกระดาษที่งานทะเบียน</Alert>;
  if (!student) return <Alert tone="info">ยื่นคำร้องได้เฉพาะบัญชีนักศึกษา</Alert>;
  if (loadingEdit || !data) return <Spinner />;

  const g = data as unknown as GeneralFormData;
  const set = (patch: FormData) => {
    setData((d) => (d ? { ...d, ...patch } : d));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };
  const toggleWant = (w: GeneralWant) => set({ wants: g.wants.includes(w) ? g.wants.filter((x) => x !== w) : [...g.wants, w] });
  const needsCopies = isGeneral && g.wants.some((w) => w === 'student_cert' || w === 'transcript');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setServerError('');
    let clean: FormData;
    if (isGeneral) {
      const result = generalFormSchema.safeParse(data);
      if (!result.success) {
        const next: Record<string, string> = {};
        for (const issue of result.error.issues) next[String(issue.path[0] ?? '_')] ??= issue.message;
        setErrors(next);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      clean = result.data as unknown as FormData;
    } else {
      const result = validateForm(type!.template, data);
      if (!result.ok) {
        setErrors(result.errors);
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], .text-danger:not(:empty)')?.scrollIntoView({ block: 'center' }));
        return;
      }
      clean = result.data;
    }
    setBusy(true);
    try {
      if (editId) {
        await api.put(`/requests/${editId}`, { data: clean });
        router.replace(`/requests/${editId}?sent=1`);
      } else {
        const created = await api.post<{ id: string }>('/requests', { typeCode: type!.code, data: clean, idempotencyKey });
        router.replace(`/requests/${created.id}?sent=1`);
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setServerError(errorMessage(err));
      setBusy(false);
    }
  }

  const previewData = isGeneral ? (parsed?.success ? (parsed.data as unknown as FormData) : { ...data, other: g.other ?? '' }) : data;
  const preview = sheetsFor(type.template, { student, data: previewData, officials });

  return (
    // จอใหญ่: ทั้งหน้าสูงเท่าจอ (จอ − แถบเมนู − ขอบบนล่าง) ตัวหน้าไม่เลื่อน ฝั่งซ้ายเลื่อนเอง ฝั่งขวานิ่ง
    <div className="grid gap-6 xl:-mt-2 xl:-mb-4 xl:flex xl:h-[calc(100dvh-6.5rem-2px)] xl:flex-col xl:gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-8 xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-stretch">
        <form onSubmit={submit} noValidate className="grid content-start gap-5 xl:h-full xl:overflow-y-auto xl:overscroll-contain xl:pr-3 xl:pb-6">
          <div className="rise">
            <Link href="/student/requests" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden="true" /> กลับหน้าคำร้อง
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">{editId ? 'แก้ไขคำร้อง' : type.name}</h1>
            <p className="text-[15px] text-ink-muted">{isGeneral ? 'แบบคำร้องทั่วไป' : 'แบบฟอร์มของวิทยาลัย'} · รหัส {type.code} · แบบฟอร์มด้านขวาเปลี่ยนตามที่กรอกทันที</p>
          </div>

          {openSame && (
            <Alert tone="warn">
              คุณมีคำร้องเรื่องนี้ที่ยังดำเนินการอยู่ (<Link href={`/requests/${openSame.id}`} className="font-medium underline underline-offset-2">{openSame.requestNo}</Link>)
              ถ้าต้องการเพิ่มจำนวน ยื่นใบใหม่ได้ ไม่เช่นนั้นรอผลใบเดิมก่อน
            </Alert>
          )}
          {returnedReason && <Alert tone="warn"><strong className="font-semibold">เหตุผลที่ส่งกลับ:</strong> {returnedReason}</Alert>}

          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-semibold"><UserRound className="size-4 text-brand" aria-hidden="true" /> ข้อมูลจากทะเบียน</h2>
            <p className="text-sm text-ink-muted">ระบบกรอกให้อัตโนมัติ ไม่ต้องพิมพ์</p>
            <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[15px]">
              <dt className="text-ink-muted">ชื่อ</dt><dd className="font-medium">{fullName(student)}</dd>
              <dt className="text-ink-muted">รหัส</dt><dd className="tabular-nums">{student.studentCode}</dd>
              <dt className="text-ink-muted">หลักสูตร</dt><dd>{LEVEL_LABEL[student.level]} {student.program} ปี {student.yearLevel} กลุ่ม {student.groupNo}</dd>
              <dt className="text-ink-muted">แผนก</dt><dd>{student.department}</dd>
              <dt className="text-ink-muted">บิดา / มารดา</dt><dd>{student.fatherName || '–'} / {student.motherName || '–'}</dd>
            </dl>
            <p className="mt-3 text-sm text-ink-muted">ข้อมูลไม่ถูกต้อง? <Link href={`/student/new/D01?topic=${encodeURIComponent('ขอแก้ไขข้อมูลส่วนตัว')}`} className="text-brand underline underline-offset-2">ยื่นคำร้องขอแก้ไขข้อมูล</Link></p>
          </Card>

          {!isGeneral && <Card className="p-4 sm:p-5"><FormFields template={type.template} type={type} data={data} set={set} errors={errors} /></Card>}
          {isGeneral && <Card className="grid gap-5 p-4 sm:p-5">
            <fieldset className="grid gap-2" aria-describedby={errors.wants ? 'wants-error' : undefined}>
              <legend className="mb-1 text-[15px] font-medium">มีความประสงค์จะขอ</legend>
              {WANTS.map((w) => {
                const on = g.wants.includes(w);
                return (
                  <label key={w} className={cx('flex min-h-11 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-3 ring-1 transition-[box-shadow,background-color] duration-150', on ? 'bg-brand-soft ring-brand-border' : 'ring-line-strong hover:bg-sunken')}>
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggleWant(w)} aria-invalid={!!errors.wants} />
                    <span className={cx('grid size-5 place-items-center rounded-[5px] ring-1 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand', on ? 'bg-brand text-ink-inverse ring-brand' : 'bg-surface ring-line-strong')}>
                      {on && <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />}
                    </span>
                    {GENERAL_WANT_LABEL[w]}
                  </label>
                );
              })}
              <p id="wants-error" className="text-sm text-danger" aria-live="polite">{errors.wants}</p>
            </fieldset>

            {g.wants.includes('other') && (
              <Field label="เรื่องที่ขอ" error={errors.other} counter={`${g.other.length}/${GENERAL_LIMITS.other}`}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={g.other} maxLength={GENERAL_LIMITS.other} onChange={(e) => set({ other: e.target.value })} />}
              </Field>
            )}

            {needsCopies && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-medium" id="copies-label">จำนวนที่ขอ (ฉบับ)</span>
                <div className="flex items-center gap-1" role="group" aria-labelledby="copies-label">
                  <Button type="button" variant="secondary" className="w-11 px-0" aria-label="ลดจำนวน" disabled={g.copies <= 1} onClick={() => set({ copies: g.copies - 1 })} icon={<Minus className="size-4" aria-hidden="true" />} />
                  <output className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">{g.copies}</output>
                  <Button type="button" variant="secondary" className="w-11 px-0" aria-label="เพิ่มจำนวน" disabled={g.copies >= GENERAL_LIMITS.copies} onClick={() => set({ copies: g.copies + 1 })} icon={<Plus className="size-4" aria-hidden="true" />} />
                </div>
              </div>
            )}

            <Field label="สาเหตุที่ขอเพื่อ" error={errors.purpose} counter={`${g.purpose.length}/${GENERAL_LIMITS.purpose}`}>
              {({ id, describedBy, invalid }) => (
                <div className="grid gap-2">
                  <div className="flex flex-wrap gap-1.5" aria-label="เหตุผลที่ใช้บ่อย">
                    {type.purposes.map((p) => (
                      <button key={p} type="button" onClick={() => set({ purpose: p })} aria-pressed={g.purpose === p}
                        className={cx('min-h-9 rounded-full px-3 text-sm ring-1 transition-colors duration-100', g.purpose === p ? 'bg-brand text-ink-inverse ring-brand' : 'bg-surface ring-line-strong hover:bg-sunken')}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={g.purpose} maxLength={GENERAL_LIMITS.purpose} placeholder="หรือพิมพ์เอง" onChange={(e) => set({ purpose: e.target.value })} />
                </div>
              )}
            </Field>
          </Card>}

          {type.bring && <Alert tone="info"><strong className="font-semibold">{isGeneral ? 'เตรียมไปรับเอกสาร' : 'เอกสารที่ต้องเตรียม'}:</strong> {type.bring}</Alert>}
          {serverError && <Alert>{serverError}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={busy} icon={<Send className="size-4" aria-hidden="true" />} className="flex-1 sm:flex-none">
              {editId ? 'ส่งคำร้องอีกครั้ง' : 'ยื่นคำร้อง'}
            </Button>
            <Button type="button" variant="secondary" className="xl:hidden" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}
              icon={showPreview ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}>
              {showPreview ? 'ซ่อนแบบฟอร์ม' : 'ดูแบบฟอร์ม'}
            </Button>
          </div>
          {showPreview && <div className="xl:hidden"><PreviewFrame>{preview}</PreviewFrame></div>}
        </form>

        <aside className="hidden xl:flex xl:h-full xl:min-h-0 xl:flex-col" aria-label="ตัวอย่างแบบฟอร์ม">
          <FixedPreview>{preview}</FixedPreview>
        </aside>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><NewRequestForm /></Suspense>;
}
