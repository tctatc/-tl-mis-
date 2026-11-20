'use client';

import { THAI_MONTHS } from '@csis/shared';
import { cx } from '@/components/ui';

const sel = 'min-h-11 rounded-[var(--radius-control)] bg-surface px-2 text-[15px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * เลือกวันที่แบบไทย: วัน / ชื่อเดือน / ปี พ.ศ. — เหมือนกันทุกเครื่อง ไม่ขึ้นกับภาษาของเบราว์เซอร์
 * value/onChange เป็น yyyy-mm-dd (ค.ศ.) หรือ '' = ยังไม่เลือก
 */
export function ThaiDateInput({ value, onChange, label, allowEmpty = false, className }: { value: string; onChange: (iso: string) => void; label: string; allowEmpty?: boolean; className?: string }) {
  const [y, m, d] = value ? value.split('-').map(Number) as [number, number, number] : [0, 0, 0];
  const nowY = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => nowY - 2 + i);
  const set = (ny: number, nm: number, nd: number) => {
    if (!ny || !nm || !nd) return onChange('');
    onChange(`${ny}-${pad(nm)}-${pad(Math.min(nd, daysIn(ny, nm)))}`);
  };
  const base = y || nowY;
  const baseM = m || new Date().getMonth() + 1;
  return (
    <fieldset className={cx('grid gap-1 text-sm', className)}>
      <legend className="mb-1 text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        <select aria-label={`${label}: วันที่`} className={sel} value={d || ''} onChange={(e) => set(base, baseM, Number(e.target.value))}>
          {(allowEmpty || !d) && <option value="">วัน</option>}
          {Array.from({ length: daysIn(base, baseM) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
        <select aria-label={`${label}: เดือน`} className={sel} value={m || ''} onChange={(e) => set(base, Number(e.target.value), d || 1)}>
          {(allowEmpty || !m) && <option value="">เดือน</option>}
          {THAI_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
        </select>
        <select aria-label={`${label}: ปี พ.ศ.`} className={sel} value={y || ''} onChange={(e) => set(Number(e.target.value), baseM, d || 1)}>
          {(allowEmpty || !y) && <option value="">ปี</option>}
          {years.map((yy) => <option key={yy} value={yy}>{yy + 543}</option>)}
        </select>
        {allowEmpty && value && <button type="button" onClick={() => onChange('')} className="min-h-11 px-2 text-sm text-ink-muted underline underline-offset-2 hover:text-ink">ล้าง</button>}
      </div>
    </fieldset>
  );
}
