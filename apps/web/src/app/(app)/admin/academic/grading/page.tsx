'use client';

import {
  GRADE_MEANING, SECTION_STATUS_LABEL, SPECIAL_GRADES, entryGrade, gradeOutcome, parseScore,
  type BoardRow, type BoardView, type Grade, type SectionGradeStatus, type SpecialGrade, type TeachSectionDetail,
} from '@csis/shared';
import { CalendarClock, CheckCircle2, ClipboardList, Megaphone, Search, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState, GradePill, PageHeader } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { ThaiDateInput } from '@/components/ThaiDateInput';
import { SectionStatus, thaiDate, todayIso, windowText } from '@/components/grading';
import { Alert, Button, Card, Input, Spinner, Textarea, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { Labeled, selectCls } from '../shared';

type Filter = 'all' | 'noTeacher' | SectionGradeStatus;
const FILTERS: Filter[] = ['all', 'submitted', 'returned', 'none', 'draft', 'approved', 'published', 'noTeacher'];
const filterLabel = (f: Filter) => (f === 'all' ? 'ทั้งหมด' : f === 'noTeacher' ? 'ยังไม่มีครูผู้สอน' : SECTION_STATUS_LABEL[f]);

export default function GradingBoard() {
  const [termId, setTermId] = useState<string>();
  const board = useApi<BoardView>(`/admin/grading/board${termId ? `?termId=${termId}` : ''}`);
  const teachers = useApi<{ id: string; name: string }[]>('/admin/grading/teachers').data ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger' | 'warn'; text: string } | null>(null);
  const [bulk, setBulk] = useState<'approve' | 'publish' | null>(null);

  useEffect(() => { setPicked(new Set()); }, [termId, filter]);
  const rows = useMemo(() => board.data?.rows ?? [], [board.data]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, noTeacher: 0, none: 0, draft: 0, submitted: 0, returned: 0, approved: 0, published: 0 };
    for (const r of rows) { c[r.status] += 1; if (!r.teacherUserId) c.noTeacher += 1; }
    return c;
  }, [rows]);
  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'noTeacher' ? !r.teacherUserId : r.status === filter))
    .filter((r) => !q.trim() || `${r.subject.code} ${r.subject.name} ${r.teacher} ${r.className}`.toLowerCase().includes(q.trim().toLowerCase()));

  if (board.error) return <Alert>{board.error}</Alert>;
  if (!board.data) return <Spinner />;
  const data = board.data;
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const bulkAction = pickedRows.length && pickedRows.every((r) => r.status === 'submitted') ? 'approve' : pickedRows.length && pickedRows.every((r) => r.status === 'approved') ? 'publish' : null;
  const selectable = (r: BoardRow) => r.status === 'submitted' || r.status === 'approved';
  const toggle = (id: string) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="ส่งผลการเรียน" subtitle="ติดตามครูส่งผล ตรวจ แล้วอนุมัติและประกาศให้นักเรียนเห็น (ขั้นตอนเดียวกับ ศธ.02)"
        actions={data.terms.length > 0 && (
          <Labeled label="ภาคเรียน">
            <select className={selectCls} value={data.term?.id} onChange={(e) => setTermId(e.target.value)}>
              {data.terms.map((t) => <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (ปัจจุบัน)' : ''}</option>)}
            </select>
          </Labeled>
        )} />

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {data.term && <WindowCard termId={data.term.id} window={data.window} onSaved={() => void board.reload()} />}

      {rows.length === 0 ? (
        <Card><EmptyState icon={<ClipboardList className="size-7" aria-hidden="true" />} title="ภาคนี้ยังไม่มีรายวิชา">นำเข้าตารางเรียนก่อน รายวิชาจะขึ้นที่นี่</EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid gap-3 border-b border-line/80 p-3">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองตามสถานะ">
              {FILTERS.map((f) => (
                <button key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                  className={cx('min-h-10 rounded-full px-3.5 text-[15px] ring-1', filter === f ? 'bg-brand-deep font-medium text-ink-inverse ring-brand-deep' : 'bg-surface text-ink-muted ring-line hover:text-ink', f === 'submitted' && counts.submitted > 0 && filter !== f && 'ring-gold text-gold-ink')}>
                  {filterLabel(f)} <span className="tabular-nums">({counts[f]})</span>
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัสวิชา ชื่อวิชา ครู หรือห้อง" aria-label="ค้นหารายวิชา" className="min-h-11 pl-9" />
            </div>
          </div>

          {pickedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line/80 bg-brand-soft px-4 py-2.5">
              <span className="text-[15px] font-medium">เลือก {pickedRows.length} วิชา</span>
              {bulkAction ? (
                <Button className="ml-auto" onClick={() => setBulk(bulkAction)} icon={bulkAction === 'approve' ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Megaphone className="size-4" aria-hidden="true" />}>
                  {bulkAction === 'approve' ? 'อนุมัติวิชาที่เลือก' : 'ประกาศวิชาที่เลือก'}
                </Button>
              ) : <span className="ml-auto text-sm text-ink-muted">เลือกวิชาสถานะเดียวกัน (ส่งแล้ว หรือ อนุมัติแล้ว) เพื่อทำพร้อมกัน</span>}
              <Button variant="ghost" onClick={() => setPicked(new Set())}>ล้างที่เลือก</Button>
            </div>
          )}

          {shown.length === 0 ? <p className="px-4 py-10 text-center text-ink-muted">ไม่มีรายวิชาในกลุ่มนี้</p> : (
            <ul className="divide-y divide-line/70">
              {shown.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <input type="checkbox" className="mt-1.5 size-5 shrink-0 accent-[var(--color-brand)] disabled:opacity-30" checked={picked.has(r.id)} disabled={!selectable(r)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.subject.code}`} />
                  <button type="button" onClick={() => setOpen(r.id)} className="grid min-w-0 flex-1 gap-1 text-left sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                    <span className="min-w-0">
                      <span className="block font-medium">{r.subject.name} <span className="font-normal tabular-nums text-ink-muted">{r.subject.code}</span></span>
                      <span className="block text-sm text-ink-muted">{r.className} · {r.teacherUserId ? r.teacher : <span className="font-medium text-danger">ยังไม่มีครูผู้สอน{r.teacher ? ` (ในไฟล์: ${r.teacher})` : ''}</span>}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="text-sm tabular-nums text-ink-muted">{r.graded}/{r.students} คน</span>
                      <SectionStatus status={r.status} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {open && <SectionDialog id={open} teachers={teachers} onClose={() => setOpen(null)} onChanged={(text) => { setMsg({ tone: 'ok', text }); void board.reload(); }} />}
      {bulk && <BulkDialog action={bulk} rows={pickedRows} onClose={() => setBulk(null)}
        onDone={(r) => { setBulk(null); setPicked(new Set()); setMsg({ tone: r.skipped ? 'warn' : 'ok', text: `${bulk === 'approve' ? 'อนุมัติ' : 'ประกาศ'}แล้ว ${r.done} วิชา${r.skipped ? ` · ข้าม ${r.skipped} วิชา (สถานะเปลี่ยนไปแล้ว)` : ''}` }); void board.reload(); }} />}
    </div>
  );
}

function WindowCard({ termId, window: w, onSaved }: { termId: string; window: BoardView['window']; onSaved: () => void }) {
  const [open, setOpen] = useState(w.gradeOpenAt ?? '');
  const [due, setDue] = useState(w.gradeDueAt ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setOpen(w.gradeOpenAt ?? ''); setDue(w.gradeDueAt ?? ''); }, [w.gradeOpenAt, w.gradeDueAt]);
  const info = windowText(w);
  const changed = open !== (w.gradeOpenAt ?? '') || due !== (w.gradeDueAt ?? '');
  async function save() {
    setBusy(true); setErr('');
    try { await api.patch(`/admin/grading/terms/${termId}/window`, { gradeOpenAt: open || null, gradeDueAt: due || null }); onSaved(); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <div className="mr-auto grid gap-0.5">
        <p className="flex items-center gap-2 font-medium"><CalendarClock className="size-5 text-brand" aria-hidden="true" />ช่วงวันที่ครูส่งผล</p>
        <p className="text-sm text-ink-muted">{info ? `${info.text} · ${info.left}` : 'ยังไม่กำหนด — ครูส่งได้ตลอด ระบบไม่ล็อก แต่จะเตือนครูเมื่อใกล้กำหนด'}</p>
      </div>
      <ThaiDateInput label="เริ่ม" value={open} onChange={setOpen} allowEmpty />
      <ThaiDateInput label="วันสุดท้าย" value={due} onChange={setDue} allowEmpty />
      <Button variant="secondary" onClick={() => void save()} loading={busy} disabled={!changed}>บันทึกช่วงวัน</Button>
      {err && <p className="w-full text-sm text-danger">{err}</p>}
    </Card>
  );
}

function BulkDialog({ action, rows, onClose, onDone }: { action: 'approve' | 'publish'; rows: BoardRow[]; onClose: () => void; onDone: (r: { done: number; skipped: number }) => void }) {
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go() {
    setBusy(true); setErr('');
    try { onDone(await api.post<{ done: number; skipped: number }>(`/admin/grading/bulk/${action}`, { sectionIds: rows.map((r) => r.id), date })); } catch (e) { setErr(errorMessage(e)); setBusy(false); }
  }
  return (
    <Dialog open onClose={onClose} title={action === 'approve' ? `อนุมัติ ${rows.length} วิชา` : `ประกาศผล ${rows.length} วิชา`}>
      <div className="grid gap-4">
        <ul className="max-h-48 overflow-y-auto rounded-md bg-sunken/60 p-3 text-[15px]">{rows.map((r) => <li key={r.id}><span className="tabular-nums">{r.subject.code}</span> {r.subject.name} · {r.className}</li>)}</ul>
        <ThaiDateInput label={action === 'approve' ? 'วันที่ผู้บริหารลงนามอนุมัติ' : 'วันที่ในหนังสือประกาศผล'} value={date} onChange={setDate} />
        <p className="text-[15px] text-ink-muted">{action === 'approve' ? 'อนุมัติแล้วนักเรียนยังไม่เห็น จนกว่าจะกดประกาศ' : 'ประกาศแล้วนักเรียนเห็นเกรดทันที (ยกเลิกประกาศได้ภายหลัง)'}</p>
        {err && <Alert>{err}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button onClick={() => void go()} loading={busy} disabled={!date}>{action === 'approve' ? 'อนุมัติ' : 'ประกาศผล'}</Button></div>
      </div>
    </Dialog>
  );
}

interface Change { id: string; at: string; studentCode: string; name: string; fromGrade: string; toGrade: string; reason: string; by: string }

function SectionDialog({ id, teachers, onClose, onChanged }: { id: string; teachers: { id: string; name: string }[]; onClose: () => void; onChanged: (msg: string) => void }) {
  const d = useApi<TeachSectionDetail & { teacherUserId?: string | null }>(`/admin/grading/sections/${id}`);
  const board = d.data;
  const records = useApi<Record<string, string>>(board && (board.status === 'approved' || board.status === 'published') ? `/admin/grading/sections/${id}/records` : null);
  const changes = useApi<Change[]>(`/admin/grading/sections/${id}/changes`);
  const [mode, setMode] = useState<'' | 'return' | 'approve' | 'publish'>('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [teacher, setTeacher] = useState('');
  const [edit, setEdit] = useState<{ studentId: string; name: string; score: string; special: SpecialGrade | ''; reason: string } | null>(null);

  async function run(path: string, body: unknown, text: string, method: 'post' | 'patch' = 'post') {
    setBusy(true); setErr('');
    try { await api[method](path, body); onChanged(text); setMode(''); setEdit(null); await Promise.all([d.reload(), changes.reload(), records.reload()]); } catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  }

  const s = d.data;
  const title = s ? `${s.subject.code} ${s.subject.name}` : 'รายวิชา';
  const editPreview = edit ? entryGrade({ score: parseScore(edit.score) ?? null, special: edit.special || null }) : null;

  return (
    <Dialog open onClose={onClose} title={title} xl>
      {d.error ? <Alert>{d.error}</Alert> : !s ? <Spinner /> : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 text-[15px] text-ink-muted">
            <SectionStatus status={s.status} /><span>{s.className} · ภาค {s.term.label} · กรอกแล้ว {s.graded}/{s.students} คน</span>
            {s.submittedAt && <span>· ส่งเมื่อ {thaiDate(s.submittedAt.slice(0, 10))}</span>}
          </div>
          {err && <Alert>{err}</Alert>}

          {(s.status === 'none' || s.status === 'draft' || s.status === 'returned') && (
            <div className="flex flex-wrap items-end gap-2 rounded-md bg-sunken/60 p-3">
              <Labeled label="ครูผู้สอน (คนที่กรอกเกรดวิชานี้)">
                <select className={cx(selectCls, 'min-w-64')} value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                  <option value="">เลือกครู…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Labeled>
              <Button variant="secondary" disabled={!teacher} loading={busy} onClick={() => void run(`/admin/grading/sections/${id}/teacher`, { teacherUserId: teacher }, 'กำหนดครูผู้สอนแล้ว', 'patch')}>บันทึกครูผู้สอน</Button>
              {teachers.length === 0 && <p className="w-full text-sm text-ink-muted">ยังไม่มีบัญชีครูที่ใช้งานอยู่ — เพิ่มที่หน้า ผู้ดูแลระบบ › ผู้ใช้งาน (บทบาท “ครูผู้สอน”)</p>}
            </div>
          )}

          <div className="max-h-[45vh] overflow-auto rounded-md ring-1 ring-line/70">
            <table className="w-full text-[15px]">
              <thead className="sticky top-0 bg-sunken text-left text-sm text-ink-muted"><tr><th className="px-3 py-2 font-medium">นักเรียน</th><th className="px-3 py-2 text-right font-medium">คะแนน</th><th className="px-3 py-2 font-medium">เกรด</th>{records.data && <th className="px-3 py-2" />}</tr></thead>
              <tbody className="divide-y divide-line/70">
                {s.rows.map((r) => (
                  <tr key={r.studentId}>
                    <td className="px-3 py-2"><span className="tabular-nums text-sm text-ink-muted">{r.studentCode}</span> {r.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.score ?? '–'}</td>
                    <td className="px-3 py-2">{r.grade ? <span className="inline-flex items-center gap-2"><GradePill grade={r.grade} outcome={gradeOutcome(r.grade)} /><span className="text-sm text-ink-muted">{GRADE_MEANING[r.grade as Grade]}</span></span> : <span className="text-ink-muted">ยังไม่กรอก</span>}</td>
                    {records.data && <td className="px-3 py-2 text-right">{records.data[r.studentId] && <Button variant="ghost" onClick={() => setEdit({ studentId: r.studentId, name: r.name, score: r.score === null ? '' : String(r.score), special: r.special ?? '', reason: '' })}>แก้ไขผล</Button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {edit && records.data && (
            <div className="grid gap-3 rounded-md bg-warn-soft/60 p-3 ring-1 ring-warn/30">
              <p className="font-medium">แก้ไขผลการเรียนของ {edit.name}</p>
              <div className="flex flex-wrap items-end gap-2">
                <Labeled label="คะแนนรวม"><Input inputMode="decimal" className="w-28" value={edit.score} disabled={!!edit.special} onChange={(e) => setEdit({ ...edit, score: e.target.value })} /></Labeled>
                <Labeled label="หรือผลพิเศษ">
                  <select className={selectCls} value={edit.special} onChange={(e) => setEdit({ ...edit, special: e.target.value as SpecialGrade | '' })}>
                    <option value="">ไม่มี</option>{SPECIAL_GRADES.map((g) => <option key={g} value={g}>{g} · {GRADE_MEANING[g]}</option>)}
                  </select>
                </Labeled>
                <span className="pb-2 text-[15px]">เป็นเกรด {editPreview ? <GradePill grade={editPreview} outcome={gradeOutcome(editPreview)} /> : '–'}</span>
              </div>
              <Labeled label="เหตุผล (บันทึกไว้ในประวัติ เช่น อ้างเลขที่คำร้องขอแก้ไขผลการเรียน)"><Textarea rows={2} value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Labeled>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEdit(null)}>ยกเลิก</Button>
                <Button loading={busy} disabled={!editPreview || edit.reason.trim().length < 5}
                  onClick={() => void run(`/admin/grading/records/${records.data![edit.studentId]}`, { score: edit.special ? null : (parseScore(edit.score) ?? null), special: edit.special || null, reason: edit.reason }, `แก้ไขผลของ ${edit.name} แล้ว`, 'patch')}>บันทึกการแก้ไข</Button>
              </div>
            </div>
          )}

          {mode === 'return' && (
            <div className="grid gap-2 rounded-md bg-warn-soft/60 p-3 ring-1 ring-warn/30">
              <Labeled label="บอกครูว่าต้องแก้อะไร (ครูจะเห็นข้อความนี้)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Labeled>
              <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setMode('')}>ยกเลิก</Button><Button loading={busy} disabled={note.trim().length < 3} onClick={() => void run(`/admin/grading/sections/${id}/return`, { note }, 'ส่งคืนครูแล้ว')}>ส่งคืนให้ครูแก้</Button></div>
            </div>
          )}
          {(mode === 'approve' || mode === 'publish') && (
            <div className="flex flex-wrap items-end gap-2 rounded-md bg-ok-soft/60 p-3 ring-1 ring-ok/25">
              <ThaiDateInput label={mode === 'approve' ? 'วันที่ผู้บริหารลงนามอนุมัติ' : 'วันที่ในหนังสือประกาศผล'} value={date} onChange={setDate} />
              <p className="mr-auto text-sm text-ink-muted">{mode === 'approve' ? 'อนุมัติแล้วนักเรียนยังไม่เห็น' : 'ประกาศแล้วนักเรียนเห็นเกรดทันที'}</p>
              <Button variant="secondary" onClick={() => setMode('')}>ยกเลิก</Button>
              <Button loading={busy} disabled={!date} onClick={() => void run(`/admin/grading/sections/${id}/${mode}`, { date }, mode === 'approve' ? 'อนุมัติแล้ว' : 'ประกาศผลแล้ว')}>{mode === 'approve' ? 'อนุมัติ' : 'ประกาศผล'}</Button>
            </div>
          )}

          {!mode && !edit && (
            <div className="flex flex-wrap justify-end gap-2">
              {s.status === 'submitted' && <>
                <Button variant="secondary" onClick={() => setMode('return')} icon={<Undo2 className="size-4" aria-hidden="true" />}>ส่งคืนให้ครูแก้</Button>
                <Button onClick={() => setMode('approve')} icon={<CheckCircle2 className="size-4" aria-hidden="true" />}>อนุมัติผลการเรียน</Button>
              </>}
              {s.status === 'approved' && <>
                <Button variant="secondary" loading={busy} onClick={() => { if (window.confirm('ยกเลิกการอนุมัติ? วิชานี้จะกลับไปเป็น "ส่งแล้ว รอตรวจ"')) void run(`/admin/grading/sections/${id}/unapprove`, {}, 'ยกเลิกอนุมัติแล้ว'); }}>ยกเลิกอนุมัติ</Button>
                <Button onClick={() => setMode('publish')} icon={<Megaphone className="size-4" aria-hidden="true" />}>ประกาศผลการเรียน</Button>
              </>}
              {s.status === 'published' && <Button variant="secondary" loading={busy} onClick={() => { if (window.confirm('ยกเลิกประกาศ? นักเรียนจะไม่เห็นเกรดวิชานี้จนกว่าจะประกาศใหม่')) void run(`/admin/grading/sections/${id}/unpublish`, {}, 'ยกเลิกประกาศแล้ว'); }}>ยกเลิกประกาศ</Button>}
              {(s.status === 'none' || s.status === 'draft' || s.status === 'returned') && <p className="text-[15px] text-ink-muted">รอครูผู้สอนกรอกและยืนยันส่งผล</p>}
            </div>
          )}

          {changes.data && changes.data.length > 0 && (
            <details className="text-[15px]">
              <summary className="cursor-pointer font-medium">ประวัติการแก้ไขผล ({changes.data.length})</summary>
              <ul className="mt-2 grid gap-1 text-ink-muted">{changes.data.map((c) => <li key={c.id}>{thaiDate(c.at.slice(0, 10))} · {c.studentCode} {c.name}: {c.fromGrade} → {c.toGrade} · {c.reason} · โดย {c.by}</li>)}</ul>
            </details>
          )}
        </div>
      )}
    </Dialog>
  );
}
