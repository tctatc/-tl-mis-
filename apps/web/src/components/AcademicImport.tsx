'use client';

import { ACADEMIC_FIELDS, KIND_NEEDS_TERM, type AcademicKind, type AcademicMapping } from '@csis/shared';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Stat } from './academic';
import { Dialog } from './Dialog';
import { Alert, Button, Card, Spinner, cx } from './ui';
import { api, errorMessage, uploadFile } from '@/lib/api';

type Cell = string | number | null;
interface Uploaded { jobId: string; fileName: string; headers: string[]; rowCount: number; headerRowNo: number; encoding: string | null; sample: Cell[][]; mapping: AcademicMapping }
interface Preview {
  counts: { create: number; update: number; error: number }; warnings: number; term: string | null;
  groups: { label: string; count: number; note: string; warn: boolean }[];
  issues: { rowNo: number; key: string; columnLabel: string; message: string; level: 'error' | 'warning' }[];
  sample: { columns: string[]; rows: { rowNo: number; action: string; cells: string[] }[] };
}
interface Term { id: string; label: string; isCurrent: boolean }

const META: Record<AcademicKind, { name: string; note: string; groupTitle: string; done: (r: Record<string, number>) => string }> = {
  plan: { name: 'แผนการเรียน', note: 'ผูกกับสาขา · นักเรียนทุกคนในสาขาเห็นแผนเดียวกัน · วิชาที่มีอยู่แล้วจะอัปเดตปี/ภาค/หมวด', groupTitle: 'แยกตามสาขา',
    done: (r) => `บันทึก ${r.saved} วิชา ใน ${r.programs} สาขา` },
  schedule: { name: 'ตารางเรียน', note: 'ผูกกับห้อง (สาขา + ชั้นปี + ห้อง) · ระบบลงทะเบียนวิชาให้นักเรียนทุกคนในห้องเอง · ตารางเดิมของวิชาในห้องนั้นจะถูกแทนที่', groupTitle: 'แยกตามห้อง',
    done: (r) => `บันทึก ${r.sessions} คาบ ${r.sections} วิชา · ลงทะเบียนให้นักเรียน ${r.students} คน` },
  staff: { name: 'ครูและบุคลากร', note: 'จับคู่ด้วยรหัสบุคลากร (มีอยู่แล้ว = อัปเดต) · บัญชีใหม่จะ “ระงับ” ไว้ก่อน ผู้ดูแลเปิดใช้และตั้งรหัสผ่านให้ทีละคนที่หน้าผู้ใช้งาน', groupTitle: 'แยกตามแผนก — ตรวจว่าแผนกถูกต้อง',
    done: (r) => `เพิ่มใหม่ ${r.created} คน · อัปเดต ${r.updated} คน`, },
  grade: { name: 'ผลการเรียน', note: 'ผูกกับรหัสนักศึกษา · นำเข้าแล้วนักเรียนยังไม่เห็น จนกว่าจะกด “ประกาศผล”', groupTitle: 'แยกตามห้อง',
    done: (r) => `บันทึกเกรด ${r.saved} รายการ (ยังไม่ประกาศ)${r.unchanged ? ` · เหมือนเดิม ${r.unchanged}` : ''}` },
};
/** รายงานข้อผิดพลาดเป็น CSV (มี BOM ให้ Excel อ่านภาษาไทยถูก) — เอาไปแก้ในไฟล์ต้นฉบับแล้วนำเข้าใหม่ */
export function downloadIssues(issues: { rowNo: number; key: string; columnLabel: string; message: string; level: 'error' | 'warning' }[], name: string) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['แถวในไฟล์', 'รหัส', 'คอลัมน์', 'ระดับ', 'ปัญหา'], ...issues.map((i) => [String(i.rowNo), i.key, i.columnLabel, i.level === 'error' ? 'ผิดพลาด (ไม่นำเข้า)' : 'คำเตือน', i.message])];
  const blob = new Blob([`\uFEFF${rows.map((r) => r.map(esc).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `รายงานข้อผิดพลาด-${name.replace(/\.(xlsx|csv|txt)$/i, '')}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const cellText = (c: Cell) => (c === null ? '' : typeof c === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(c) ? c.slice(0, 10) : String(c));

/** นำเข้าแผนการเรียน/ตารางเรียน/ผลการเรียน: เลือกไฟล์ → จับคู่คอลัมน์ → ตรวจ → ยืนยัน */
export function AcademicImport({ kind, terms, defaultTermId, onCommitted, onClose }: { kind: AcademicKind; terms: Term[]; defaultTermId?: string; onCommitted: () => void; onClose: () => void }) {
  const meta = META[kind];
  const fields = ACADEMIC_FIELDS[kind];
  const needsTerm = KIND_NEEDS_TERM[kind];
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [up, setUp] = useState<Uploaded | null>(null);
  const [mapping, setMapping] = useState<AcademicMapping>({});
  const [termId, setTermId] = useState(defaultTermId ?? terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id ?? '');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [show, setShow] = useState<'error' | 'warning'>('error');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (defaultTermId) setTermId(defaultTermId); }, [defaultTermId]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  const onFile = (f: File) => run(async () => { const r = await uploadFile<Uploaded>(`/admin/academic/imports/${kind}`, f); setUp(r); setMapping(r.mapping); setStep('map'); });
  const check = () => run(async () => {
    const p = await api.post<Preview>(`/admin/academic/imports/${kind}/${up!.jobId}/preview`, { mapping, ...(needsTerm ? { termId } : {}) });
    setPreview(p); setShow(p.counts.error ? 'error' : 'warning'); setStep('review');
  });
  const commit = () => run(async () => {
    const r = await api.post<Record<string, number>>(`/admin/academic/imports/${kind}/${up!.jobId}/commit`);
    setResult(meta.done(r)); setConfirming(false); setStep('done'); onCommitted();
  });
  const restart = () => { setStep('upload'); setUp(null); setPreview(null); setError(''); };
  const total = preview ? preview.counts.create + preview.counts.update : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <p className="text-sm text-ink-muted">{meta.note}</p>
      {error && <Alert>{error}</Alert>}

      {step === 'upload' && (
        <>
          <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void onFile(f); }}
            className={cx('grid cursor-pointer place-items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-4 py-10 text-center transition-colors', over ? 'border-brand bg-brand-soft' : 'border-line-strong hover:bg-sunken/60')}>
            {busy ? <Spinner label="กำลังอ่านไฟล์" /> : (<>
              <UploadCloud className="size-10 text-brand" aria-hidden="true" />
              <span className="text-lg font-semibold">ลากไฟล์{meta.name}มาวาง หรือกดเพื่อเลือกไฟล์</span>
              <span className="text-sm text-ink-muted">.xlsx หรือ .csv · หัวตารางชื่ออะไรก็ได้ ระบบจะจับคู่ให้</span>
            </>)}
            <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-muted">ดาวน์โหลดแบบฟอร์มตัวอย่าง:</span>
            <a href={`/api/admin/academic/imports/${kind}/template.xlsx`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />Excel</a>
            <a href={`/api/admin/academic/imports/${kind}/template.csv`} className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />CSV</a>
          </div>
        </>
      )}

      {step === 'map' && up && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="size-5 text-ok" aria-hidden="true" />{up.fileName}</p>
              <p className="text-sm text-ink-muted">{up.rowCount.toLocaleString('th-TH')} แถว · หัวตารางแถวที่ {up.headerRowNo}{up.encoding ? ` · ${up.encoding}` : ''}</p>
            </div>
            <Button variant="ghost" onClick={restart} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>เลือกไฟล์ใหม่</Button>
          </div>
          {needsTerm && (
            <label className="flex flex-wrap items-center gap-2 text-[15px]">
              <span className="font-medium">ภาคเรียนของข้อมูลนี้</span>
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong">
                {terms.map((t) => <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (ปัจจุบัน)' : ''}</option>)}
              </select>
            </label>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted"><tr><th scope="col" className="py-2 pr-3 font-medium">ข้อมูลในระบบ</th><th scope="col" className="py-2 pr-3 font-medium">คอลัมน์ในไฟล์</th><th scope="col" className="py-2 font-medium">ตัวอย่างจากไฟล์</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {Object.entries(fields).map(([f, info]) => {
                  const idx = mapping[f];
                  return (
                    <tr key={f}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">{info.label}{info.required && <span className="text-danger"> *</span>}{info.hint && <span className="block text-xs text-ink-muted">{info.hint}</span>}</th>
                      <td className="py-2 pr-3">
                        <select aria-label={`คอลัมน์สำหรับ ${info.label}`} value={idx ?? ''} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value === '') delete n[f]; else n[f] = Number(e.target.value); return n; })}
                          className={cx('min-h-10 w-full min-w-44 rounded-[var(--radius-control)] bg-surface px-2 ring-1', idx !== undefined ? 'ring-ok/50' : 'ring-line-strong')}>
                          <option value="">— ไม่ใช้ —</option>
                          {up.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[20rem] truncate py-2 text-sm text-ink-muted">{idx === undefined ? '' : up.sample.slice(0, 3).map((r) => cellText(r[idx]!)).filter(Boolean).join(' · ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button onClick={() => void check()} loading={busy} disabled={needsTerm && !termId}>ตรวจข้อมูล {up.rowCount.toLocaleString('th-TH')} แถว</Button>
        </div>
      )}

      {step === 'review' && preview && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปผลตรวจ">
            <Stat tone="brand" label="จะเพิ่มใหม่" value={preview.counts.create} hint={preview.term ? `ภาค ${preview.term}` : 'รายการ'} />
            <Stat label="จะอัปเดต" value={preview.counts.update} hint="มีอยู่แล้ว" />
            <Stat label="ผิดพลาด (จะข้าม)" value={preview.counts.error} hint="แถว" tone={preview.counts.error ? 'warn' : 'default'} />
            <Stat label="คำเตือน" value={preview.warnings} hint="บันทึกได้ แต่ควรตรวจ" />
          </section>
          {preview.groups.length > 0 && (
            <Card className="overflow-hidden">
              <h3 className="border-b border-line/80 px-4 py-2.5 font-semibold">{meta.groupTitle.includes('ตรวจ') ? meta.groupTitle : `${meta.groupTitle} — ตรวจว่าตรงกับนักเรียน`}</h3>
              <ul className="divide-y divide-line/70">
                {preview.groups.map((g) => (
                  <li key={g.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[15px]">
                    <span className="min-w-0 flex-1 font-medium">{g.label}</span>
                    {g.note && <span className={cx('rounded px-1.5 text-sm', g.warn ? 'bg-warn-soft text-warn' : 'text-ink-muted')}>{g.note}</span>}
                    <span className="tabular-nums text-ink-muted">{g.count} แถว</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {preview.issues.length > 0 && (
            <Card className="overflow-hidden">
              <div role="tablist" className="flex gap-1 border-b border-line/80 px-3 py-2">
                <button role="tab" aria-selected={show === 'error'} onClick={() => setShow('error')} className={cx('min-h-10 rounded-md px-3 text-[15px]', show === 'error' ? 'bg-danger-soft font-medium text-danger' : 'text-ink-muted hover:bg-sunken')}>ผิดพลาด ({preview.issues.filter((i) => i.level === 'error').length})</button>
                <button role="tab" aria-selected={show === 'warning'} onClick={() => setShow('warning')} className={cx('min-h-10 rounded-md px-3 text-[15px]', show === 'warning' ? 'bg-warn-soft font-medium text-warn' : 'text-ink-muted hover:bg-sunken')}>คำเตือน ({preview.warnings})</button>
                <button type="button" onClick={() => downloadIssues(preview.issues, `${meta.name}-${up?.fileName ?? 'ไฟล์'}`)} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-[15px] font-medium text-brand hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />ดาวน์โหลดรายงานข้อผิดพลาด</button>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-[15px]">
                  <thead className="sticky top-0 bg-surface text-left text-sm text-ink-muted"><tr><th scope="col" className="px-4 py-2 font-medium">แถว</th><th scope="col" className="px-2 py-2 font-medium">รหัส</th><th scope="col" className="px-2 py-2 font-medium">คอลัมน์</th><th scope="col" className="px-4 py-2 font-medium">ปัญหา</th></tr></thead>
                  <tbody className="divide-y divide-line/70">
                    {preview.issues.filter((i) => i.level === show).map((i, k) => (
                      <tr key={k}><td className="px-4 py-2 tabular-nums">{i.rowNo}</td><td className="px-2 py-2 tabular-nums">{i.key || '–'}</td><td className="px-2 py-2 whitespace-nowrap">{i.columnLabel}</td><td className="px-4 py-2">{i.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {preview.sample.rows.length > 0 && (
            <Card className="overflow-hidden">
              <h3 className="border-b border-line/80 px-4 py-2.5 font-semibold">ตัวอย่างข้อมูลหลังแปลง</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead className="text-left text-sm text-ink-muted"><tr><th scope="col" className="px-3 py-2 font-medium">แถว</th><th scope="col" className="px-1 py-2" />{preview.sample.columns.map((c) => <th key={c} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-line/70">
                    {preview.sample.rows.map((r) => (
                      <tr key={r.rowNo}>
                        <td className="px-3 py-2 tabular-nums">{r.rowNo}</td>
                        <td className="px-1 py-2"><span className={cx('rounded px-1.5 text-xs', r.action === 'create' ? 'bg-ok-soft text-ok' : 'bg-info-soft text-info')}>{r.action === 'create' ? 'ใหม่' : 'อัปเดต'}</span></td>
                        {r.cells.map((c, i) => <td key={i} className="px-3 py-2 whitespace-nowrap">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep('map')} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>แก้การจับคู่</Button>
            <Button onClick={() => setConfirming(true)} disabled={!total || busy} icon={<Upload className="size-4" aria-hidden="true" />}>ยืนยันนำเข้า {total.toLocaleString('th-TH')} รายการ</Button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="grid justify-items-center gap-3 py-6 text-center">
          <CheckCircle2 className="size-12 text-ok" aria-hidden="true" />
          <p className="text-xl font-semibold">นำเข้า{meta.name}เรียบร้อย</p>
          <p className="text-[15px]">{result}</p>
          <div className="flex gap-2"><Button onClick={onClose}>ดูข้อมูล</Button><Button variant="secondary" onClick={restart}>นำเข้าไฟล์อื่น</Button></div>
        </div>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={`ยืนยันนำเข้า${meta.name}`}>
        {preview && (
          <div className="grid gap-4">
            <p>บันทึกลงระบบจริง: เพิ่มใหม่ <strong>{preview.counts.create}</strong>, อัปเดต <strong>{preview.counts.update}</strong>{preview.counts.error ? <>, ข้ามแถวที่ผิด <strong>{preview.counts.error}</strong></> : null}{preview.term ? <> · ภาคเรียน {preview.term}</> : null}</p>
            <Button onClick={() => void commit()} loading={busy}>ยืนยัน บันทึกเลย</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}
