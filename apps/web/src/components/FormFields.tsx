'use client';

import {
  COURSE_GRADES, emptyCourse, visibleFields,
  type CourseRow, type FieldDef, type FormData, type RequestTypeDef, type SubjectRef, type TemplateKey,
} from '@csis/shared';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field, Input, Textarea, cx } from './ui';

type Set = (patch: FormData) => void;

/** ช่องกรอกของฟอร์มเฉพาะ สร้างจากรายการช่องใน @csis/shared/forms (เพิ่มฟอร์มใหม่ไม่ต้องแก้ไฟล์นี้) */
export function FormFields({ template, type, data, set, errors }: { template: TemplateKey; type: RequestTypeDef; data: FormData; set: Set; errors: Record<string, string> }) {
  return (
    <div className="grid gap-5">
      {visibleFields(template, data).map((f) => <FieldView key={f.key} def={f} type={type} data={data} set={set} error={errors[f.key]} />)}
    </div>
  );
}

function Chips({ list, value, onPick }: { list: readonly string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((p) => (
        <button key={p} type="button" onClick={() => onPick(p)} aria-pressed={value === p}
          className={cx('min-h-9 rounded-full px-3 text-sm ring-1 transition-colors duration-100', value === p ? 'bg-brand text-ink-inverse ring-brand' : 'bg-surface ring-line-strong hover:bg-sunken')}>{p}</button>
      ))}
    </div>
  );
}

function FieldView({ def, type, data, set, error }: { def: FieldDef; type: RequestTypeDef; data: FormData; set: Set; error?: string }) {
  const value = data[def.key];
  switch (def.kind) {
    case 'heading':
      return (
        <div className="-mb-2 border-t border-line/80 pt-4 first:border-0 first:pt-0">
          <p className="font-semibold">{def.label}</p>
          {def.hint && <p className="text-sm text-ink-muted">{def.hint}</p>}
        </div>
      );
    case 'text':
    case 'textarea': {
      const s = typeof value === 'string' ? value : '';
      const chips = def.chips === 'purposes' ? type.purposes : def.chips;
      return (
        <Field label={def.label} hint={def.hint} error={error} counter={`${s.length}/${def.max}`}>
          {({ id, describedBy, invalid }) => (
            <div className="grid gap-2">
              {chips && <Chips list={chips} value={s} onPick={(v) => set({ [def.key]: v })} />}
              {def.kind === 'text'
                ? <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={s} maxLength={def.max} placeholder={def.placeholder ?? (chips ? 'หรือพิมพ์เอง' : undefined)} inputMode={def.inputMode} onChange={(e) => set({ [def.key]: e.target.value })} />
                : <Textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} value={s} maxLength={def.max} rows={2} placeholder={chips ? 'หรือพิมพ์เอง' : undefined} onChange={(e) => set({ [def.key]: e.target.value })} />}
            </div>
          )}
        </Field>
      );
    }
    case 'choice':
      return (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[15px] font-medium">{def.label}</legend>
          <div className="flex flex-wrap gap-2">
            {def.options.map((o) => (
              <label key={o.value} className={cx('flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-3.5 ring-1', value === o.value ? 'bg-brand-soft font-medium text-brand ring-brand-border' : 'ring-line-strong hover:bg-sunken')}>
                <input type="radio" name={def.key} className="accent-[var(--color-brand)]" checked={value === o.value} onChange={() => set({ [def.key]: o.value })} />
                {o.label}
              </label>
            ))}
          </div>
          {def.hint && <p className="text-sm text-ink-muted">{def.hint}</p>}
          <p className="text-sm text-danger" aria-live="polite">{error}</p>
        </fieldset>
      );
    case 'multi': {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[15px] font-medium">{def.label}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {def.options.map((o) => {
              const on = list.includes(o.value);
              return (
                <label key={o.value} className={cx('flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-3 ring-1', on ? 'bg-brand-soft ring-brand-border' : 'ring-line-strong hover:bg-sunken')}>
                  <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={on} onChange={() => set({ [def.key]: on ? list.filter((x) => x !== o.value) : [...list, o.value] })} />
                  <span className="text-[15px]">{o.label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-sm text-danger" aria-live="polite">{error}</p>
        </fieldset>
      );
    }
    case 'number':
      return (
        <Field label={def.label} hint={def.hint} error={error}>
          {({ id, describedBy, invalid }) => (
            <div className="flex items-center gap-2">
              <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="number" inputMode="numeric" min={def.min} max={def.max}
                value={typeof value === 'number' ? value : value === null || value === undefined ? '' : String(value)}
                onChange={(e) => set({ [def.key]: e.target.value === '' ? null : Number(e.target.value) })} className="max-w-40 tabular-nums" />
              {def.suffix && <span className="text-ink-muted">{def.suffix}</span>}
            </div>
          )}
        </Field>
      );
    case 'date':
      return (
        <Field label={def.label} hint={def.hint} error={error}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => set({ [def.key]: e.target.value })} className="max-w-56" />}
        </Field>
      );
    case 'courses':
      return <Courses def={def} rows={Array.isArray(value) ? (value as CourseRow[]) : []} onChange={(rows) => set({ [def.key]: rows })} error={error} />;
  }
}

const EXTRA_LABEL = { amount: 'จำนวนเงิน', dayTime: 'เรียน วัน/เวลา', teacher: 'อาจารย์ผู้สอน', category: 'หมวดวิชา', grade: 'ผลการเรียนเดิม' } as const;

/** ตารางรายวิชา: พิมพ์รหัสหรือชื่อวิชา → เลือกจากรายการ → ชื่อ/คาบ/หน่วยกิตเติมเอง */
function Courses({ def, rows, onChange, error }: { def: Extract<FieldDef, { kind: 'courses' }>; rows: CourseRow[]; onChange: (rows: CourseRow[]) => void; error?: string }) {
  const update = (i: number, patch: Partial<CourseRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-1 text-[15px] font-medium">{def.label}</legend>
      {rows.map((r, i) => (
        <div key={i} className="grid gap-2 rounded-[var(--radius-control)] bg-sunken/60 p-3 ring-1 ring-line/70">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-muted">วิชาที่ {i + 1}</span>
            {rows.length > 1 && <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="grid size-9 place-items-center rounded-md text-ink-muted hover:bg-danger-soft hover:text-danger" aria-label={`ลบวิชาที่ ${i + 1}`}><Trash2 className="size-4" aria-hidden="true" /></button>}
          </div>
          <SubjectSearch row={r} onPick={(s) => update(i, { code: s.code, name: s.name, periods: s.theory + s.practice, credits: s.credits })} onType={(patch) => update(i, patch)} />
          {r.name && <p className="text-sm text-ink-muted">{r.name}{r.credits !== null && <> · {r.periods ?? '–'} คาบ · {r.credits} หน่วยกิต</>}</p>}
          {def.extra.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {def.extra.map((k) => k === 'grade' ? (
                <label key={k} className="grid gap-1 text-sm"><span className="text-ink-muted">{EXTRA_LABEL[k]}</span>
                  <select value={r.grade} onChange={(e) => update(i, { grade: e.target.value })} className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong">
                    <option value="">–</option>{COURSE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </label>
              ) : (
                <label key={k} className="grid gap-1 text-sm"><span className="text-ink-muted">{EXTRA_LABEL[k]}{k === 'category' ? ' (ระบบเติมให้ถ้าวิชาอยู่ในหลักสูตร)' : ''}</span>
                  <Input value={r[k]} maxLength={k === 'amount' ? 12 : 40} onChange={(e) => update(i, { [k]: e.target.value })} className="min-h-10" />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      {rows.length < def.maxRows && <Button type="button" variant="secondary" onClick={() => onChange([...rows, emptyCourse()])} icon={<Plus className="size-4" aria-hidden="true" />}>เพิ่มรายวิชา</Button>}
      <p className="text-sm text-danger" aria-live="polite">{error}</p>
    </fieldset>
  );
}

function SubjectSearch({ row, onPick, onType }: { row: CourseRow; onPick: (s: SubjectRef) => void; onType: (patch: Partial<CourseRow>) => void }) {
  const [results, setResults] = useState<SubjectRef[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const search = (q: string) => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(() => {
      api.get<SubjectRef[]>(`/student/subjects?q=${encodeURIComponent(q.trim())}`).then((r) => { setResults(r); setOpen(true); }).catch(() => setResults([]));
    }, 220);
  };
  return (
    <div className="relative grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
        <Input value={row.code} placeholder="รหัสวิชา" aria-label="รหัสวิชา" className="min-h-10 pl-9 tabular-nums" maxLength={20}
          onChange={(e) => { onType({ code: e.target.value, credits: null, periods: null }); search(e.target.value); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)} onFocus={() => results.length && setOpen(true)} />
      </div>
      <Input value={row.name} placeholder="ชื่อวิชา (หรือพิมพ์ชื่อเพื่อค้นหา)" aria-label="ชื่อวิชา" className="min-h-10" maxLength={80}
        onChange={(e) => { onType({ name: e.target.value }); search(e.target.value); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-[var(--radius-control)] bg-surface py-1 shadow-card ring-1 ring-line" role="listbox">
          {results.map((s) => (
            <li key={s.code} role="option" aria-selected={false}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s); setOpen(false); }} className="flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-sunken">
                <span className="tabular-nums text-sm text-ink-muted">{s.code}</span><span className="flex-1">{s.name}</span><span className="text-xs tabular-nums text-ink-muted">{s.credits} นก.</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
