'use client';

import { LEVEL_LABEL, type Level } from '@csis/shared';
import { FileSpreadsheet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AcademicImport } from '@/components/AcademicImport';
import { Dialog } from '@/components/Dialog';
import { Button } from '@/components/ui';
import { useApi } from '@/lib/useApi';

export interface Term { id: string; label: string; isCurrent: boolean }
export interface ClassRow { programId: string; program: string; level: Level; yearLevel: number; groupNo: string; students: number }
export const classKey = (c: Pick<ClassRow, 'programId' | 'yearLevel' | 'groupNo'>) => `${c.programId}|${c.yearLevel}|${c.groupNo}`;
export const classLabel = (c: ClassRow) => `${LEVEL_LABEL[c.level]} ${c.program} ปี ${c.yearLevel} ห้อง ${c.groupNo}`;
export const selectCls = 'min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';

export function useTerms() {
  const { data } = useApi<Term[]>('/admin/academic/terms');
  return data ?? [];
}
export function useClasses() {
  const { data } = useApi<ClassRow[]>('/admin/academic/classes');
  return data ?? [];
}

export function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1 text-sm"><span className="text-ink-muted">{label}</span>{children}</label>;
}

export function TermPicker({ terms, value, onChange }: { terms: Term[]; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label="ภาคเรียน">
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {terms.map((t) => <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (ปัจจุบัน)' : ''}</option>)}
      </select>
    </Labeled>
  );
}

export function ClassPicker({ classes, value, onChange }: { classes: ClassRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <Labeled label="ห้องเรียน (สาขา · ชั้นปี · ห้อง)">
      <select className={`${selectCls} w-full sm:w-auto sm:min-w-72`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">— เลือกห้อง —</option>
        {classes.map((c) => <option key={classKey(c)} value={classKey(c)}>{classLabel(c)} ({c.students} คน)</option>)}
      </select>
    </Labeled>
  );
}

/** ปุ่ม "นำเข้าจากไฟล์" + หน้าต่างนำเข้า */
export function ImportButton({ kind, terms, termId, onDone }: { kind: 'plan' | 'schedule' | 'grade'; terms: Term[]; termId?: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const title = { plan: 'นำเข้าแผนการเรียน', schedule: 'นำเข้าตารางเรียน', grade: 'นำเข้าผลการเรียน' }[kind];
  return (
    <>
      <Button onClick={() => setOpen(true)} icon={<FileSpreadsheet className="size-4" aria-hidden="true" />}>นำเข้าจากไฟล์</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title} xl>
        {open && <AcademicImport kind={kind} terms={terms} {...(termId ? { defaultTermId: termId } : {})} onCommitted={onDone} onClose={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}
