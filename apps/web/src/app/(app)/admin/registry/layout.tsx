'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cx } from '@/components/ui';

const SUB = [
  { href: '/admin/registry/groups', label: 'กลุ่มเรียน' },
  { href: '/admin/registry/promotion', label: 'เลื่อนชั้น' },
  { href: '/admin/registry/graduation', label: 'สำเร็จการศึกษา' },
  { href: '/admin/students', label: 'ข้อมูลนักเรียน' },
  { href: '/admin/import', label: 'นำเข้าข้อมูล' },
  { href: '/admin/dashboard/students', label: 'สถิติ' },
];

/** งานทะเบียน (เมนูเดียวกับ ศธ.02): กลุ่มเรียน · เลื่อนชั้น · สำเร็จการศึกษา */
export default function RegistryLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label="งานทะเบียน" className="flex gap-1 overflow-x-auto border-b border-line">
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
