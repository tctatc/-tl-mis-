'use client';

import { BookOpen, CalendarDays, CircleHelp, ClipboardList, FileText, GraduationCap, House, LogOut, Menu, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { InstallApp } from './InstallApp';
import { cx } from './ui';

const TABS = [
  { href: '/student', label: 'หน้าหลัก', Icon: House, exact: true },
  { href: '/student/schedule', label: 'ตารางเรียน', Icon: CalendarDays },
  { href: '/student/grades', label: 'ผลการเรียน', Icon: GraduationCap },
  { href: '/student/requests', label: 'คำร้อง', Icon: FileText, also: ['/student/new', '/requests'] },
] as const;
const MORE = [
  { href: '/student/plan', label: 'แผนการเรียน', Icon: BookOpen },
  { href: '/student/registration', label: 'บัตรลงทะเบียน', Icon: ClipboardList },
  { href: '/student/profile', label: 'ข้อมูลประวัติ', Icon: UserRound },
  { href: '/help?for=student', label: 'คู่มือการใช้งาน', Icon: CircleHelp },
] as const;

/** แถบเมนูล่างแบบแอปมือถือ (จอเล็กกว่า lg) — 4 เมนูหลัก + "เพิ่มเติม" เปิดแผ่นเมนูจากด้านล่าง */
export function StudentTabBar({ onLogout }: { onLogout: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const isActive = (t: (typeof TABS)[number]) => ('exact' in t && t.exact ? pathname === t.href : pathname.startsWith(t.href) || ('also' in t && t.also.some((a) => pathname.startsWith(a))));
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    sheetRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="เมนูนักเรียน" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const on = isActive(t);
            return (
              <li key={t.href}>
                <Link href={t.href} aria-current={on ? 'page' : undefined} className={cx('flex h-16 flex-col items-center justify-center gap-0.5 text-[11.5px]', on ? 'font-semibold text-brand' : 'text-ink-muted')}>
                  <span className={cx('grid h-7 w-12 place-items-center rounded-full transition-colors duration-150', on && 'bg-brand-soft')}><t.Icon className="size-5" aria-hidden="true" /></span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" className={cx('flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11.5px]', moreActive ? 'font-semibold text-brand' : 'text-ink-muted')}>
              <span className={cx('grid h-7 w-12 place-items-center rounded-full', moreActive && 'bg-brand-soft')}><Menu className="size-5" aria-hidden="true" /></span>
              เพิ่มเติม
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="เมนูเพิ่มเติม">
          <button type="button" aria-label="ปิดเมนู" className="absolute inset-0 bg-black/30 [animation:fade_160ms_ease-out]" onClick={() => setOpen(false)} />
          <div ref={sheetRef} className="absolute inset-x-0 bottom-0 rounded-t-[20px] bg-surface p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_32px_hsl(350_30%_15%/0.18)] [animation:sheet_220ms_var(--ease-out)]">
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="font-semibold">เมนู</span>
              <button type="button" onClick={() => setOpen(false)} className="grid size-11 place-items-center rounded-full hover:bg-sunken" aria-label="ปิด"><X className="size-5" aria-hidden="true" /></button>
            </div>
            <ul className="grid gap-0.5">
              {MORE.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 text-[15px] hover:bg-sunken">
                    <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-brand-soft text-brand"><m.Icon className="size-5" aria-hidden="true" /></span>
                    {m.label}
                  </Link>
                </li>
              ))}
              <li><InstallApp variant="row" /></li>
              <li>
                <button type="button" onClick={onLogout} className="flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-[15px] text-danger hover:bg-danger-soft">
                  <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-danger-soft"><LogOut className="size-5" aria-hidden="true" /></span>
                  ออกจากระบบ
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
