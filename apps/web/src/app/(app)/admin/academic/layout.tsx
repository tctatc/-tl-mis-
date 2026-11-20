'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui';

const SUB = [
  { href: '/admin/academic/plan', label: 'แผนการเรียน' },
  { href: '/admin/academic/schedule', label: 'ตารางเรียน' },
  { href: '/admin/academic/grades', label: 'ผลการเรียน' },
];

export default function AcademicLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label="ข้อมูลการเรียน" className="flex gap-1 overflow-x-auto border-b border-line">
        {SUB.map((t) => {
          const on = pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? 'page' : undefined}
              className={cx('-mb-px min-h-11 border-b-2 px-4 py-2.5 text-[15px] whitespace-nowrap', on ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted hover:text-ink')}>{t.label}</Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
