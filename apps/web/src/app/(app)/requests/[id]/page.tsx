'use client';

import {
  STATUS_LABEL, WORKFLOWS, formatThaiDateTime, getRequestType,
  type Decision, type FormData, type RequestDetail, type TemplateKey,
} from '@csis/shared';
import { ArrowLeft, Check, CornerUpLeft, PencilLine, Printer, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { PreviewFrame } from '@/components/PreviewFrame';
import { Alert, Button, Card, Field, Spinner, StatusBadge, Textarea, cx } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/me';
import { sheetsFor } from '@/sheets';
import { useConfirm } from '@/components/feedback';

const sheetCount = (t: string) => (t === 'transfer' ? 2 : 1);
const QUICK_COMMENTS = ['ตรวจสอบแล้ว ข้อมูลถูกต้อง', 'เห็นควรอนุมัติ', 'เอกสารไม่ครบ'];
/** ความเห็นสำเร็จรูปตามหน้าที่ของแต่ละขั้น */
const STEP_COMMENTS: Record<string, string[]> = {
  library: ['ไม่มีหนี้สินค้างชำระ', 'ส่งคืนหนังสือครบถ้วน', 'ยังค้างส่งหนังสือ'],
  finance: ['ไม่มีหนี้สินค้างชำระ', 'ชำระเงินครบถ้วนแล้ว', 'ยังค้างชำระเงิน'],
  programHead: ['ส่งคืนอุปกรณ์ วัสดุ ครบถ้วนแล้ว', 'เห็นควรอนุมัติ'],
  discipline: ['ความประพฤติดี', 'เห็นควรออกหนังสือรับรอง'],
  director: ['อนุมัติ', 'อนุมัติ ดำเนินการได้'],
};

function Detail() {
  const ask = useConfirm();
  const { id } = useParams<{ id: string }>();
  const justSent = useSearchParams().get('sent') === '1';
  const { me } = useMe();
  const [d, setD] = useState<RequestDetail | null>(null);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [busy, setBusy] = useState<Decision | 'cancel' | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => api.get<RequestDetail>(`/requests/${id}`).then(setD).catch((e) => setError(errorMessage(e))), [id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <Alert>{error}</Alert>;
  if (!d) return <Spinner />;

  const type = getRequestType(d.typeCode);
  const steps = WORKFLOWS[(type?.template ?? 'general') as TemplateKey];
  const isFinal = d.currentStep === steps.length - 1;
  const current = d.approvals.filter((a) => a.round === d.round);
  const isOwner = me?.student?.studentCode === d.studentCode && !!me?.student;

  async function decide(decision: Decision) {
    if (decision !== 'approve' && comment.trim().length < 3) {
      setCommentError('ระบุเหตุผลให้นักศึกษาทราบ');
      document.getElementById('decision-comment')?.focus();
      return;
    }
    setBusy(decision);
    setNotice('');
    try {
      await api.post(`/requests/${id}/decision`, { decision, comment, expectedStep: d!.currentStep, expectedRound: d!.round });
      setComment('');
      setNotice(decision === 'approve' ? (isFinal ? 'อนุมัติคำร้องแล้ว' : 'บันทึกความเห็นแล้ว ส่งต่อขั้นถัดไป') : decision === 'return' ? 'ส่งกลับให้นักศึกษาแก้ไขแล้ว' : 'บันทึกไม่อนุมัติแล้ว');
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.fields.comment) setCommentError(e.fields.comment);
      else alertOnce(errorMessage(e));
      // 409 = มีคนพิจารณาไปก่อน: โหลดใหม่ให้เห็นสถานะล่าสุด
      await load();
    } finally {
      setBusy(null);
    }
  }

  function alertOnce(message: string) {
    setNotice(`⚠ ${message}`);
  }

  async function cancel() {
    if (!(await ask({ title: 'ยกเลิกคำร้องนี้?', message: 'ยกเลิกแล้วต้องยื่นใหม่ตั้งแต่ต้น', confirmLabel: 'ยกเลิกคำร้อง', cancelLabel: 'ไม่ยกเลิก', tone: 'danger' }))) return;
    setBusy('cancel');
    try {
      await api.post(`/requests/${id}/cancel`);
      await load();
    } catch (e) {
      alertOnce(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={isOwner ? '/student/requests' : '/staff'} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden="true" /> {isOwner ? 'คำร้องของฉัน' : 'รายการคำร้อง'}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{type?.name ?? d.typeCode}</h1>
            <StatusBadge status={d.status} />
          </div>
          <p className="text-[15px] text-ink-muted">
            เลขที่ <span className="tabular-nums font-medium text-ink">{d.requestNo}</span> · {d.studentName} (<span className="tabular-nums">{d.studentCode}</span>) · ยื่น {formatThaiDateTime(d.submittedAt)}
          </p>
        </div>
        {type?.template === 'transfer'
          ? <Link href={`/print/requests/${d.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-surface px-4 text-[15px] font-medium ring-1 ring-line-strong hover:bg-sunken"><Printer className="size-4" aria-hidden="true" />พิมพ์ / บันทึก PDF ({sheetCount(type.template)} แผ่น)</Link>
          : <Button variant="secondary" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>พิมพ์ / บันทึก PDF</Button>}
      </div>

      {justSent && d.status === 'pending' && d.currentStep === 0 && current.length === 0 && (
        <Alert tone="ok">ยื่นคำร้องเรียบร้อย เลขที่ {d.requestNo} ติดตามสถานะได้ที่หน้านี้ตลอดเวลา</Alert>
      )}
      {isOwner && d.status === 'approved' && (
        <Alert tone="ok">
          <strong className="font-semibold">อนุมัติแล้ว</strong> · ติดต่อรับเอกสารที่งานทะเบียนในวันและเวลาราชการ แจ้งเลขที่คำร้อง {d.requestNo}
          {type?.bring && <> และนำ{type.bring}มาด้วย</>}
        </Alert>
      )}
      {isOwner && d.status === 'rejected' && (
        <Alert tone="danger">
          <strong className="font-semibold">ไม่อนุมัติ</strong> · {[...d.approvals].reverse().find((a) => a.decision === 'reject')?.comment} — สอบถามเพิ่มเติมได้ที่งานทะเบียน
        </Alert>
      )}
      {notice && <Alert tone={notice.startsWith('⚠') ? 'danger' : 'ok'}>{notice.replace(/^⚠ /, '')}</Alert>}

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        <div className="grid gap-5">
          {d.status === 'returned' && (
            <Card className="grid gap-3 p-4 ring-warn/40 sm:p-5">
              <p className="font-semibold text-warn">ส่งกลับให้แก้ไข</p>
              <p className="text-[15px]">{[...d.approvals].reverse().find((a) => a.decision === 'return')?.comment}</p>
              {d.can.edit && (
                <Link href={`/student/new/${d.typeCode}?edit=${d.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 font-medium text-ink-inverse hover:bg-brand-hover">
                  <PencilLine className="size-4" aria-hidden="true" /> แก้ไขแล้วส่งใหม่
                </Link>
              )}
            </Card>
          )}

          {d.can.act && (
            <Card className="grid gap-4 p-4 ring-brand-border sm:p-5">
              <div>
                <h2 className="font-semibold">พิจารณาคำร้อง</h2>
                <p className="text-sm text-ink-muted">ขั้นที่ {d.currentStep + 1}/{steps.length}: {steps[d.currentStep]?.title}</p>
              </div>
              <Field label="ความเห็น" hint="พิมพ์ลงในช่องความเห็นของแบบฟอร์ม · ส่งกลับหรือไม่อนุมัติต้องระบุเหตุผล" error={commentError} counter={`${comment.length}/300`}>
                {({ describedBy, invalid }) => (
                  <div className="grid gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(STEP_COMMENTS[steps[d.currentStep]?.key ?? ''] ?? QUICK_COMMENTS).map((c) => (
                        <button key={c} type="button" onClick={() => { setComment(c); setCommentError(''); }} className="min-h-9 rounded-full bg-surface px-3 text-sm ring-1 ring-line-strong hover:bg-sunken">{c}</button>
                      ))}
                    </div>
                    <Textarea id="decision-comment" aria-describedby={describedBy} aria-invalid={invalid} value={comment} maxLength={300} onChange={(e) => { setComment(e.target.value); setCommentError(''); }} />
                  </div>
                )}
              </Field>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                <Button onClick={() => void decide('approve')} loading={busy === 'approve'} disabled={!!busy} icon={<Check className="size-4" aria-hidden="true" />}>{isFinal ? 'อนุมัติ' : 'เห็นควร ส่งต่อ'}</Button>
                <Button variant="secondary" onClick={() => void decide('return')} loading={busy === 'return'} disabled={!!busy} icon={<CornerUpLeft className="size-4" aria-hidden="true" />}>ส่งกลับแก้ไข</Button>
                <Button variant="danger" onClick={() => void decide('reject')} loading={busy === 'reject'} disabled={!!busy} icon={<X className="size-4" aria-hidden="true" />}>ไม่อนุมัติ</Button>
              </div>
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <h2 className="font-semibold">ขั้นตอนการพิจารณา</h2>
            <ol className="mt-3 grid gap-0">
              {steps.map((step, i) => {
                const a = current.find((x) => x.stepIndex === i);
                const isCurrent = d.status === 'pending' && d.currentStep === i;
                const done = !!a && a.decision === 'approve';
                return (
                  <li key={step.key} className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                    {i < steps.length - 1 && <span className={cx('absolute left-[11px] top-6 bottom-0 w-0.5', done ? 'bg-ok/50' : 'bg-line')} aria-hidden="true" />}
                    <span className={cx('z-[1] mt-0.5 grid size-6 place-items-center rounded-full text-xs font-semibold',
                      done ? 'bg-ok text-ink-inverse' : a ? 'bg-danger text-ink-inverse' : isCurrent ? 'bg-brand text-ink-inverse ring-4 ring-brand-soft' : 'bg-sunken text-ink-muted ring-1 ring-line-strong')}>
                      {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : i + 1}
                    </span>
                    <div>
                      <p className={cx('font-medium', !a && !isCurrent && 'text-ink-muted')}>{step.title.replace(/^ความเห็น(ของ)?/, '') || step.title}</p>
                      {a ? (
                        <p className="text-sm text-ink-muted">{a.actorName} · {formatThaiDateTime(a.decidedAt)}{a.comment && <><br /><span className="text-ink">“{a.comment}”</span></>}</p>
                      ) : isCurrent ? <p className="text-sm text-brand">กำลังพิจารณา</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            {d.can.cancel && (
              <Button variant="ghost" className="mt-4 w-full" loading={busy === 'cancel'} onClick={() => void cancel()}>ยกเลิกคำร้อง</Button>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="font-semibold">ประวัติ</h2>
            <ul className="mt-2 grid gap-2.5">
              {[...d.history].reverse().map((h) => (
                <li key={h.id} className="text-[15px]">
                  <span className="font-medium">{STATUS_LABEL[h.toStatus]}</span> · {h.note}
                  <br /><span className="text-sm text-ink-muted">{h.actorName} · {formatThaiDateTime(h.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div>
        <PreviewFrame print>
          {sheetsFor((type?.template ?? 'general') as TemplateKey, { student: d.student, data: d.data as FormData, submittedAt: d.submittedAt, requestNo: d.requestNo, approvals: current, officials: d.officials, studentSigned: d.studentSigned })}
        </PreviewFrame>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><Detail /></Suspense>;
}
