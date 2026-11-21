'use client';

import { LEVEL_LABEL, STAFF_KIND_LABEL, WORK_STATUS_LABEL, formatThaiDateTime, type StaffKind, type WorkStatus } from '@csis/shared';
import { BookOpen, Briefcase, FileSpreadsheet, PauseCircle, Search, UserCog, UserRound, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { AcademicImport } from '@/components/AcademicImport';
import { BarList, Panel, StatLink } from '@/components/charts';
import { Dialog } from '@/components/Dialog';
import { Alert, Button, Field, Input, Spinner, cx } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { ROLE_LABEL } from '../labels';

interface Dash {
  total: number; withProfile: number; noProfile: number;
  kind: Partial<Record<StaffKind, number>>; workStatus: Partial<Record<WorkStatus, number>>;
  byDepartment: { id: string | null; name: string; count: number }[];
  byProgram: { id: string; name: string; level: 'pvc' | 'pvs'; department: string; count: number }[];
  byEmployment: { name: string; count: number }[];
}
interface Row {
  id: string; username: string; name: string; accountStatus: 'ACTIVE' | 'SUSPENDED'; roles: string[]; staffCode: string | null; hasProfile: boolean;
  kind: StaffKind | null; positionTitle: string; workStatus: WorkStatus | null; department: string; program: string;
}
interface List { total: number; pageSize: number; items: Row[] }
interface Program { id: string; name: string; level: 'pvc' | 'pvs'; department: string; departmentId: string }
interface Profile {
  staffCode: string | null; prefix: string; firstName: string; lastName: string; kind: StaffKind; positionTitle: string; employment: string;
  departmentId: string | null; programId: string | null; workStatus: WorkStatus; phone: string; email: string;
}
interface Detail {
  id: string; username: string; displayName: string; accountStatus: 'ACTIVE' | 'SUSPENDED'; lastLoginAt: string | null; roles: string[]; advisees: number;
  profile: Profile | null; teaching: { term: string | null; sections: { id: string; code: string; name: string; group: string }[] };
}
type Filters = { q: string; departmentId: string; programId: string; kind: StaffKind | ''; workStatus: WorkStatus | ''; none: boolean };
const NO_FILTER: Filters = { q: '', departmentId: '', programId: '', kind: '', workStatus: '', none: false };
const selectCls = 'min-h-11 min-w-0 rounded-[var(--radius-control)] bg-surface px-3 text-[16px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';
const WS_TONE: Record<WorkStatus, string> = { active: 'bg-ok-soft text-ok', on_leave: 'bg-warn-soft text-warn', transferred: 'bg-sunken text-ink-muted', retired: 'bg-sunken text-ink-muted', resigned: 'bg-sunken text-ink-muted' };
const WS_SHORT: Record<WorkStatus, string> = { active: 'ปฏิบัติงาน', on_leave: 'ลา', transferred: 'ย้าย', retired: 'เกษียณ', resigned: 'ลาออก' };

export default function StaffPage() {
  const dash = useApi<Dash>('/admin/staff/dashboard');
  const programs = useApi<Program[]>('/admin/programs').data ?? [];
  const departments = [...new Map(programs.map((p) => [p.departmentId, p.department])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'th'));
  const [f, setF] = useState<Filters>(NO_FILTER);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, q: q.trim() })); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  const params = new URLSearchParams({ page: String(page), ...(f.q ? { q: f.q } : {}), ...(f.departmentId ? { departmentId: f.departmentId } : {}), ...(f.programId ? { programId: f.programId } : {}),
    ...(f.kind ? { kind: f.kind } : {}), ...(f.workStatus ? { workStatus: f.workStatus } : {}), ...(f.none ? { none: '1' } : {}) });
  const list = useApi<List>(`/admin/staff?${params}`);
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const pages = list.data ? Math.ceil(list.data.total / list.data.pageSize) : 0;
  const filtered = JSON.stringify({ ...f, q: '' }) !== JSON.stringify({ ...NO_FILTER, q: '' }) || !!f.q;
  const pick = (next: Partial<Filters>) => {
    setF({ ...NO_FILTER, q: f.q, ...next }); setPage(0);
    document.getElementById('staff-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reload = () => { void dash.reload(); void list.reload(); };

  const d = dash.data;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="ครูและบุคลากร" subtitle="กดตัวเลขหรือแถบกราฟเพื่อกรองรายชื่อ · สถิติแผนก/สาขานับเฉพาะคนที่ปฏิบัติงาน"
        actions={<Button variant="secondary" onClick={() => setImporting(true)} icon={<FileSpreadsheet className="size-4" aria-hidden="true" />}>นำเข้ารายชื่อจาก Excel</Button>} />

      {dash.error ? <Alert>{dash.error}</Alert> : !d ? <Spinner /> : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="ตัวเลขหลัก">
            <StatLink tone="brand" icon={<Users className="size-4" aria-hidden="true" />} label="ทั้งหมด" value={d.total} hint="บัญชีครูและเจ้าหน้าที่" onClick={() => pick({})} />
            <StatLink tone="ok" icon={<BookOpen className="size-4" aria-hidden="true" />} label="ครู (ปฏิบัติงาน)" value={d.kind.teacher ?? 0} hint="คน" onClick={() => pick({ kind: 'teacher', workStatus: 'active' })} />
            <StatLink icon={<Briefcase className="size-4" aria-hidden="true" />} label="บุคลากรสนับสนุน" value={d.kind.support ?? 0} hint="ปฏิบัติงาน" onClick={() => pick({ kind: 'support', workStatus: 'active' })} />
            <StatLink tone={d.workStatus.on_leave ? 'warn' : 'default'} icon={<PauseCircle className="size-4" aria-hidden="true" />} label="ลา / ศึกษาต่อ" value={d.workStatus.on_leave ?? 0} hint="คน" onClick={() => pick({ workStatus: 'on_leave' })} />
            <StatLink tone={d.noProfile ? 'info' : 'default'} icon={<UserCog className="size-4" aria-hidden="true" />} label="ยังไม่กรอกข้อมูล" value={d.noProfile} hint="ไม่มีแผนก/ตำแหน่ง" onClick={() => pick({ none: true })} />
          </section>

          {d.withProfile === 0 ? (
            <Alert tone="info">ยังไม่มีข้อมูลแผนกและตำแหน่งของครู — กด “นำเข้ารายชื่อจาก Excel” (มีไฟล์ตัวอย่างให้ดาวน์โหลด) หรือกดชื่อในรายการด้านล่างเพื่อกรอกทีละคน</Alert>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <Panel title="แยกตามแผนก">
                <BarList unit="คน" items={d.byDepartment.map((x) => ({ key: x.id ?? 'none', label: x.name, value: x.count, tone: x.id ? 'brand' : 'muted', ...(x.id ? { onClick: () => pick({ departmentId: x.id!, workStatus: 'active' }) } : {}) }))} />
              </Panel>
              <Panel title="แยกตามสาขาวิชา">
                <BarList unit="คน" empty="ยังไม่ได้ระบุสาขา" items={d.byProgram.map((x) => ({ key: x.id, label: x.name, sub: LEVEL_LABEL[x.level], value: x.count, tone: x.level === 'pvc' ? 'brand' : 'gold', onClick: () => pick({ programId: x.id, workStatus: 'active' }) }))} />
              </Panel>
              <Panel title="ประเภทบุคลากร">
                <BarList unit="คน" items={d.byEmployment.map((x) => ({ key: x.name, label: x.name, value: x.count, tone: 'info' }))} />
              </Panel>
            </div>
          )}
        </>
      )}

      <section id="staff-list" className="scroll-mt-24 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card ring-1 ring-line/70" aria-label="รายชื่อครูและบุคลากร">
        <div className="grid gap-2 border-b border-line/80 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <label className="relative block sm:col-span-2 lg:col-span-1">
            <span className="sr-only">ค้นหา</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ รหัส หรือตำแหน่ง" className="min-h-11 w-full rounded-[var(--radius-control)] bg-surface pr-3 pl-10 text-[16px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand" />
          </label>
          <select aria-label="แผนก" className={selectCls} value={f.departmentId} onChange={(e) => { setF((x) => ({ ...x, departmentId: e.target.value, programId: '', none: false })); setPage(0); }}>
            <option value="">ทุกแผนก</option>
            {departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select aria-label="ครูหรือบุคลากร" className={selectCls} value={f.kind} onChange={(e) => { setF((x) => ({ ...x, kind: e.target.value as StaffKind | '', none: false })); setPage(0); }}>
            <option value="">ครูและบุคลากร</option>
            {(Object.keys(STAFF_KIND_LABEL) as StaffKind[]).map((k) => <option key={k} value={k}>{STAFF_KIND_LABEL[k]}</option>)}
          </select>
          <select aria-label="สถานะการปฏิบัติงาน" className={selectCls} value={f.workStatus} onChange={(e) => { setF((x) => ({ ...x, workStatus: e.target.value as WorkStatus | '', none: false })); setPage(0); }}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(WS_SHORT) as WorkStatus[]).map((k) => <option key={k} value={k}>{WS_SHORT[k]}</option>)}
          </select>
          {filtered && (
            <p className="flex flex-wrap items-center gap-2 text-[15px] sm:col-span-2 lg:col-span-4">
              {f.none && <span className="rounded-full bg-info-soft px-3 py-1 text-info">เฉพาะคนที่ยังไม่กรอกข้อมูล</span>}
              {f.programId && <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">สาขา{programs.find((p) => p.id === f.programId)?.name}</span>}
              <button type="button" className="text-brand underline underline-offset-2" onClick={() => { setQ(''); setF(NO_FILTER); setPage(0); }}>ล้างตัวกรอง</button>
            </p>
          )}
        </div>

        {list.error ? <div className="p-4"><Alert>{list.error}</Alert></div> : !list.data ? <Spinner /> : list.data.items.length === 0 ? (
          <EmptyState icon={<UserRound className="size-7" aria-hidden="true" />} title={filtered ? 'ไม่พบรายชื่อที่ตรงกับที่ค้นหา' : 'ยังไม่มีครูหรือเจ้าหน้าที่'}>
            {!filtered && 'นำเข้ารายชื่อจาก Excel หรือเพิ่มบัญชีที่หน้าผู้ใช้งาน'}
          </EmptyState>
        ) : (
          <>
            <ul className="divide-y divide-line/70">
              {list.data.items.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r.id)} className="grid w-full gap-1 px-4 py-3 text-left hover:bg-sunken/50 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6.5rem] sm:items-center sm:gap-4">
                    <span className="min-w-0">
                      <span className="block font-medium">{r.name}</span>
                      <span className="text-sm text-ink-muted">{r.staffCode ? `รหัส ${r.staffCode} · ` : ''}{r.username}{r.accountStatus === 'SUSPENDED' ? ' · บัญชีระงับ' : ''}</span>
                    </span>
                    <span className="min-w-0 text-[15px]">
                      {r.hasProfile ? (<>
                        <span className="block truncate">{r.positionTitle || (r.kind ? STAFF_KIND_LABEL[r.kind] : '')}</span>
                        <span className="block truncate text-sm text-ink-muted">{[r.department, r.program && `สาขา${r.program}`].filter(Boolean).join(' · ') || 'ไม่ระบุแผนก'}</span>
                      </>) : <span className="text-sm text-info">ยังไม่กรอกข้อมูล · {r.roles.map((x) => ROLE_LABEL[x as keyof typeof ROLE_LABEL] ?? x).join(', ') || 'ไม่มีบทบาท'}</span>}
                    </span>
                    {r.workStatus && <span className={cx('w-fit rounded-full px-2.5 py-0.5 text-sm font-medium', WS_TONE[r.workStatus])}>{WS_SHORT[r.workStatus]}</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 px-4 py-3 text-sm text-ink-muted">
              <span>ทั้งหมด {list.data.total.toLocaleString('th-TH')} คน</span>
              {pages > 1 && (
                <span className="flex items-center gap-2">
                  <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
                  <span className="tabular-nums">หน้า {page + 1} / {pages}</span>
                  <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
                </span>
              )}
            </div>
          </>
        )}
      </section>

      <Dialog open={!!open} onClose={() => setOpen(null)} title="ข้อมูลครูและบุคลากร" wide>
        {open && <StaffDetail id={open} programs={programs} departments={departments} onSaved={() => { reload(); }} />}
      </Dialog>
      <Dialog open={importing} onClose={() => setImporting(false)} title="นำเข้ารายชื่อครูและบุคลากร" xl>
        {importing && <AcademicImport kind="staff" terms={[]} onCommitted={reload} onClose={() => setImporting(false)} />}
      </Dialog>
    </div>
  );
}

function StaffDetail({ id, programs, departments, onSaved }: { id: string; programs: Program[]; departments: [string, string][]; onSaved: () => void }) {
  const { data, error, reload } = useApi<Detail>(`/admin/staff/${id}`);
  const [form, setForm] = useState<Profile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data) return;
    const [first = '', ...rest] = data.displayName.split(' ');
    setForm(data.profile ?? { staffCode: null, prefix: '', firstName: first, lastName: rest.join(' '), kind: data.roles.includes('TEACHER') ? 'teacher' : 'support', positionTitle: '', employment: '', departmentId: null, programId: null, workStatus: 'active', phone: '', email: '' });
  }, [data]);
  if (error) return <Alert>{error}</Alert>;
  if (!data || !form) return <Spinner />;
  const set = (p: Partial<Profile>) => setForm((x) => ({ ...x!, ...p }));
  const inDept = programs.filter((p) => !form.departmentId || p.departmentId === form.departmentId);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setMsg(null);
    try { await api.put(`/admin/staff/${id}`, form); setMsg({ tone: 'ok', text: 'บันทึกแล้ว' }); onSaved(); await reload(); }
    catch (err) { if (err instanceof ApiError) setErrors(err.fields); setMsg({ tone: 'danger', text: errorMessage(err) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-1 rounded-[var(--radius-control)] bg-sunken/60 p-3 text-[15px]">
        <p><span className="text-ink-muted">บัญชีผู้ใช้:</span> <strong>{data.username}</strong> · {data.accountStatus === 'ACTIVE' ? <span className="text-ok">ใช้งานได้</span> : <span className="text-warn">ระงับ</span>}
          {' · '}<Link href={`/admin/users?q=${encodeURIComponent(data.username)}`} className="text-brand underline underline-offset-2">จัดการบัญชี/รหัสผ่าน</Link></p>
        <p><span className="text-ink-muted">บทบาท:</span> {data.roles.map((r) => ROLE_LABEL[r as keyof typeof ROLE_LABEL] ?? r).join(', ') || '–'} · <span className="text-ink-muted">เข้าระบบล่าสุด:</span> {data.lastLoginAt ? formatThaiDateTime(data.lastLoginAt) : 'ยังไม่เคย'}</p>
        <p><span className="text-ink-muted">ภาคเรียน {data.teaching.term ?? '–'} สอน</span> {data.teaching.sections.length} วิชา{data.advisees ? ` · ที่ปรึกษานักเรียน ${data.advisees} คน` : ''}</p>
        {data.teaching.sections.length > 0 && <p className="text-sm text-ink-muted">{data.teaching.sections.slice(0, 6).map((s) => `${s.code} ${s.name} (กลุ่ม ${s.group})`).join(' · ')}{data.teaching.sections.length > 6 ? ` และอีก ${data.teaching.sections.length - 6} วิชา` : ''}</p>}
      </div>

      <form onSubmit={(e) => void save(e)} className="grid gap-3 sm:grid-cols-2" noValidate>
        <Field label="รหัสบุคลากร" hint="ไม่ซ้ำกัน ใช้จับคู่ตอนนำเข้าไฟล์" error={errors.staffCode}>{(p) => <Input id={p.id} aria-describedby={p.describedBy} aria-invalid={p.invalid} value={form.staffCode ?? ''} onChange={(e) => set({ staffCode: e.target.value })} maxLength={40} />}</Field>
        <Field label="คำนำหน้า" error={errors.prefix}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.prefix} onChange={(e) => set({ prefix: e.target.value })} maxLength={20} placeholder="นาย / นาง / นางสาว / ดร." />}</Field>
        <Field label="ชื่อ" error={errors.firstName}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.firstName} onChange={(e) => set({ firstName: e.target.value })} maxLength={80} required />}</Field>
        <Field label="นามสกุล" error={errors.lastName}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.lastName} onChange={(e) => set({ lastName: e.target.value })} maxLength={80} />}</Field>
        <Field label="กลุ่ม" error={errors.kind}>{(p) => (
          <select id={p.id} className={cx(selectCls, 'w-full')} value={form.kind} onChange={(e) => set({ kind: e.target.value as StaffKind })}>
            {(Object.keys(STAFF_KIND_LABEL) as StaffKind[]).map((k) => <option key={k} value={k}>{STAFF_KIND_LABEL[k]}</option>)}
          </select>)}</Field>
        <Field label="ตำแหน่ง" error={errors.positionTitle}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.positionTitle} onChange={(e) => set({ positionTitle: e.target.value })} maxLength={100} placeholder="เช่น ครู คศ.2" />}</Field>
        <Field label="ประเภทบุคลากร" error={errors.employment}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.employment} onChange={(e) => set({ employment: e.target.value })} maxLength={100} placeholder="เช่น ข้าราชการครู, พนักงานราชการ" list="employment-options" />}</Field>
        <datalist id="employment-options">{['ข้าราชการครู', 'พนักงานราชการ', 'ครูอัตราจ้าง', 'ลูกจ้างประจำ', 'ลูกจ้างชั่วคราว'].map((o) => <option key={o} value={o} />)}</datalist>
        <Field label="สถานะการปฏิบัติงาน" error={errors.workStatus}>{(p) => (
          <select id={p.id} className={cx(selectCls, 'w-full')} value={form.workStatus} onChange={(e) => set({ workStatus: e.target.value as WorkStatus })}>
            {(Object.keys(WORK_STATUS_LABEL) as WorkStatus[]).map((k) => <option key={k} value={k}>{WORK_STATUS_LABEL[k]}</option>)}
          </select>)}</Field>
        <Field label="แผนก" error={errors.departmentId}>{(p) => (
          <select id={p.id} className={cx(selectCls, 'w-full')} value={form.departmentId ?? ''} onChange={(e) => set({ departmentId: e.target.value || null, programId: null })}>
            <option value="">— ไม่ระบุ —</option>
            {departments.map(([did, name]) => <option key={did} value={did}>{name}</option>)}
          </select>)}</Field>
        <Field label="สาขาวิชา" error={errors.programId}>{(p) => (
          <select id={p.id} className={cx(selectCls, 'w-full')} value={form.programId ?? ''} onChange={(e) => set({ programId: e.target.value || null })}>
            <option value="">— ไม่ระบุ —</option>
            {inDept.map((pr) => <option key={pr.id} value={pr.id}>{LEVEL_LABEL[pr.level]} {pr.name}</option>)}
          </select>)}</Field>
        <Field label="เบอร์โทรศัพท์" error={errors.phone}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" maxLength={15} />}</Field>
        <Field label="อีเมล" error={errors.email}>{(p) => <Input id={p.id} aria-invalid={p.invalid} value={form.email} onChange={(e) => set({ email: e.target.value })} type="email" maxLength={120} />}</Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" loading={busy}>บันทึกข้อมูล</Button>
          {msg && <span role="status" className={msg.tone === 'ok' ? 'text-ok' : 'text-danger'}>{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}
