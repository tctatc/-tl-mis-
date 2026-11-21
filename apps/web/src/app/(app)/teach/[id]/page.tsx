'use client';

import {
  GRADE_CRITERIA, GRADE_MEANING, SPECIAL_GRADES, canTeacherEdit, entryGrade, gradeOutcome, parseScore,
  type Grade, type SpecialGrade, type TeachSectionDetail,
} from '@csis/shared';
import { ArrowLeft, Download, FileUp, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GradePill } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { SectionStatus, thaiDate, windowText } from '@/components/grading';
import { Alert, Button, Card, Spinner, cx } from '@/components/ui';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useConfirm } from '@/components/feedback';

interface Draft { studentId: string; studentCode: string; name: string; scoreText: string; special: SpecialGrade | '' }
interface ParseResult { rows: { studentId: string; score: number | null; special: SpecialGrade | null }[]; issues: { rowNo: number; message: string }[]; matched: number; total: number }

const fromDetail = (d: TeachSectionDetail): Draft[] => d.rows.map((r) => ({ studentId: r.studentId, studentCode: r.studentCode, name: r.name, scoreText: r.score === null ? '' : String(r.score), special: r.special ?? '' }));
const sameRows = (a: Draft[], b: Draft[]) => a.length === b.length && a.every((r, i) => r.scoreText.trim() === b[i]!.scoreText.trim() && r.special === b[i]!.special);
const timeNow = () => new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }).format(new Date());

export default function GradeEntryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const ask = useConfirm();
  const { data, error, reload } = useApi<TeachSectionDetail>(`/teach/sections/${id}`);
  const [rows, setRows] = useState<Draft[]>([]);
  const [saved, setSaved] = useState<Draft[]>([]);
  const [savedAt, setSavedAt] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'submit' | 'upload'>('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger' | 'info'; text: string } | null>(null);
  const [upload, setUpload] = useState<ParseResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!data) return;
    const d = fromDetail(data);
    setRows(d);
    setSaved(d);
  }, [data]);

  const editable = !!data && canTeacherEdit(data.status);
  const dirty = !sameRows(rows, saved);
  const checked = useMemo(() => rows.map((r) => {
    const score = parseScore(r.scoreText);
    const special = r.special || null;
    return { ...r, score, invalid: score === undefined && !special, grade: score === undefined && !special ? null : entryGrade({ score: score ?? null, special }) };
  }), [rows]);
  const filled = checked.filter((r) => r.grade).length;
  const invalid = checked.filter((r) => r.invalid).length;
  const complete = rows.length > 0 && filled === rows.length && invalid === 0;

  // ออกจากหน้าโดยยังไม่บันทึก → เตือน
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = useCallback(async () => {
    if (!data || invalid > 0) return;
    setBusy('save'); setMsg(null);
    try {
      await api.put(`/teach/sections/${id}/grades`, { rows: checked.map((r) => ({ studentId: r.studentId, score: r.special ? null : (r.score ?? null), special: r.special || null })) });
      setSaved(rows);
      setSavedAt(timeNow());
      setUpload(null);
      await reload();
    } catch (e) { setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(''); }
  }, [checked, data, id, invalid, reload, rows]);

  // Ctrl/⌘ + S = บันทึก
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, save]);

  async function submit() {
    setBusy('submit'); setMsg(null);
    try {
      await api.post(`/teach/sections/${id}/submit`);
      setConfirm(false);
      await reload();
      setMsg({ tone: 'ok', text: 'ส่งผลการเรียนแล้ว งานวัดผลจะตรวจและประกาศให้นักเรียนเห็น' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setConfirm(false); setMsg({ tone: 'danger', text: errorMessage(e) }); } finally { setBusy(''); }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy('upload'); setMsg(null);
    try {
      const r = await uploadFile<ParseResult>(`/teach/sections/${id}/parse`, file);
      const byId = new Map(r.rows.map((x) => [x.studentId, x]));
      setRows((cur) => cur.map((row) => {
        const x = byId.get(row.studentId);
        return x ? { ...row, scoreText: x.score === null ? '' : String(x.score), special: x.special ?? '' } : row;
      }));
      setUpload(r);
    } catch (e) { setMsg({ tone: 'danger', text: errorMessage(e) }); } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const update = (i: number, patch: Partial<Draft>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    const next = e.key === 'Enter' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    inputs.current[Math.max(0, Math.min(rows.length - 1, next))]?.focus();
    inputs.current[Math.max(0, Math.min(rows.length - 1, next))]?.select();
  };
  const leave = (e: MouseEvent) => {
    if (!dirty) return;
    e.preventDefault();
    void ask({ title: 'ยังไม่ได้บันทึกคะแนน', message: 'ออกจากหน้านี้ตอนนี้ คะแนนที่กรอกไว้จะหายไป', confirmLabel: 'ออกโดยไม่บันทึก', cancelLabel: 'อยู่ต่อ', tone: 'danger' })
      .then((ok) => { if (ok) router.push('/teach'); });
  };

  if (error) return <div className="grid gap-4"><BackLink onClick={leave} /><Alert>{error}</Alert></div>;
  if (!data) return <Spinner />;

  const due = windowText(data.window);
  const dist = Object.entries(checked.reduce<Record<string, number>>((acc, r) => { if (r.grade) acc[r.grade] = (acc[r.grade] ?? 0) + 1; return acc; }, {}));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-4">
      <BackLink onClick={leave} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{data.subject.name}</h1>
          <p className="mt-1 text-[16px] text-ink-muted"><span className="tabular-nums">{data.subject.code}</span> · {data.subject.credits} หน่วยกิต · {data.className} · ภาคเรียน {data.term.label}</p>
        </div>
        <SectionStatus status={data.status} className="text-[15px]" />
      </header>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {data.status === 'returned' && data.returnNote && <Alert tone="warn"><strong>งานวัดผลส่งคืนให้แก้:</strong> {data.returnNote}</Alert>}
      {!editable && msg?.tone !== 'ok' && (
        <Alert tone="info">
          ส่งผลแล้ว{data.submittedAt ? `เมื่อ ${thaiDate(data.submittedAt.slice(0, 10))}` : ''} · แก้ไขในหน้านี้ไม่ได้แล้ว ถ้าพบว่าผิด ให้แจ้งงานวัดผลส่งคืนมาแก้
        </Alert>
      )}
      {editable && due && <p className={cx('text-[15px]', due.late ? 'text-danger' : 'text-ink-muted')}>{due.text} · {due.left}</p>}

      {editable && (
        <Card className="grid gap-3 p-4 sm:flex sm:flex-wrap sm:items-center">
          <p className="text-[15px] text-ink-muted sm:mr-auto">กรอกในตารางด้านล่าง หรือใช้ไฟล์ Excel ที่มีรายชื่อนักเรียนไว้ให้แล้ว</p>
          <a href={`/api/teach/sections/${id}/template.xlsx`} download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-surface px-4 text-[16px] font-medium ring-1 ring-line-strong hover:bg-sunken">
            <Download className="size-5" aria-hidden="true" />ดาวน์โหลดไฟล์ Excel
          </a>
          <Button variant="secondary" className="min-h-12 text-[16px]" loading={busy === 'upload'} onClick={() => fileRef.current?.click()} icon={<FileUp className="size-5" aria-hidden="true" />}>อัปโหลดคะแนนจาก Excel</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" className="sr-only" aria-label="เลือกไฟล์คะแนน" onChange={(e) => void onFile(e.target.files?.[0])} />
        </Card>
      )}

      {upload && (
        <Alert tone={upload.issues.length ? 'warn' : 'info'}>
          <p><strong>เติมคะแนนจากไฟล์แล้ว {upload.matched} คน</strong> — ตรวจในตารางแล้วกด “บันทึก” (ยังไม่ได้บันทึก)</p>
          {upload.issues.length > 0 && (
            <ul className="mt-1.5 grid gap-0.5 text-[15px]">
              {upload.issues.slice(0, 8).map((x) => <li key={`${x.rowNo}-${x.message}`}>แถวที่ {x.rowNo}: {x.message}</li>)}
              {upload.issues.length > 8 && <li>และอีก {upload.issues.length - 8} แถว</li>}
            </ul>
          )}
        </Alert>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[16px]">
            <thead className="bg-sunken/60 text-left text-[15px] text-ink-muted">
              <tr>
                <th scope="col" className="w-12 px-3 py-3 text-center font-medium">ที่</th>
                <th scope="col" className="px-3 py-3 font-medium">นักเรียน</th>
                <th scope="col" className="w-36 px-3 py-3 font-medium">คะแนนรวม<span className="block text-xs font-normal">เต็ม 100</span></th>
                <th scope="col" className="w-40 px-3 py-3 font-medium">ผลพิเศษ<span className="block text-xs font-normal">ถ้าไม่มีคะแนน</span></th>
                <th scope="col" className="w-36 px-3 py-3 font-medium">เกรด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {checked.map((r, i) => (
                <tr key={r.studentId} className={cx(r.invalid && 'bg-danger-soft/60')}>
                  <td className="px-3 py-2.5 text-center tabular-nums text-ink-muted">{i + 1}</td>
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <span className="block font-medium">{r.name}</span>
                    <span className="text-sm tabular-nums text-ink-muted">{r.studentCode}</span>
                  </th>
                  <td className="px-3 py-2.5">
                    {editable ? (
                      <>
                        <input
                          ref={(el) => { inputs.current[i] = el; }}
                          inputMode="decimal" autoComplete="off"
                          aria-label={`คะแนนรวมของ ${r.name}`} aria-invalid={r.invalid || undefined}
                          aria-describedby={r.invalid ? `err-${r.studentId}` : undefined}
                          value={r.scoreText} disabled={!!r.special}
                          onChange={(e) => update(i, { scoreText: e.target.value })}
                          onKeyDown={(e) => move(e, i)}
                          onFocus={(e) => e.target.select()}
                          placeholder={r.special ? '–' : ''}
                          className={cx('h-12 w-28 rounded-[var(--radius-control)] bg-surface px-3 text-right text-[18px] tabular-nums ring-1 focus:outline-none focus:ring-2 disabled:bg-sunken disabled:text-ink-muted', r.invalid ? 'ring-danger focus:ring-danger' : 'ring-line-strong focus:ring-brand')}
                        />
                        {r.invalid && <span id={`err-${r.studentId}`} className="mt-1 block text-sm text-danger">ใส่ 0 ถึง 100</span>}
                      </>
                    ) : <span className="text-[18px] tabular-nums">{r.special ? '–' : r.scoreText || '–'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {editable ? (
                      <select aria-label={`ผลพิเศษของ ${r.name}`} value={r.special} onChange={(e) => update(i, { special: e.target.value as SpecialGrade | '' })}
                        className="h-12 w-full rounded-[var(--radius-control)] bg-surface px-2 text-[16px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand">
                        <option value="">ไม่มี</option>
                        {SPECIAL_GRADES.map((g) => <option key={g} value={g}>{g} · {GRADE_MEANING[g]}</option>)}
                      </select>
                    ) : <span>{r.special ? `${r.special} · ${GRADE_MEANING[r.special]}` : '–'}</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.grade ? (
                      <span className="inline-flex items-center gap-2">
                        <GradePill grade={r.grade} outcome={gradeOutcome(r.grade)} size="lg" />
                        <span className="text-sm text-ink-muted">{GRADE_MEANING[r.grade as Grade]}</span>
                      </span>
                    ) : <span className="text-ink-muted">ยังไม่กรอก</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <details className="rounded-[var(--radius-card)] bg-surface px-4 py-3 text-[15px] ring-1 ring-line/70">
        <summary className="cursor-pointer font-medium">เกณฑ์ตัดเกรดที่ระบบใช้</summary>
        <p className="mt-2 text-ink-muted tabular-nums">{GRADE_CRITERIA.map(([min, g], i) => (i === GRADE_CRITERIA.length - 1 ? `ต่ำกว่า 50 = ${g}` : `${min} ขึ้นไป = ${g}`)).join(' · ')}</p>
      </details>

      {editable && (
        <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-[var(--radius-card)] sm:border sm:shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="mr-auto text-[16px]" aria-live="polite">
              <p className="font-semibold tabular-nums">กรอกแล้ว {filled} จาก {rows.length} คน</p>
              <p className={cx('text-[15px]', dirty ? 'text-warn' : 'text-ink-muted')}>
                {invalid > 0 ? `มีคะแนนไม่ถูกต้อง ${invalid} คน` : dirty ? 'ยังไม่ได้บันทึก' : savedAt ? `บันทึกแล้ว เวลา ${savedAt} น.` : 'บันทึกแล้ว'}
              </p>
            </div>
            <Button variant="secondary" className="min-h-12 px-5 text-[16px]" onClick={() => void save()} loading={busy === 'save'} disabled={!dirty || invalid > 0} icon={<Save className="size-5" aria-hidden="true" />}>บันทึก</Button>
            <Button className="min-h-12 px-5 text-[16px]" onClick={() => setConfirm(true)} disabled={dirty || !complete || busy !== ''} icon={<Send className="size-5" aria-hidden="true" />}>ยืนยันส่งผลการเรียน</Button>
          </div>
          {!complete && !dirty && rows.length > 0 && <p className="mt-1.5 text-sm text-ink-muted">ส่งได้เมื่อกรอกครบทุกคน (นักเรียนที่ไม่มีคะแนนให้เลือกผลพิเศษ)</p>}
          {dirty && <p className="mt-1.5 text-sm text-ink-muted">กด “บันทึก” ก่อน แล้วจึงส่งผลได้ · กด Enter เพื่อไปช่องของคนถัดไป</p>}
        </div>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="ยืนยันส่งผลการเรียน">
        <div className="grid gap-4 text-[16px]">
          <p>ส่งผลวิชา <strong>{data.subject.code} {data.subject.name}</strong> ของนักเรียน {rows.length} คน</p>
          <div className="flex flex-wrap gap-2">
            {dist.sort((a, b) => b[1] - a[1]).map(([g, n]) => (
              <span key={g} className="inline-flex items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-[15px]"><GradePill grade={g} outcome={gradeOutcome(g)} /> {n} คน</span>
            ))}
          </div>
          <p className="text-ink-muted">หลังส่งแล้วจะแก้ในหน้านี้ไม่ได้ จนกว่างานวัดผลจะส่งคืนมาให้แก้</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" className="min-h-12 text-[16px]" onClick={() => setConfirm(false)}>กลับไปตรวจอีกครั้ง</Button>
            <Button className="min-h-12 text-[16px]" onClick={() => void submit()} loading={busy === 'submit'} icon={<Send className="size-5" aria-hidden="true" />}>ส่งผลการเรียน</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );

}

function BackLink({ onClick }: { onClick: (e: MouseEvent) => void }) {
  return <Link href="/teach" onClick={onClick} className="inline-flex min-h-11 w-fit items-center gap-1.5 text-[16px] text-ink-muted hover:text-ink"><ArrowLeft className="size-5" aria-hidden="true" />กลับไปรายการวิชา</Link>;
}
