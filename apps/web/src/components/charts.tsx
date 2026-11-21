import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './ui';

export interface BarItem { key: string; label: ReactNode; value: number; href?: string; onClick?: () => void; sub?: ReactNode; tone?: 'brand' | 'gold' | 'ok' | 'warn' | 'info' | 'muted' }
const FILL: Record<NonNullable<BarItem['tone']>, string> = {
  brand: 'bg-brand', gold: 'bg-gold', ok: 'bg-ok', warn: 'bg-warn', info: 'bg-info', muted: 'bg-line-strong',
};

/** กราฟแท่งแนวนอน: ชื่อ + ตัวเลขเขียนไว้ทุกแถว (ไม่ต้องเดาจากความยาวแท่ง) กดแถวเพื่อดูรายละเอียดได้ */
export function BarList({ items, empty = 'ยังไม่มีข้อมูล', unit = '' }: { items: BarItem[]; empty?: string; unit?: string }) {
  if (items.length === 0) return <p className="py-6 text-center text-ink-muted">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
      {items.map((i) => {
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{i.label}{i.sub && <span className="ml-2 text-sm text-ink-muted">{i.sub}</span>}</span>
              <span className="shrink-0 font-semibold tabular-nums">{i.value.toLocaleString('th-TH')}{unit && <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span>}</span>
            </span>
            <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
              <span className={cx('block h-full rounded-full', FILL[i.tone ?? 'brand'])} style={{ width: `${Math.max((i.value / max) * 100, i.value ? 2 : 0)}%` }} />
            </span>
          </>
        );
        return (
          <li key={i.key}>
            {i.onClick ? <button type="button" onClick={i.onClick} className="block w-full rounded-md px-2 py-2 text-left hover:bg-sunken focus-visible:bg-sunken">{body}</button> : i.href ? <Link href={i.href} className="block rounded-md px-2 py-2 hover:bg-sunken focus-visible:bg-sunken">{body}</Link> : <div className="px-2 py-2">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** กราฟแท่งแนวตั้งรายเดือน — ตัวเลขอยู่บนแท่ง อ่านได้โดยไม่ต้องชี้เมาส์ */
export function ColumnChart({ items, label }: { items: { key: string; label: string; value: number }[]; label: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <figure>
      <div className="flex h-44 items-end gap-1 sm:gap-2" role="img" aria-label={`${label}: ${items.map((i) => `${i.label} ${i.value}`).join(', ')}`}>
        {items.map((i) => (
          <div key={i.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-medium tabular-nums text-ink-muted">{i.value || ''}</span>
            <span className={cx('w-full max-w-10 rounded-t-md', i.value ? 'bg-brand' : 'bg-sunken')} style={{ height: `${i.value ? Math.max((i.value / max) * 100, 4) : 3}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-line pt-1.5 sm:gap-2" aria-hidden="true">
        {items.map((i) => <span key={i.key} className="min-w-0 flex-1 truncate text-center text-xs text-ink-muted">{i.label}</span>)}
      </div>
    </figure>
  );
}

/** การ์ดตัวเลขที่กดได้ (ไปหน้ารายชื่อที่กรองไว้แล้ว) */
export function StatLink({ label, value, hint, href, onClick, tone = 'default', icon }: { label: string; value: ReactNode; hint?: ReactNode; href?: string; onClick?: () => void; tone?: 'default' | 'brand' | 'ok' | 'warn' | 'danger' | 'info'; icon?: ReactNode }) {
  const toneCls = {
    default: 'bg-surface shadow-card ring-line/70',
    brand: 'bg-brand-deep text-ink-inverse ring-brand-deep',
    ok: 'bg-ok-soft ring-ok/25',
    warn: 'bg-warn-soft ring-warn/25',
    danger: 'bg-danger-soft ring-danger/20',
    info: 'bg-info-soft ring-info/20',
  }[tone];
  const muted = tone === 'brand' ? 'text-white/75' : 'text-ink-muted';
  const body = (
    <>
      <p className={cx('flex items-center gap-1.5 text-[15px]', muted)}>{icon}{label}</p>
      <p className="mt-1 text-[30px] leading-none font-semibold tabular-nums">{value}</p>
      {hint && <p className={cx('mt-1.5 text-sm', muted)}>{hint}</p>}
    </>
  );
  const cls = cx('block rounded-[var(--radius-card)] p-4 ring-1', toneCls);
  const live = cx(cls, 'w-full text-left transition hover:-translate-y-px hover:shadow-md');
  if (onClick) return <button type="button" onClick={onClick} className={live}>{body}</button>;
  return href ? <Link href={href} className={live}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** แถบหัวข้อของการ์ดในแดชบอร์ด */
export function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70 sm:p-5', className)} aria-label={title}>
      <div className="mb-2 flex items-baseline justify-between gap-3"><h2 className="text-[17px] font-semibold">{title}</h2>{action}</div>
      {children}
    </section>
  );
}
