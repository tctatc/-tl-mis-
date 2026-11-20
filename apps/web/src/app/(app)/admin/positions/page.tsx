'use client';

import { LEVEL_LABEL } from '@csis/shared';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/academic';
import { Alert, Button, Card, Input, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';

interface Position { key: string; title: string; holderName: string; userId: string | null; userName: string | null }
interface Program { id: string; name: string; level: 'pvc' | 'pvs'; department: string; headUserId: string | null; headName: string | null; students: number }
interface Staff { id: string; displayName: string }
const select = 'min-h-11 w-full rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';

export default function PositionsPage() {
  const positions = useApi<Position[]>('/admin/positions');
  const programs = useApi<Program[]>('/admin/programs');
  const staff = useApi<Staff[]>('/admin/staff-options').data ?? [];
  if (positions.error || programs.error) return <Alert>{positions.error || programs.error}</Alert>;
  if (!positions.data || !programs.data) return <Spinner />;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="ผู้ลงนามและหัวหน้าสาขา" subtitle="ใครพิจารณาคำร้องขั้นไหน · ชื่อในวงเล็บพิมพ์ใต้ช่องลงชื่อของแบบฟอร์ม" />
      <section aria-labelledby="pos-title" className="grid gap-3">
        <h2 id="pos-title" className="font-semibold">ตำแหน่งผู้ลงนาม</h2>
        <Card className="divide-y divide-line/70">{positions.data.map((p) => <PositionRow key={p.key} p={p} staff={staff} onSaved={positions.reload} />)}</Card>
      </section>
      <section aria-labelledby="head-title" className="grid gap-3">
        <h2 id="head-title" className="font-semibold">หัวหน้าสาขาวิชา <span className="text-sm font-normal text-ink-muted">(ลงความเห็นในคำร้องลาออก กลับเข้าเรียน ขอจบ)</span></h2>
        <Card className="divide-y divide-line/70">{programs.data.map((p) => <HeadRow key={p.id} p={p} staff={staff} onSaved={programs.reload} />)}</Card>
      </section>
    </div>
  );
}

function PositionRow({ p, staff, onSaved }: { p: Position; staff: Staff[]; onSaved: () => Promise<void> }) {
  const [userId, setUserId] = useState(p.userId ?? '');
  const [holderName, setHolderName] = useState(p.holderName);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const dirty = userId !== (p.userId ?? '') || holderName !== p.holderName;
  async function save() {
    setBusy(true);
    setMsg('');
    try { await api.put(`/admin/positions/${p.key}`, { userId: userId || null, holderName }); await onSaved(); setMsg('บันทึกแล้ว'); }
    catch (e) { setMsg(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-2 p-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
      <div><p className="font-medium">{p.title}</p>{!p.userId && <p className="text-sm text-warn">ยังไม่มีผู้พิจารณาในระบบ</p>}</div>
      <label className="grid gap-1 text-sm"><span className="text-ink-muted">บัญชีที่กดพิจารณา</span>
        <select className={select} value={userId} onChange={(e) => { setUserId(e.target.value); const s = staff.find((x) => x.id === e.target.value); if (s && !holderName) setHolderName(s.displayName); }}>
          <option value="">— ยังไม่กำหนด —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm"><span className="text-ink-muted">ชื่อที่พิมพ์ในแบบฟอร์ม</span><Input value={holderName} maxLength={80} onChange={(e) => setHolderName(e.target.value)} /></label>
      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} loading={busy} disabled={!dirty} icon={<Check className="size-4" aria-hidden="true" />}>บันทึก</Button>
        {msg && <span className="text-sm text-ink-muted" role="status">{msg}</span>}
      </div>
    </div>
  );
}

function HeadRow({ p, staff, onSaved }: { p: Program; staff: Staff[]; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change(headUserId: string) {
    setBusy(true);
    setError('');
    try { await api.put(`/admin/programs/${p.id}/head`, { headUserId: headUserId || null }); await onSaved(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] sm:items-center">
      <div><p className="font-medium">{LEVEL_LABEL[p.level]} {p.name}</p><p className="text-sm text-ink-muted">{p.department} · นักเรียน {p.students} คน</p>{error && <p className="text-sm text-danger">{error}</p>}</div>
      <select aria-label={`หัวหน้าสาขา ${p.name}`} className={select} disabled={busy} value={p.headUserId ?? ''} onChange={(e) => void change(e.target.value)}>
        <option value="">— ยังไม่กำหนด —</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.displayName}</option>)}
      </select>
    </div>
  );
}
