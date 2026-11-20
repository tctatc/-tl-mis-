'use client';

import { LEVEL_LABEL, formatThaiDateTime, type ClassGroupRow } from '@csis/shared';
import { ArrowRight, GraduationCap, History, MoveUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { Alert, Button, Card, Spinner, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';

type Row = ClassGroupRow & { nextYear: number | null; finalYear: number };
interface Batch { id: string; academicYear: number; at: string; by: string; groups: number; students: number; undoneAt: string | null; undoneBy: string | null }

/** ปีการศึกษาที่เพิ่งจบ: เลื่อนชั้นมักทำช่วงปิดภาคปลาย (มี.ค.–พ.ค.) */
const finishedYear = () => { const d = new Date(); return d.getFullYear() + 543 - (d.getMonth() < 5 ? 1 : 0); };

export default function PromotionPage() {
  const list = useApi<Row[]>('/admin/registry/promotion');
  const history = useApi<Batch[]>('/admin/registry/promotion/history');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const year = finishedYear();

  const rows = useMemo(() => list.data ?? [], [list.data]);
  const promotable = rows.filter((r) => r.nextYear !== null && r.students > 0);
  const chosen = rows.filter((r) => picked.has(r.id));
  const allOn = promotable.length > 0 && promotable.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function promote() {
    setBusy(true); setMsg(null);
    try {
      const r = await api.post<{ groups: number; students: number }>('/admin/registry/promotion', { groupIds: [...picked], academicYear: year });
      setConfirm(false); setPicked(new Set());
      setMsg({ tone: 'ok', text: `เลื่อนชั้นแล้ว ${r.groups} กลุ่ม นักเรียน ${r.students} คน — ถ้าผิด กด “ยกเลิกการเลื่อนชั้น” ในประวัติด้านล่างได้` });
      await Promise.all([list.reload(), history.reload()]);
    } catch (e) { setConfirm(false); setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  async function undo(id: string) {
    if (!window.confirm('ยกเลิกการเลื่อนชั้นรายการนี้? ชั้นปีของกลุ่มและนักเรียนจะกลับไปเหมือนก่อนเลื่อน')) return;
    setBusy(true); setMsg(null);
    try { await api.post(`/admin/registry/promotion/${id}/undo`); setMsg({ tone: 'ok', text: 'ยกเลิกการเลื่อนชั้นแล้ว' }); await Promise.all([list.reload(), history.reload()]); }
    catch (e) { setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="เลื่อนชั้น" subtitle={`ทำหลังจบปีการศึกษา ${year} · เลือกกลุ่มที่จะเลื่อน แล้วกดเลื่อนชั้น นักเรียนที่กำลังศึกษาในกลุ่มจะขึ้นชั้นปีถัดไปพร้อมกัน`} />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {list.error ? <Alert>{list.error}</Alert> : !list.data ? <Spinner /> : rows.length === 0 ? (
        <Card><EmptyState icon={<MoveUp className="size-7" aria-hidden="true" />} title="ยังไม่มีกลุ่มเรียน">สร้างกลุ่มเรียนที่แท็บ “กลุ่มเรียน” ก่อน</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line/80 px-4 py-3">
            <label className="flex min-h-11 items-center gap-2 text-[15px]">
              <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={allOn} disabled={!promotable.length} onChange={() => setPicked(allOn ? new Set() : new Set(promotable.map((r) => r.id)))} />
              เลือกทุกกลุ่มที่เลื่อนได้ ({promotable.length})
            </label>
            <Button className="ml-auto min-h-12 text-[16px]" disabled={!chosen.length} onClick={() => setConfirm(true)} icon={<MoveUp className="size-5" aria-hidden="true" />}>เลื่อนชั้น {chosen.length ? `${chosen.length} กลุ่ม` : ''}</Button>
          </div>
          <ul className="divide-y divide-line/70">
            {rows.map((r) => {
              const can = r.nextYear !== null && r.students > 0;
              return (
                <li key={r.id} className={cx('flex flex-wrap items-center gap-3 px-4 py-3', !can && 'bg-sunken/40')}>
                  <input type="checkbox" className="size-5 accent-[var(--color-brand)] disabled:opacity-30" checked={picked.has(r.id)} disabled={!can} onChange={() => toggle(r.id)} aria-label={`เลือกกลุ่ม ${r.code}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{LEVEL_LABEL[r.level]} {r.program} ห้อง {r.groupNo} <span className="font-normal tabular-nums text-ink-muted">· {r.code} · {r.students} คน</span></p>
                  </div>
                  {r.nextYear !== null ? (
                    <span className="inline-flex items-center gap-2 text-[16px] tabular-nums">ปี {r.yearLevel}<ArrowRight className="size-4 text-ink-muted" aria-hidden="true" /><strong>ปี {r.nextYear}</strong></span>
                  ) : (
                    <Link href="/admin/registry/graduation" className="inline-flex items-center gap-1.5 text-[15px] text-ok underline-offset-2 hover:underline"><GraduationCap className="size-4" aria-hidden="true" />ปีสุดท้าย · ตรวจสำเร็จการศึกษา</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {history.data && history.data.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold"><History className="size-5 text-ink-muted" aria-hidden="true" />ประวัติการเลื่อนชั้น</h2>
          <ul className="divide-y divide-line/70 text-[15px]">
            {history.data.map((b, i) => (
              <li key={b.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="flex-1">ปีการศึกษา {b.academicYear} · {b.groups} กลุ่ม {b.students} คน · {formatThaiDateTime(b.at)} · โดย {b.by}
                  {b.undoneAt && <span className="text-warn"> · ยกเลิกแล้ว ({b.undoneBy})</span>}</span>
                {!b.undoneAt && i === history.data!.findIndex((x) => !x.undoneAt) && <Button variant="secondary" loading={busy} onClick={() => void undo(b.id)}>ยกเลิกการเลื่อนชั้น</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={`เลื่อนชั้น ${chosen.length} กลุ่ม`}>
        <div className="grid gap-4 text-[16px]">
          <ul className="max-h-56 overflow-y-auto rounded-md bg-sunken/60 p-3 text-[15px]">
            {chosen.map((r) => <li key={r.id}>{r.code} · {LEVEL_LABEL[r.level]} {r.program} ห้อง {r.groupNo}: ปี {r.yearLevel} → <strong>ปี {r.nextYear}</strong> ({r.students} คน)</li>)}
          </ul>
          <p className="text-ink-muted">นักเรียนที่ลาออก/พ้นสภาพไม่ถูกเลื่อน · ยกเลิกได้ภายหลังจากประวัติการเลื่อนชั้น</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" className="min-h-12" onClick={() => setConfirm(false)}>ยกเลิก</Button>
            <Button className="min-h-12" loading={busy} onClick={() => void promote()}>ยืนยันเลื่อนชั้น</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
