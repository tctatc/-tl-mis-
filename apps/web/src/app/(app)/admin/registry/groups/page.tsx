'use client';

import { LEVEL_LABEL, STUDENT_STATUS_LABEL, type ClassGroupRow, type Level } from '@csis/shared';
import { Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { Alert, Button, Card, Input, Spinner, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Labeled, selectCls } from '../../academic/shared';

interface Program { id: string; name: string; level: Level; department: string }
const groupLabel = (g: Pick<ClassGroupRow, 'level' | 'program' | 'yearLevel' | 'groupNo'>) => `${LEVEL_LABEL[g.level]} ${g.program} ปี ${g.yearLevel} ห้อง ${g.groupNo}`;

export default function GroupsPage() {
  const [q, setQ] = useState('');
  const [closed, setClosed] = useState(false);
  const list = useApi<ClassGroupRow[]>(`/admin/registry/groups?active=${closed ? 'false' : 'true'}`);
  const [open, setOpen] = useState<ClassGroupRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const rows = (list.data ?? []).filter((g) => !q.trim() || `${g.code} ${groupLabel(g)} ${g.advisor}`.includes(q.trim()));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="กลุ่มเรียน" subtitle="ห้องเรียนแต่ละรุ่น พร้อมรหัสกลุ่มเรียนแบบ ศธ.02 · ลงทะเบียน เลื่อนชั้น และตรวจจบทำทีละกลุ่ม"
        actions={<Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden="true" />}>เพิ่มกลุ่มเรียน</Button>} />
      {msg && <Alert tone="ok">{msg}</Alert>}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line/80 p-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัสกลุ่ม สาขา ห้อง หรือครูที่ปรึกษา" aria-label="ค้นหากลุ่มเรียน" className="min-h-11 pl-9" />
          </div>
          <label className="flex min-h-11 items-center gap-2 text-[15px] text-ink-muted">
            <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={closed} onChange={(e) => setClosed(e.target.checked)} />ดูกลุ่มที่ปิดใช้งาน
          </label>
        </div>
        {list.error ? <div className="p-4"><Alert>{list.error}</Alert></div> : !list.data ? <Spinner /> : rows.length === 0 ? (
          <EmptyState icon={<Users className="size-7" aria-hidden="true" />} title={closed ? 'ไม่มีกลุ่มที่ปิดใช้งาน' : 'ยังไม่มีกลุ่มเรียน'}>{closed ? '' : 'กลุ่มเรียนสร้างให้อัตโนมัติเมื่อนำเข้ารายชื่อนักเรียน หรือกด “เพิ่มกลุ่มเรียน”'}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[15px]">
              <thead className="bg-sunken/50 text-left text-sm text-ink-muted">
                <tr><th className="px-4 py-2.5 font-medium">รหัสกลุ่มเรียน</th><th className="px-3 py-2.5 font-medium">ห้อง</th><th className="px-3 py-2.5 font-medium">รุ่น</th><th className="px-3 py-2.5 text-right font-medium">นักเรียน</th><th className="px-4 py-2.5 font-medium">ครูที่ปรึกษา</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {rows.map((g) => (
                  <tr key={g.id} className="cursor-pointer hover:bg-sunken/50" onClick={() => setOpen(g)}>
                    <td className="px-4 py-3"><button type="button" className="font-semibold tabular-nums text-brand underline-offset-2 hover:underline" onClick={() => setOpen(g)}>{g.code}</button></td>
                    <td className="px-3 py-3">{groupLabel(g)}</td>
                    <td className="px-3 py-3 tabular-nums">เข้า {g.entryYear}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{g.students}</td>
                    <td className="px-4 py-3 text-ink-muted">{g.advisor || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <GroupDialog group={open} onClose={() => setOpen(null)} onSaved={(t) => { setOpen(null); setMsg(t); void list.reload(); }} />}
      {creating && <CreateDialog onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setMsg('เพิ่มกลุ่มเรียนแล้ว'); void list.reload(); }} />}
    </div>
  );
}

function GroupDialog({ group, onClose, onSaved }: { group: ClassGroupRow; onClose: () => void; onSaved: (msg: string) => void }) {
  const members = useApi<{ students: { id: string; studentCode: string; name: string; status: string }[] }>(`/admin/registry/groups/${group.id}/students`);
  const [code, setCode] = useState(group.code);
  const [groupNo, setGroupNo] = useState(group.groupNo);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save(body: object, text: string) {
    setBusy(true); setErr('');
    try { await api.patch(`/admin/registry/groups/${group.id}`, body); onSaved(text); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  const changed = code !== group.code || groupNo !== group.groupNo;
  return (
    <Dialog open onClose={onClose} title={`กลุ่มเรียน ${group.code}`} wide>
      <div className="grid gap-4">
        <p className="text-[15px] text-ink-muted">{groupLabel(group)} · รุ่นปีการศึกษา {group.entryYear}</p>
        {err && <Alert>{err}</Alert>}
        <div className="flex flex-wrap items-end gap-2">
          <Labeled label="รหัสกลุ่มเรียน"><Input value={code} onChange={(e) => setCode(e.target.value)} className="w-40 tabular-nums" /></Labeled>
          <Labeled label="ชื่อห้อง"><Input value={groupNo} onChange={(e) => setGroupNo(e.target.value)} className="w-40" /></Labeled>
          <Button variant="secondary" disabled={!changed} loading={busy} onClick={() => void save({ ...(code !== group.code ? { code } : {}), ...(groupNo !== group.groupNo ? { groupNo } : {}) }, 'บันทึกกลุ่มเรียนแล้ว')}>บันทึก</Button>
        </div>
        <div className="max-h-[40vh] overflow-y-auto rounded-md ring-1 ring-line/70">
          {!members.data ? <Spinner /> : members.data.students.length === 0 ? <p className="p-4 text-center text-ink-muted">ไม่มีนักเรียนในกลุ่มนี้</p> : (
            <ul className="divide-y divide-line/70 text-[15px]">
              {members.data.students.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 text-right tabular-nums text-ink-muted">{i + 1}</span>
                  <span className="tabular-nums text-ink-muted">{s.studentCode}</span>
                  <span className="flex-1">{s.name}</span>
                  <span className={cx('text-sm', s.status === 'studying' ? 'text-ink-muted' : 'text-warn')}>{STUDENT_STATUS_LABEL[s.status] ?? s.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          {group.active
            ? <Button variant="ghost" loading={busy} onClick={() => { if (window.confirm(`ปิดการใช้งานกลุ่ม ${group.code}? ทำได้เมื่อไม่มีนักเรียนที่กำลังศึกษาแล้ว`)) void save({ active: false }, 'ปิดการใช้งานกลุ่มแล้ว'); }}>ปิดการใช้งานกลุ่มนี้</Button>
            : <Button variant="secondary" loading={busy} onClick={() => void save({ active: true }, 'เปิดใช้งานกลุ่มแล้ว')}>เปิดใช้งานอีกครั้ง</Button>}
          <Button variant="secondary" onClick={onClose}>ปิด</Button>
        </div>
      </div>
    </Dialog>
  );
}

function CreateDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const programs = useApi<Program[]>('/admin/programs').data ?? [];
  const thisYear = new Date().getFullYear() + 543 - (new Date().getMonth() < 4 ? 1 : 0);
  const [f, setF] = useState({ programId: '', entryYear: thisYear, groupNo: '1', yearLevel: 1, code: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function save() {
    setBusy(true); setErr('');
    try { await api.post('/admin/registry/groups', f); onSaved(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title="เพิ่มกลุ่มเรียน">
      <div className="grid gap-3">
        {err && <Alert>{err}</Alert>}
        <Labeled label="สาขาวิชา">
          <select className={selectCls} value={f.programId} onChange={(e) => setF({ ...f, programId: e.target.value })}>
            <option value="">เลือกสาขา…</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{LEVEL_LABEL[p.level]} {p.name}</option>)}
          </select>
        </Labeled>
        <div className="grid grid-cols-3 gap-2">
          <Labeled label="ปีที่เข้า (พ.ศ.)"><Input inputMode="numeric" value={f.entryYear} onChange={(e) => setF({ ...f, entryYear: Number(e.target.value) || 0 })} /></Labeled>
          <Labeled label="ชั้นปี"><select className={selectCls} value={f.yearLevel} onChange={(e) => setF({ ...f, yearLevel: Number(e.target.value) })}>{[1, 2, 3].map((n) => <option key={n} value={n}>ปี {n}</option>)}</select></Labeled>
          <Labeled label="ชื่อห้อง"><Input value={f.groupNo} onChange={(e) => setF({ ...f, groupNo: e.target.value })} /></Labeled>
        </div>
        <Labeled label="รหัสกลุ่มเรียน (ตามที่ใช้ใน ศธ.02 เช่น 693190901)"><Input inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.trim() })} className="tabular-nums" /></Labeled>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button loading={busy} disabled={!f.programId || !f.code || !f.groupNo} onClick={() => void save()}>เพิ่มกลุ่มเรียน</Button></div>
      </div>
    </Dialog>
  );
}
