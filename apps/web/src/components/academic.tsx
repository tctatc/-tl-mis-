'use client';

import type { TermRef } from '@csis/shared';
import type { ReactNode } from 'react';
import { cx } from './ui';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="rise flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[15px] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function TermSelect({ terms, value, onChange }: { terms: TermRef[]; value: string | undefined; onChange: (id: string) => void }) {
  if (terms.length === 0) return null;
  return (
    <label className="flex items-center gap-2 text-[15px]">
      <span className="text-ink-muted">ภาคเรียน</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 font-medium tabular-nums ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand">
        {terms.map((t) => <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (ปัจจุบัน)' : ''}</option>)}
      </select>
    </label>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'brand' | 'warn' }) {
  return (
    <div className={cx('rounded-[var(--radius-card)] p-4 ring-1', tone === 'brand' ? 'bg-brand-deep text-ink-inverse ring-brand-deep' : tone === 'warn' ? 'bg-warn-soft ring-warn/20' : 'bg-surface shadow-card ring-line/70')}>
      <p className={cx('text-sm', tone === 'brand' ? 'text-white/75' : 'text-ink-muted')}>{label}</p>
      <p className="mt-1 text-[28px] leading-none font-semibold tabular-nums">{value}</p>
      {hint && <p className={cx('mt-1.5 text-sm', tone === 'brand' ? 'text-white/75' : 'text-ink-muted')}>{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-1 px-4 py-12 text-center text-ink-muted">
      {icon}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="text-sm">{children}</div>}
    </div>
  );
}

/** ป้ายเกรด: ผ่าน = เขียว, ไม่ผ่าน = แดง, ร = เหลือง (มีตัวอักษรกำกับเสมอ ไม่สื่อด้วยสีอย่างเดียว) */
export function GradePill({ grade, outcome, size = 'md' }: { grade: string; outcome: 'passed' | 'failed' | 'pending'; size?: 'md' | 'lg' }) {
  const cls = outcome === 'passed' ? 'bg-ok-soft text-ok' : outcome === 'failed' ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn';
  // เกรดตัวอักษรไทย (ร มส ขร ผ มผ) ใช้ฟอนต์มีหัว — ฟอนต์หลักไม่มีหัว ทำให้ "ร" ดูเหมือน "s"
  const thai = /[\u0E00-\u0E7F]/.test(grade);
  return <span className={cx('inline-grid place-items-center rounded-md font-semibold tabular-nums', thai && 'font-form', size === 'lg' ? 'min-w-12 px-2.5 py-1 text-lg' : 'min-w-10 px-2 py-0.5', cls)}>{grade}</span>;
}
