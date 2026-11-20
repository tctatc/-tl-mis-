'use client';

import { LEVEL_LABEL, finalYear, formatGpa, type ClassGroupRow } from '@csis/shared';
import { CheckCircle2, GraduationCap, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { thaiDate, todayIso } from '@/components/grading';
import { ThaiDateInput } from '@/components/ThaiDateInput';
import { Alert, Button, Card, Spinner, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Labeled, selectCls } from '../../academic/shared';

interface Candidate {
  id: string; studentCode: string; name: string; status: string; graduationDate: string | null; hasCurriculum: boolean;
  ready: boolean; missing: string[]; creditsEarned: number; minCredits: number; gpax: number | null; reasons: string[];
}
interface Result { group: { id: string; code: string; label: string; isFinalYear: boolean }; students: Candidate[] }

export default function GraduationPage() {
  const groups = useApi<ClassGroupRow[]>('/admin/registry/groups?active=true');
  const finals = (groups.data ?? []).filter((g) => g.yearLevel >= finalYear(g.level));
  const [groupId, setGroupId] = useState('');
  useEffect(() => { if (!groupId && finals[0]) setGroupId(finals[0].id); }, [finals, groupId]);
  const data = useApi<Result>(groupId ? `/admin/registry/graduation/${groupId}` : null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  useEffect(() => { setPicked(new Set()); }, [groupId]);

  const students = data.data?.students ?? [];
  const pending = students.filter((s) => s.status !== 'graduated');
  const ready = pending.filter((s) => s.ready);
  const notReadyPicked = students.filter((s) => picked.has(s.id) && !s.ready).length;
  const toggle = (id: string) => setPicked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function approve() {
    const extra = notReadyPicked ? `\n\nมี ${notReadyPicked} คนที่ระบบตรวจว่ายังไม่ครบ — แน่ใจว่าตรวจกับเอกสารแล้ว?` : '';
    if (!window.confirm(`อนุมัติสำเร็จการศึกษา ${picked.size} คน ลงวันที่ ${thaiDate(date)}?${extra}`)) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.post<{ graduated: number }>('/admin/registry/graduation', { studentIds: [...picked], date });
      setPicked(new Set()); setMsg({ tone: 'ok', text: `อนุมัติสำเร็จการศึกษาแล้ว ${r.graduated} คน` }); await data.reload();
    } catch (e) { setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(false); }
  }
  async function undo(s: Candidate) {
    if (!window.confirm(`ยกเลิกการอนุมัติจบของ ${s.name}? สถานะจะกลับเป็น "กำลังศึกษา"`)) return;
    setBusy(true); setMsg(null);
    try { await api.post(`/admin/registry/graduation/${s.id}/undo`); setMsg({ tone: 'ok', text: `ยกเลิกการอนุมัติจบของ ${s.name} แล้ว` }); await data.reload(); }
    catch (e) { setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="สำเร็จการศึกษา" subtitle="ตรวจนักเรียนชั้นปีสุดท้ายทีละกลุ่ม แล้วอนุมัติสำเร็จการศึกษา" />
      <Alert tone="warn">
        <span className="inline-flex gap-2"><TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>ระบบตรวจเบื้องต้น 3 ข้อ: ผ่านทุกวิชาในแผนการเรียน, หน่วยกิตถึงขั้นต่ำของหลักสูตร และเกรดเฉลี่ยสะสมอย่างน้อย 2.00 · ยังไม่ตรวจหน่วยกิตรายหมวดและวิชาเลือก ให้ตรวจซ้ำกับ ศธ.02 ก่อนอนุมัติ</span></span>
      </Alert>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {!groups.data ? <Spinner /> : finals.length === 0 ? (
        <Card><EmptyState icon={<GraduationCap className="size-7" aria-hidden="true" />} title="ยังไม่มีกลุ่มชั้นปีสุดท้าย">กลุ่ม ปวช.3 และ ปวส.2 จะขึ้นที่นี่</EmptyState></Card>
      ) : (
        <>
          <Labeled label="กลุ่มเรียนชั้นปีสุดท้าย">
            <select className={cx(selectCls, 'w-full max-w-xl min-w-0')} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {finals.map((g) => <option key={g.id} value={g.id}>{g.code} · {LEVEL_LABEL[g.level]} {g.program} ปี {g.yearLevel} ห้อง {g.groupNo} ({g.students} คน)</option>)}
            </select>
          </Labeled>

          {data.error ? <Alert>{data.error}</Alert> : !data.data ? <Spinner /> : (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-end gap-3 border-b border-line/80 px-4 py-3">
                <p className="mr-auto text-[15px]">ครบตามเกณฑ์ <strong className="tabular-nums">{ready.length}</strong> จาก {pending.length} คนที่ยังไม่อนุมัติ
                  {ready.length > 0 && <button type="button" className="ml-3 text-brand underline underline-offset-2" onClick={() => setPicked(new Set(ready.map((s) => s.id)))}>เลือกทุกคนที่ครบ</button>}</p>
                <ThaiDateInput label="วันที่อนุมัติสำเร็จการศึกษา" value={date} onChange={setDate} />
                <Button className="min-h-12 text-[16px]" disabled={!picked.size || !date} loading={busy} onClick={() => void approve()} icon={<CheckCircle2 className="size-5" aria-hidden="true" />}>อนุมัติ {picked.size ? `${picked.size} คน` : ''}</Button>
              </div>
              {students.length === 0 ? <p className="p-6 text-center text-ink-muted">กลุ่มนี้ไม่มีนักเรียน</p> : (
                <ul className="divide-y divide-line/70">
                  {students.map((s) => (
                    <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                      <input type="checkbox" className="mt-1 size-5 accent-[var(--color-brand)] disabled:opacity-30" checked={picked.has(s.id)} disabled={s.status === 'graduated'} onChange={() => toggle(s.id)} aria-label={`เลือก ${s.name}`} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.name} <span className="font-normal tabular-nums text-ink-muted">{s.studentCode}</span></p>
                        <p className="text-sm tabular-nums text-ink-muted">หน่วยกิต {s.creditsEarned}/{s.minCredits || '–'} · เกรดเฉลี่ยสะสม {formatGpa(s.gpax)}</p>
                        {s.status !== 'graduated' && !s.ready && (
                          <ul className="mt-1 grid gap-0.5 text-sm text-warn">
                            {!s.hasCurriculum && <li>ยังไม่ได้ผูกหลักสูตร — ตรวจแผนการเรียนไม่ได้</li>}
                            {s.reasons.map((r) => <li key={r}>{r}</li>)}
                            {s.missing.length > 0 && <li className="text-ink-muted">วิชาที่ยังไม่ผ่าน: {s.missing.slice(0, 8).join(', ')}{s.missing.length > 8 ? ` และอีก ${s.missing.length - 8}` : ''}</li>}
                          </ul>
                        )}
                      </div>
                      {s.status === 'graduated' ? (
                        <span className="grid justify-items-end gap-1 text-sm">
                          <span className="inline-flex items-center gap-1 rounded-full bg-ok px-2.5 py-1 font-medium text-ink-inverse"><GraduationCap className="size-4" aria-hidden="true" />สำเร็จการศึกษา {s.graduationDate ? thaiDate(s.graduationDate) : ''}</span>
                          <button type="button" className="text-ink-muted underline underline-offset-2 hover:text-ink" onClick={() => void undo(s)}>ยกเลิก</button>
                        </span>
                      ) : s.ready ? <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-sm font-medium text-ok ring-1 ring-ok/30"><CheckCircle2 className="size-4" aria-hidden="true" />ครบตามเกณฑ์</span>
                        : <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-sm font-medium text-warn ring-1 ring-warn/30"><TriangleAlert className="size-4" aria-hidden="true" />ยังไม่ครบ</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
