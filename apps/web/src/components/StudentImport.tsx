'use client';

import { IMPORT_FIELDS, LEVEL_LABEL, formatThaiDateTime, type ImportField, type ImportMapping, type Level } from '@csis/shared';
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Stat } from './academic';
import { Dialog } from './Dialog';
import { Alert, Button, Card, Spinner, cx } from './ui';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { useApi } from '@/lib/useApi';

type Cell = string | number | null;
interface Uploaded { jobId: string; fileName: string; headers: string[]; rowCount: number; headerRowNo: number; encoding: string | null; sample: Cell[][]; mapping: ImportMapping; currentYear: number }
interface Issue { rowNo: number; studentCode: string; column: string; columnLabel: string; message: string; level: 'error' | 'warning' }
interface Group { department: string; level: Level | null; program: string; byEntry: Record<string, number>; total: number; isNew: boolean }
interface Preview {
  counts: { create: number; update: number; error: number }; warnings: number; currentYear: number; entries: string[];
  groups: Group[]; newPrograms: { level: Level; program: string; department: string; count: number }[]; issues: Issue[];
  sample: ({ rowNo: number; action: string; studentCode: string; prefix: string; firstName: string; lastName: string; birthDate: string | null; program: string; level: Level | null; yearLevel: number | null; entryYear: number | null })[];
}
interface Done { created: number; updated: number; skipped: number; createdPrograms: string[] }
interface HistoryRow { id: string; fileName: string; status: string; createdAt: string; total: number; created: number; updated: number; errors: number; by: string }
type Mode = 'upsert' | 'insert' | 'update';

const FIELD_ORDER = Object.keys(IMPORT_FIELDS) as ImportField[];
const STATUS: Record<string, string> = { uploaded: 'อัปโหลดแล้ว', previewed: 'ตรวจแล้ว ยังไม่ยืนยัน', committing: 'กำลังบันทึก', committed: 'นำเข้าแล้ว', failed: 'ล้มเหลว' };
const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'upsert', label: 'เพิ่มใหม่ + อัปเดตคนเดิม', hint: 'รหัสที่ยังไม่มีจะเพิ่ม รหัสที่มีแล้วจะแก้ข้อมูลตามไฟล์ (แนะนำ)' },
  { value: 'insert', label: 'เพิ่มใหม่อย่างเดียว', hint: 'รหัสที่มีอยู่แล้วจะถูกข้าม' },
  { value: 'update', label: 'อัปเดตอย่างเดียว', hint: 'แก้ข้อมูลคนที่มีอยู่แล้ว ไม่เพิ่มคนใหม่' },
];
const yearOf = (entry: string, current: number) => (/^\d{4}$/.test(entry) ? current - Number(entry) + 1 : null);
const cellText = (c: Cell) => (c === null ? '' : typeof c === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(c) ? c.slice(0, 10) : String(c));

/** ขั้นตอนนำเข้านักเรียนจากไฟล์ (ใช้ในหน้านักเรียน) — ส่ง initialFile มาเมื่อผู้ใช้ลากไฟล์วางบนหน้า */
export function StudentImport({ initialFile, onCommitted, onClose }: { initialFile?: File | null; onCommitted: () => void; onClose: () => void }) {
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [mode, setMode] = useState<Mode>('upsert');
  const [createMissing, setCreateMissing] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const history = useApi<HistoryRow[]>('/admin/imports/students');
  const started = useRef(false);
  useEffect(() => {
    if (initialFile && !started.current) { started.current = true; void onFile(initialFile); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function onFile(file: File) {
    setBusy(true); setError('');
    try {
      const r = await uploadFile<Uploaded>('/admin/imports/students', file);
      setUploaded(r); setMapping(r.mapping); setStep('map');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function runPreview() {
    setBusy(true); setError('');
    try {
      setPreview(await api.post<Preview>(`/admin/imports/students/${uploaded!.jobId}/preview`, { mapping, mode, createMissing }));
      setStep('review');
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true); setError('');
    try {
      setDone(await api.post<Done>(`/admin/imports/students/${uploaded!.jobId}/commit`));
      setConfirming(false); setStep('done'); void history.reload(); onCommitted();
    } catch (e) { setError(errorMessage(e)); setConfirming(false); } finally { setBusy(false); }
  }
  const restart = () => { setStep('upload'); setUploaded(null); setPreview(null); setDone(null); setError(''); setCreateMissing(false); setMode('upsert'); };

  const steps = ['เลือกไฟล์', 'จับคู่คอลัมน์', 'ตรวจสอบ', 'เสร็จ'];
  const stepIdx = ['upload', 'map', 'review', 'done'].indexOf(step);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <ol className="flex flex-wrap gap-x-2 gap-y-1 text-sm" aria-label="ขั้นตอน">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === stepIdx ? 'step' : undefined} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1', i === stepIdx ? 'bg-brand-deep text-ink-inverse' : i < stepIdx ? 'bg-ok-soft text-ok' : 'bg-sunken text-ink-muted')}>
            <span className="tabular-nums">{i + 1}.</span>{s}
          </li>
        ))}
      </ol>
      {error && <Alert>{error}</Alert>}

      {step === 'upload' && <UploadStep busy={busy} onFile={(f) => void onFile(f)} history={history.data} />}

      {step === 'map' && uploaded && (
        <Card className="grid gap-5 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold"><FileSpreadsheet className="size-5 text-ok" aria-hidden="true" />{uploaded.fileName}</p>
              <p className="text-sm text-ink-muted">{uploaded.rowCount.toLocaleString('th-TH')} แถว · หัวตารางอยู่แถวที่ {uploaded.headerRowNo}{uploaded.encoding ? ` · อ่านภาษาไทยแบบ ${uploaded.encoding}` : ''}</p>
            </div>
            <Button variant="ghost" onClick={restart} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>เลือกไฟล์ใหม่</Button>
          </div>
          <div>
            <h2 className="font-semibold">จับคู่คอลัมน์</h2>
            <p className="text-sm text-ink-muted">ระบบเดาให้จากหัวตารางแล้ว ตรวจว่าตัวอย่างข้อมูลตรงช่อง · ชื่อใช้ช่อง “ชื่อ-นามสกุล (รวม)” หรือ “ชื่อ” + “นามสกุล” อย่างใดอย่างหนึ่ง · ชั้นปีคิดจากรหัส (68 = เข้าปี 2568) ไม่ต้องมีคอลัมน์ชั้นปีก็ได้</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted"><tr><th scope="col" className="py-2 pr-3 font-medium">ข้อมูลในระบบ</th><th scope="col" className="py-2 pr-3 font-medium">คอลัมน์ในไฟล์</th><th scope="col" className="py-2 font-medium">ตัวอย่างจากไฟล์</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {FIELD_ORDER.map((f) => {
                  const idx = mapping[f];
                  return (
                    <tr key={f}>
                      <th scope="row" className="py-2 pr-3 text-left font-normal whitespace-nowrap">{IMPORT_FIELDS[f].label}{IMPORT_FIELDS[f].required && <span className="text-danger"> *</span>}</th>
                      <td className="py-2 pr-3">
                        <select aria-label={`คอลัมน์สำหรับ ${IMPORT_FIELDS[f].label}`} value={idx ?? ''} onChange={(e) => setMapping((m) => { const n = { ...m }; if (e.target.value === '') delete n[f]; else n[f] = Number(e.target.value); return n; })}
                          className={cx('min-h-10 w-full min-w-44 rounded-[var(--radius-control)] bg-surface px-2 ring-1 focus:outline-none focus:ring-2 focus:ring-brand', idx !== undefined ? 'ring-ok/50' : 'ring-line-strong')}>
                          <option value="">— ไม่ใช้ —</option>
                          {uploaded.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      </td>
                      <td className="max-w-[22rem] truncate py-2 text-sm text-ink-muted">{idx === undefined ? '' : uploaded.sample.slice(0, 3).map((r) => cellText(r[idx]!)).filter(Boolean).join(' · ')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 font-semibold">วิธีนำเข้า</legend>
            {MODES.map((m) => (
              <label key={m.value} className={cx('flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] p-3 ring-1', mode === m.value ? 'bg-brand-soft ring-brand-border' : 'ring-line-strong hover:bg-sunken')}>
                <input type="radio" name="mode" className="mt-1 accent-[var(--color-brand)]" checked={mode === m.value} onChange={() => setMode(m.value)} />
                <span><span className="font-medium">{m.label}</span><span className="block text-sm text-ink-muted">{m.hint}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] p-3 ring-1 ring-line-strong">
            <input type="checkbox" className="mt-1 size-4 accent-[var(--color-brand)]" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
            <span><span className="font-medium">สร้างแผนก/สาขาที่ยังไม่มีในระบบ</span><span className="block text-sm text-ink-muted">ไม่ติ๊ก = แถวที่สาขาไม่ตรงกับในระบบจะขึ้นเป็นข้อผิดพลาด (เห็นรายชื่อสาขาก่อนยืนยันเสมอ)</span></span>
          </label>
          <Button onClick={() => void runPreview()} loading={busy}>ตรวจข้อมูล {uploaded.rowCount.toLocaleString('th-TH')} แถว</Button>
        </Card>
      )}

      {step === 'review' && preview && uploaded && (
        <Review preview={preview} busy={busy} onBack={() => setStep('map')} onConfirm={() => setConfirming(true)} />
      )}

      {step === 'done' && done && (
        <Card className="grid justify-items-center gap-3 p-8 text-center">
          <CheckCircle2 className="size-12 text-ok" aria-hidden="true" />
          <h2 className="text-xl font-semibold">นำเข้าเรียบร้อย</h2>
          <p className="text-[15px]">เพิ่มใหม่ <strong className="tabular-nums">{done.created}</strong> คน · อัปเดต <strong className="tabular-nums">{done.updated}</strong> คน{done.skipped ? <> · ข้ามแถวที่ผิด <strong className="tabular-nums">{done.skipped}</strong> แถว</> : null}</p>
          {done.createdPrograms.length > 0 && <p className="text-sm text-ink-muted">สร้างสาขาใหม่: {done.createdPrograms.join(', ')}</p>}
          <p className="text-sm text-ink-muted">นักเรียนใหม่เข้าสู่ระบบด้วยรหัสนักศึกษา + วันเกิด (วว/ดด/ปปปป พ.ศ. เช่น 01/11/2551)</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onClose}>ดูรายชื่อนักเรียน</Button>
            <Button variant="secondary" onClick={restart}>นำเข้าไฟล์อื่น</Button>
          </div>
        </Card>
      )}

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="ยืนยันนำเข้า">
        {preview && (
          <div className="grid gap-4">
            <p>บันทึกลงระบบจริง: เพิ่มใหม่ <strong>{preview.counts.create}</strong> คน, อัปเดต <strong>{preview.counts.update}</strong> คน{preview.counts.error ? <>, ข้ามแถวที่ผิด <strong>{preview.counts.error}</strong> แถว</> : null}</p>
            {preview.newPrograms.length > 0 && <Alert tone="warn">จะสร้างสาขาใหม่ {preview.newPrograms.length} สาขา: {preview.newPrograms.map((p) => `${LEVEL_LABEL[p.level]} ${p.program}`).join(', ')}</Alert>}
            <Button onClick={() => void commit()} loading={busy}>ยืนยัน บันทึกเลย</Button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function UploadStep({ busy, onFile, history }: { busy: boolean; onFile: (f: File) => void; history: HistoryRow[] | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); };
  return (
    <>
      <Card className="grid gap-4 p-4 sm:p-5">
        <label onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
          className={cx('grid cursor-pointer place-items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed px-4 py-10 text-center transition-colors', over ? 'border-brand bg-brand-soft' : 'border-line-strong hover:bg-sunken/60')}>
          {busy ? <Spinner label="กำลังอ่านไฟล์" /> : (
            <>
              <UploadCloud className="size-10 text-brand" aria-hidden="true" />
              <span className="text-lg font-semibold">ลากไฟล์มาวาง หรือกดเพื่อเลือกไฟล์</span>
              <span className="text-sm text-ink-muted">.xlsx หรือ .csv · ไม่เกิน 5 MB / 5,000 แถว · หัวตารางชื่ออะไรก็ได้ ระบบจะจับคู่ให้</span>
            </>
          )}
          <input ref={input} type="file" accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="sr-only" disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-muted">ยังไม่มีไฟล์? ดาวน์โหลดแบบฟอร์ม:</span>
          <a href="/api/admin/imports/students/template.xlsx" className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />Excel</a>
          <a href="/api/admin/imports/students/template.csv" className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />CSV</a>
        </div>
        <ul className="grid gap-1 text-sm text-ink-muted">
          <li>• <strong className="text-ink">ชั้นปีคิดจากรหัสนักศึกษา</strong>: 2 หลักแรกคือปีที่เข้า เช่น 68xxxx = เข้าปี 2568, 69xxxx = เข้าปี 2569</li>
          <li>• วันเกิดใส่ได้หลายแบบ 01/11/2551, 1 พ.ย. 51, เซลล์วันที่ของ Excel — ใช้เป็นรหัสผ่านเริ่มต้นของนักเรียนใหม่</li>
          <li>• แผนก/สาขาเขียน “แผนกวิชา…” หรือไม่มีก็ได้ ระบบตัดคำนำหน้าแล้วเทียบให้</li>
        </ul>
      </Card>
      <Card>
        <h2 className="border-b border-line/80 px-4 py-3 font-semibold">ประวัติการนำเข้า</h2>
        {!history ? <Spinner /> : history.length === 0 ? <p className="px-4 py-6 text-ink-muted">ยังไม่เคยนำเข้า</p> : (
          <ul className="divide-y divide-line/70">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{h.fileName}</span><span className="text-sm text-ink-muted">{h.by} · {formatThaiDateTime(h.createdAt)}</span></span>
                <span className="text-sm tabular-nums text-ink-muted">{h.total} แถว · เพิ่ม {h.created} · อัปเดต {h.updated} · ผิด {h.errors}</span>
                <span className={cx('rounded-full px-2.5 py-0.5 text-[13px]', h.status === 'committed' ? 'bg-ok-soft text-ok' : h.status === 'failed' ? 'bg-danger-soft text-danger' : 'bg-sunken text-ink-muted')}>{STATUS[h.status] ?? h.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Review({ preview: p, busy, onBack, onConfirm }: { preview: Preview; busy: boolean; onBack: () => void; onConfirm: () => void }) {
  const [show, setShow] = useState<'error' | 'warning'>(p.counts.error ? 'error' : 'warning');
  const issues = p.issues.filter((i) => i.level === show);
  const total = p.counts.create + p.counts.update;
  const downloadIssues = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['แถว', 'รหัสนักศึกษา', 'ระดับ', 'คอลัมน์', 'ปัญหา'], ...p.issues.map((i) => [i.rowNo, i.studentCode, i.level === 'error' ? 'ผิดพลาด' : 'คำเตือน', i.columnLabel, i.message])];
    const blob = new Blob([`﻿${lines.map((r) => r.map(esc).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'ปัญหาในไฟล์นำเข้า.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปผลตรวจ">
        <Stat tone="brand" label="จะเพิ่มใหม่" value={p.counts.create} hint="คน (สร้างบัญชีให้ด้วย)" />
        <Stat label="จะอัปเดต" value={p.counts.update} hint="คน (รหัสมีอยู่แล้ว)" />
        <Stat label="ผิดพลาด (จะข้าม)" value={p.counts.error} hint="แถว" tone={p.counts.error ? 'warn' : 'default'} />
        <Stat label="คำเตือน" value={p.warnings} hint="บันทึกได้ แต่ควรตรวจ" />
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-line/80 px-4 py-3">
          <h2 className="font-semibold">แยกตามแผนก/สาขา และรุ่น</h2>
          <p className="text-sm text-ink-muted">รุ่นดูจาก 2 หลักแรกของรหัส · ชั้นปีคิดจากปีการศึกษา {p.currentYear}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead className="bg-sunken/50 text-left text-sm text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">แผนก</th><th scope="col" className="px-2 py-2 font-medium">สาขา</th>
                {p.entries.map((e) => <th key={e} scope="col" className="px-2 py-2 text-center font-medium whitespace-nowrap">รุ่น {e.slice(-2)}{yearOf(e, p.currentYear) ? <span className="block text-xs font-normal">ปี {yearOf(e, p.currentYear)}</span> : null}</th>)}
                <th scope="col" className="px-4 py-2 text-right font-medium">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {p.groups.map((g) => (
                <tr key={`${g.level}-${g.program}`}>
                  <td className="px-4 py-2">{g.department}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{g.level ? LEVEL_LABEL[g.level] : ''} {g.program}{g.isNew && <span className="ml-2 rounded bg-gold-soft px-1.5 text-xs text-gold-ink">สาขาใหม่</span>}</td>
                  {p.entries.map((e) => <td key={e} className="px-2 py-2 text-center tabular-nums">{g.byEntry[e] ?? <span className="text-ink-muted">–</span>}</td>)}
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{g.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {p.issues.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line/80 px-3 py-2">
            <div role="tablist" className="flex gap-1">
              <button role="tab" aria-selected={show === 'error'} onClick={() => setShow('error')} className={cx('min-h-10 rounded-md px-3 text-[15px]', show === 'error' ? 'bg-danger-soft font-medium text-danger' : 'text-ink-muted hover:bg-sunken')}>ผิดพลาด ({p.issues.filter((i) => i.level === 'error').length})</button>
              <button role="tab" aria-selected={show === 'warning'} onClick={() => setShow('warning')} className={cx('min-h-10 rounded-md px-3 text-[15px]', show === 'warning' ? 'bg-warn-soft font-medium text-warn' : 'text-ink-muted hover:bg-sunken')}>คำเตือน ({p.warnings})</button>
            </div>
            <Button variant="ghost" className="ml-auto" onClick={downloadIssues} icon={<Download className="size-4" aria-hidden="true" />}>ดาวน์โหลดรายการปัญหา</Button>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-[15px]">
              <thead className="sticky top-0 bg-surface text-left text-sm text-ink-muted"><tr><th scope="col" className="px-4 py-2 font-medium">แถว</th><th scope="col" className="px-2 py-2 font-medium">รหัส</th><th scope="col" className="px-2 py-2 font-medium">คอลัมน์</th><th scope="col" className="px-4 py-2 font-medium">ปัญหา</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {issues.map((i, k) => (
                  <tr key={k}><td className="px-4 py-2 tabular-nums">{i.rowNo}</td><td className="px-2 py-2 tabular-nums">{i.studentCode || '–'}</td><td className="px-2 py-2 whitespace-nowrap">{i.columnLabel}</td><td className="px-4 py-2">{i.message}</td></tr>
                ))}
                {issues.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-ink-muted">ไม่มี</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {p.sample.length > 0 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-line/80 px-4 py-3 font-semibold">ตัวอย่างข้อมูลหลังแปลง</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted"><tr>{['แถว', '', 'รหัส', 'ชื่อ-นามสกุล', 'วันเกิด (ค.ศ.)', 'ระดับ/สาขา', 'รุ่น', 'ชั้นปี'].map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line/70">
                {p.sample.map((s) => (
                  <tr key={s.rowNo}>
                    <td className="px-3 py-2 tabular-nums">{s.rowNo}</td>
                    <td className="px-3 py-2"><span className={cx('rounded px-1.5 text-xs', s.action === 'create' ? 'bg-ok-soft text-ok' : 'bg-info-soft text-info')}>{s.action === 'create' ? 'ใหม่' : 'อัปเดต'}</span></td>
                    <td className="px-3 py-2 tabular-nums">{s.studentCode}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.prefix}{s.firstName} {s.lastName}</td>
                    <td className="px-3 py-2 tabular-nums">{s.birthDate ?? '–'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{s.level ? LEVEL_LABEL[s.level] : ''} {s.program}</td>
                    <td className="px-3 py-2 tabular-nums">{s.entryYear ?? '–'}</td>
                    <td className="px-3 py-2 tabular-nums">{s.yearLevel ?? '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack} icon={<ArrowLeft className="size-4" aria-hidden="true" />}>แก้การจับคู่</Button>
        <Button onClick={onConfirm} disabled={total === 0 || busy} icon={<Upload className="size-4" aria-hidden="true" />}>ยืนยันนำเข้า {total.toLocaleString('th-TH')} คน</Button>
      </div>
    </div>
  );
}
