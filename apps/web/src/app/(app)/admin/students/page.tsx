'use client';

import { LEVEL_LABEL, STUDENT_STATUS_LABEL } from '@csis/shared';
import { FileSpreadsheet, Plus, Search, UploadCloud } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { PageHeader } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { StudentImport } from '@/components/StudentImport';
import { Alert, Button, Card, Field, Input, Spinner, cx } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Row { id: string; studentCode: string; name: string; level: 'pvc' | 'pvs'; program: string; department: string; yearLevel: number; groupNo: string; status: string; advisor: string; accountStatus: string }
interface List { items: Row[]; total: number; pageSize: number }
interface Program { id: string; name: string; level: 'pvc' | 'pvs'; department: string; departmentId: string }
interface Staff { id: string; displayName: string; username: string }
type StudentForm = {
  studentCode: string; prefix: string; firstName: string; lastName: string; birthDate: string; programId: string; yearLevel: number; groupNo: string;
  status: string; advisorUserId: string; phone: string; email: string; fatherName: string; motherName: string; nickname: string; nationalId: string;
};
const EMPTY: StudentForm = { studentCode: '', prefix: 'นาย', firstName: '', lastName: '', birthDate: '', programId: '', yearLevel: 1, groupNo: '1', status: 'studying', advisorUserId: '', phone: '', email: '', fatherName: '', motherName: '', nickname: '', nationalId: '' };
const selectBase = 'min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';
const select = `${selectBase} w-full`;

const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

export default function Page() {
  return <Suspense fallback={<Spinner />}><StudentsAdmin /></Suspense>;
}

function StudentsAdmin() {
  const params0 = useSearchParams();
  // นำเข้า: null = ปิด, { file } = เปิด (file ว่าง = ให้เลือกไฟล์เอง)
  const [importing, setImporting] = useState<{ file: File | null } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  useEffect(() => { if (params0.get('import') === '1') setImporting({ file: null }); }, [params0]);
  const onDragEnter = (e: DragEvent) => { if (!isFileDrag(e) || importing) return; e.preventDefault(); dragDepth.current += 1; setDragging(true); };
  const onDragLeave = (e: DragEvent) => { if (!isFileDrag(e)) return; dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); };
  const onDrop = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault(); dragDepth.current = 0; setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && !importing) setImporting({ file });
  };

  const [q, setQ] = useState(params0.get('q') ?? '');
  const [query, setQuery] = useState(params0.get('q') ?? '');
  // ตัวกรองเริ่มต้นมาจากลิงก์ในแดชบอร์ด เช่น ?level=pvc&yearLevel=2&status=studying
  const [programId, setProgramId] = useState(params0.get('programId') ?? '');
  const [status, setStatus] = useState(params0.get('status') ?? '');
  const [extra, setExtra] = useState(() => ({ level: params0.get('level') ?? '', yearLevel: params0.get('yearLevel') ?? '', departmentId: params0.get('departmentId') ?? '' }));
  const [page, setPage] = useState(0);
  const params = new URLSearchParams({ page: String(page), ...(query ? { q: query } : {}), ...(programId ? { programId } : {}), ...(status ? { status } : {}),
    ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) });
  const { data, error, reload } = useApi<List>(`/admin/students?${params}`);
  const programs = useApi<Program[]>('/admin/programs').data ?? [];
  const staff = useApi<Staff[]>('/admin/staff-options').data ?? [];
  const [editId, setEditId] = useState<string | null | undefined>(undefined); // undefined = ปิด, null = เพิ่มใหม่
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="relative grid grid-cols-[minmax(0,1fr)] gap-5" onDragEnter={onDragEnter} onDragOver={(e) => isFileDrag(e) && e.preventDefault()} onDragLeave={onDragLeave} onDrop={onDrop}>
      <PageHeader title="นักเรียน นักศึกษา" subtitle="ข้อมูลทะเบียน · การแก้ไขทุกครั้งบันทึกในประวัติพร้อมค่าก่อน/หลัง"
        actions={<>
          <Button variant="secondary" onClick={() => setImporting({ file: null })} icon={<FileSpreadsheet className="size-4" aria-hidden="true" />}>นำเข้าจากไฟล์</Button>
          <Button onClick={() => setEditId(null)} icon={<Plus className="size-4" aria-hidden="true" />}>เพิ่มนักเรียน (กรอกเอง)</Button>
        </>} />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-brand-deep/70 p-6 [animation:fade_120ms_ease-out]">
          <div className="grid justify-items-center gap-3 rounded-[var(--radius-card)] bg-surface px-10 py-8 text-center shadow-[0_8px_32px_hsl(350_30%_15%/0.3)]">
            <UploadCloud className="size-12 text-brand" aria-hidden="true" />
            <p className="text-xl font-semibold">วางไฟล์เพื่อนำเข้านักเรียน</p>
            <p className="text-ink-muted">.xlsx หรือ .csv · ระบบจะให้ตรวจก่อนบันทึก</p>
          </div>
        </div>
      )}
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line/80 p-3" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(0); }}>
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="รหัส หรือชื่อ-นามสกุล" aria-label="ค้นหานักเรียน" className="min-h-11 pl-9" />
          </div>
          <select value={programId} onChange={(e) => { setProgramId(e.target.value); setPage(0); }} aria-label="กรองสาขา" className={selectBase}>
            <option value="">ทุกสาขา</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{LEVEL_LABEL[p.level]} {p.name}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} aria-label="กรองสถานภาพ" className={selectBase}>
            <option value="">ทุกสถานภาพ</option>
            {Object.entries(STUDENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button type="submit" variant="secondary">ค้นหา</Button>
          {(extra.level || extra.yearLevel || extra.departmentId) && (
            <p className="flex w-full flex-wrap items-center gap-2 text-[15px]">
              <span className="text-ink-muted">กรองเพิ่ม:</span>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                {[extra.level && LEVEL_LABEL[extra.level as 'pvc' | 'pvs'], extra.yearLevel && `ชั้นปี ${extra.yearLevel}`, extra.departmentId && `แผนก${programs.find((x) => x.departmentId === extra.departmentId)?.department ?? ''}`].filter(Boolean).join(' · ')}
              </span>
              <button type="button" className="text-brand underline underline-offset-2" onClick={() => { setExtra({ level: '', yearLevel: '', departmentId: '' }); setPage(0); }}>ล้าง</button>
            </p>
          )}
        </form>
        {error ? <div className="p-4"><Alert>{error}</Alert></div> : !data ? <Spinner /> : data.items.length === 0 ? <p className="p-6 text-center text-ink-muted">ไม่พบนักเรียน</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted"><tr>
                <th scope="col" className="px-4 py-2 font-medium">รหัส</th><th scope="col" className="px-2 py-2 font-medium">ชื่อ-นามสกุล</th>
                <th scope="col" className="px-2 py-2 font-medium">ระดับ/สาขา</th><th scope="col" className="px-2 py-2 font-medium">ชั้น/กลุ่ม</th>
                <th scope="col" className="px-2 py-2 font-medium">สถานภาพ</th><th scope="col" className="px-4 py-2 font-medium">ครูที่ปรึกษา</th>
              </tr></thead>
              <tbody className="divide-y divide-line/70">
                {data.items.map((s) => (
                  <tr key={s.id} className="cursor-pointer hover:bg-sunken/60" onClick={() => setEditId(s.id)}>
                    <td className="px-4 py-2.5 tabular-nums"><button type="button" className="font-medium text-brand hover:underline" onClick={() => setEditId(s.id)}>{s.studentCode}</button></td>
                    <td className="px-2 py-2.5">{s.name}{s.accountStatus === 'SUSPENDED' && <span className="ml-2 rounded bg-danger-soft px-1.5 text-xs text-danger">บัญชีถูกระงับ</span>}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{LEVEL_LABEL[s.level]} {s.program}</td>
                    <td className="px-2 py-2.5 tabular-nums">{s.yearLevel}/{s.groupNo}</td>
                    <td className="px-2 py-2.5 whitespace-nowrap">{STUDENT_STATUS_LABEL[s.status] ?? s.status}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">{s.advisor || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line/80 px-4 py-2.5 text-sm">
            <span className="tabular-nums text-ink-muted">หน้า {page + 1}/{pages} · {data?.total} คน</span>
            <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button><Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button></div>
          </div>
        )}
      </Card>
      <Dialog open={!!importing} onClose={() => setImporting(null)} title="นำเข้านักเรียนจากไฟล์" xl>
        {importing && <StudentImport initialFile={importing.file} onCommitted={() => void reload()} onClose={() => setImporting(null)} />}
      </Dialog>
      <Dialog open={editId !== undefined} onClose={() => setEditId(undefined)} title={editId ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียน'} wide>
        {editId !== undefined && <StudentEditor id={editId} programs={programs} staff={staff} onSaved={() => { setEditId(undefined); void reload(); }} />}
      </Dialog>
    </div>
  );
}

function StudentEditor({ id, programs, staff, onSaved }: { id: string | null; programs: Program[]; staff: Staff[]; onSaved: () => void }) {
  const loaded = useApi<StudentForm & { id: string }>(id ? `/admin/students/${id}` : null);
  const [form, setForm] = useState<StudentForm | null>(id ? null : EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  if (id && !form && loaded.data) {
    const d = loaded.data;
    setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ''])) } as StudentForm);
  }
  if (loaded.error) return <Alert>{loaded.error}</Alert>;
  if (!form) return <Spinner />;
  if (created) return <Alert tone="ok">เพิ่มนักเรียนแล้ว · เข้าสู่ระบบด้วยรหัส {form.studentCode} รหัสผ่าน <strong>{created}</strong> (วันเกิด)</Alert>;
  const set = (patch: Partial<StudentForm>) => { setForm({ ...form, ...patch }); setErrors({}); };
  const text = (key: keyof StudentForm, label: string, extra: { hint?: string; type?: string; inputMode?: 'numeric' | 'tel' | 'email' } = {}) => (
    <Field label={label} hint={extra.hint} error={errors[key]}>
      {({ id: fid, describedBy, invalid }) => <Input id={fid} aria-describedby={describedBy} aria-invalid={invalid} type={extra.type} inputMode={extra.inputMode} value={String(form[key] ?? '')} onChange={(e) => set({ [key]: e.target.value } as Partial<StudentForm>)} />}
    </Field>
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = { ...form, birthDate: form!.birthDate || null, advisorUserId: form!.advisorUserId || null, yearLevel: Number(form!.yearLevel) };
    try {
      if (id) { await api.put(`/admin/students/${id}`, body); onSaved(); }
      else { const r = await api.post<{ password: string }>('/admin/students', body); setCreated(r.password); }
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.fields).length ? err.fields : { _: errorMessage(err) });
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-12">
        <legend className="sr-only">ข้อมูลส่วนตัว</legend>
        <p className="-mb-1 text-sm font-semibold text-ink-muted sm:col-span-12">ข้อมูลส่วนตัว</p>
        <div className="sm:col-span-3">
          <Field label="คำนำหน้า" error={errors.prefix}>{({ id: fid }) => (
            <select id={fid} className={select} value={form.prefix} onChange={(e) => set({ prefix: e.target.value })}>{['นาย', 'นางสาว', 'นาง', 'เด็กชาย', 'เด็กหญิง'].map((p) => <option key={p}>{p}</option>)}</select>
          )}</Field>
        </div>
        <div className="sm:col-span-5">{text('firstName', 'ชื่อ')}</div>
        <div className="sm:col-span-4">{text('lastName', 'นามสกุล')}</div>
        <div className="sm:col-span-3">{text('nickname', 'ชื่อเล่น')}</div>
        <div className="sm:col-span-5">{text('birthDate', 'วันเกิด', { type: 'date', hint: id ? undefined : 'ใช้เป็นรหัสผ่านเริ่มต้น' })}</div>
        <div className="sm:col-span-4">{text('nationalId', 'เลขประจำตัวประชาชน', { inputMode: 'numeric' })}</div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line/80 pt-5 sm:grid-cols-12">
        <legend className="sr-only">การศึกษา</legend>
        <p className="-mb-1 text-sm font-semibold text-ink-muted sm:col-span-12">การศึกษา</p>
        <div className="sm:col-span-3">
          <Field label="รหัสนักศึกษา" error={errors.studentCode} hint={id ? 'แก้ไม่ได้ (ใช้เป็นชื่อผู้ใช้)' : undefined}>{({ id: fid, describedBy, invalid }) => (
            <Input id={fid} aria-describedby={describedBy} aria-invalid={invalid} inputMode="numeric" value={form.studentCode} disabled={!!id} onChange={(e) => set({ studentCode: e.target.value.replace(/\D/g, '') })} />
          )}</Field>
        </div>
        <div className="sm:col-span-5">
          <Field label="สาขาวิชา" error={errors.programId}>{({ id: fid }) => (
            <select id={fid} className={select} value={form.programId} onChange={(e) => set({ programId: e.target.value })}>
              <option value="">— เลือกสาขา —</option>
              {programs.map((p) => <option key={p.id} value={p.id}>{LEVEL_LABEL[p.level]} {p.name} ({p.department.replace(/^แผนกวิชา/, '')})</option>)}
            </select>
          )}</Field>
        </div>
        <div className="sm:col-span-2">{text('yearLevel', 'ชั้นปี', { inputMode: 'numeric' })}</div>
        <div className="sm:col-span-2">{text('groupNo', 'กลุ่ม')}</div>
        <div className="sm:col-span-3">
          <Field label="สถานภาพ">{({ id: fid }) => (
            <select id={fid} className={select} value={form.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(STUDENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          )}</Field>
        </div>
        <div className="sm:col-span-9">
          <Field label="ครูที่ปรึกษา" error={errors.advisorUserId}>{({ id: fid }) => (
            <select id={fid} className={select} value={form.advisorUserId} onChange={(e) => set({ advisorUserId: e.target.value })}>
              <option value="">— ยังไม่กำหนด —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
            </select>
          )}</Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 border-t border-line/80 pt-5 sm:grid-cols-12">
        <legend className="sr-only">การติดต่อและผู้ปกครอง</legend>
        <p className="-mb-1 text-sm font-semibold text-ink-muted sm:col-span-12">การติดต่อและผู้ปกครอง</p>
        <div className="sm:col-span-3">{text('phone', 'โทรศัพท์', { inputMode: 'tel' })}</div>
        <div className="sm:col-span-9">{text('email', 'อีเมล', { inputMode: 'email' })}</div>
        <div className="sm:col-span-6">{text('fatherName', 'ชื่อ-สกุล บิดา')}</div>
        <div className="sm:col-span-6">{text('motherName', 'ชื่อ-สกุล มารดา')}</div>
      </fieldset>

      {errors._ && <Alert>{errors._}</Alert>}
      <div className="flex justify-end border-t border-line/80 pt-4">
        <Button type="submit" loading={busy} className="min-w-40">{id ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}</Button>
      </div>
    </form>
  );
}
