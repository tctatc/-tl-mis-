'use client';

import { ArrowLeft, BookOpen, FileImage, QrCode } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/Brand';
import { cx } from '@/components/ui';

const TABS = [
  { href: '/help', icon: BookOpen, label: 'คู่มือแบบละเอียด' },
  { href: '/help/poster', icon: FileImage, label: 'โปสเตอร์ / PDF' },
  { href: '/help/qr', icon: QrCode, label: 'QR แบบฟอร์ม' },
];

/** แถบบนของหน้าช่วยเหลือ (เปิดได้โดยไม่ต้องเข้าสู่ระบบ) */
export function HelpNav() {
  const path = usePathname();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-line/80 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0 shrink rounded-md" aria-label="กลับหน้าแรก"><Brand compact /></Link>
        <Link href="/" className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-[15px] text-ink-muted hover:bg-sunken hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />กลับเข้าระบบ</Link>
      </div>
      <nav aria-label="หน้าช่วยเหลือ" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
        {TABS.map(({ href, icon: Icon, label }) => {
          const active = path === href;
          return (
            <Link key={href} href={href} aria-current={active ? 'page' : undefined}
              className={cx('inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px]', active ? 'bg-brand-deep font-medium text-white' : 'text-ink-muted hover:bg-sunken hover:text-ink')}>
              <Icon className="size-4" aria-hidden="true" />{label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
