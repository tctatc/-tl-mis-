'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, type ReactNode } from 'react';
import { Alert, cx } from '@/components/ui';
import { isAdminUser, useMe } from '@/lib/me';

/** แบ่ง 3 หมวด: ดูภาพรวม · คนและข้อมูล · ตั้งค่า (มีเส้นคั่นระหว่างหมวด) */
const TABS = [
  { href: '/admin', label: 'ภาพรวม', exact: true, group: 1 },
  { href: '/admin/dashboard/students', label: 'สถิตินักเรียน', group: 1 },
  { href: '/admin/dashboard/requests', label: 'สถิติคำร้อง', group: 1 },
  { href: '/admin/students', label: 'นักเรียน', group: 2 },
  { href: '/admin/staff', label: 'ครูและบุคลากร', group: 2 },
  { href: '/admin/users', label: 'ผู้ใช้งาน', group: 2 },
  { href: '/admin/import', label: 'นำเข้าข้อมูล', group: 2 },
  { href: '/admin/positions', label: 'ผู้ลงนาม / หัวหน้าสาขา', group: 3 },
  { href: '/admin/audit', label: 'ประวัติการใช้งาน', group: 3 },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const pathname = usePathname();
  const registrar = !!me?.roles.includes('REGISTRAR');
  const assessmentOnly = !!me && !isAdminUser(me) && me.roles.includes('ASSESSMENT_STAFF');
  const importOnly = !!me && !isAdminUser(me) && registrar;
  const registryPage = pathname.startsWith('/admin/students') || pathname.startsWith('/admin/dashboard') || pathname.startsWith('/admin/import') || pathname.startsWith('/admin/academic') || pathname.startsWith('/admin/registry');
  if (!me || (!isAdminUser(me) && !(importOnly && registryPage) && !(assessmentOnly && pathname.startsWith('/admin/academic')))) return <Alert>หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</Alert>;
  // การเรียนและเกรดเป็นเมนูบนสุดแยกต่างหาก ไม่ต้องแสดงแถบผู้ดูแลระบบซ้อน
  if (pathname.startsWith('/admin/academic') || pathname.startsWith('/admin/registry')) return <>{children}</>;
  const tabs = importOnly ? TABS.filter((t) => t.href === '/admin/students' || t.href === '/admin/import' || t.href.startsWith('/admin/dashboard')) : TABS;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label="เมนูผู้ดูแลระบบ" className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabs.map((t, i) => {
          const on = t.exact ? pathname === t.href : pathname.startsWith(t.href);
          const divider = i > 0 && tabs[i - 1]!.group !== t.group;
          return (
            <Fragment key={t.href}>
            {divider && <span className="mx-1 my-2 w-px shrink-0 bg-line-strong" aria-hidden="true" />}
            <Link href={t.href} aria-current={on ? 'page' : undefined}
              className={cx('min-h-11 shrink-0 rounded-full px-4 py-2.5 text-[15px] whitespace-nowrap ring-1', on ? 'bg-brand-deep font-medium text-ink-inverse ring-brand-deep' : 'bg-surface text-ink-muted ring-line hover:text-ink')}>
              {t.label}
            </Link>
            </Fragment>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
