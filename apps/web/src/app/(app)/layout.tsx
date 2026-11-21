'use client';

import { CircleHelp, KeyRound, LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { InstallApp } from '@/components/InstallApp';
import { StudentTabBar } from '@/components/MobileNav';
import { Spinner, cx } from '@/components/ui';
import { MeProvider, homeOf, isAdminUser, isStaffUser, useMe } from '@/lib/me';

const ACADEMIC = '/admin/academic';
const REGISTRY = '/admin/registry';
interface NavLink { href: string; label: string; match?: string[]; except?: string[] }
const STUDENT_LINKS: NavLink[] = [
  { href: '/student', label: 'หน้าหลัก' },
  { href: '/student/plan', label: 'แผนการเรียน' },
  { href: '/student/registration', label: 'บัตรลงทะเบียน' },
  { href: '/student/schedule', label: 'ตารางเรียน' },
  { href: '/student/grades', label: 'ผลการเรียน' },
  { href: '/student/profile', label: 'ข้อมูลประวัติ' },
  { href: '/student/requests', label: 'คำร้อง', match: ['/student/requests', '/student/new', '/requests'] },
];

function Shell({ children }: { children: ReactNode }) {
  const { me, loading, logout } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (me.mustChangePassword) router.replace('/change-password');
  }, [loading, me, pathname, router]);

  if (loading || !me || me.mustChangePassword) return <Spinner />;

  const links: NavLink[] = [
    ...(me.student ? STUDENT_LINKS : []),
    ...(isAdminUser(me) ? [{ href: '/admin', label: 'ผู้ดูแลระบบ', except: [ACADEMIC, REGISTRY] }] : []),
    // งานทะเบียน: กลุ่มเรียน เลื่อนชั้น สำเร็จการศึกษา ข้อมูลนักเรียน
    ...(isAdminUser(me) || me.roles.includes('REGISTRAR') ? [{ href: REGISTRY, label: 'งานทะเบียน', match: [REGISTRY, ...(isAdminUser(me) ? [] : ['/admin/students'])] }] : []),
    ...(isStaffUser(me) ? [{ href: '/staff', label: 'พิจารณาคำร้อง' }] : []),
    // แผน/ตาราง/เกรด อยู่เมนูบนสุดข้างคำร้อง — เดิมซ่อนอยู่ใต้ผู้ดูแลระบบ 3 ชั้น หาไม่เจอ
    ...(isAdminUser(me) || me.roles.some((r) => r === 'REGISTRAR' || r === 'ASSESSMENT_STAFF') ? [{ href: ACADEMIC, label: 'การเรียนและเกรด' }] : []),
    // ครูผู้สอน: กรอกเกรดวิชาที่ตัวเองสอน
    ...(me.roles.some((r) => r === 'TEACHER' || r === 'ADVISOR') ? [{ href: '/teach', label: 'กรอกเกรด' }] : []),
  ];
  // เมนูเยอะ (ผู้ดูแลที่มีหลายบทบาท) → ซ่อนชื่อ/คำบนปุ่มขวาจนจอกว้างพอ ไม่ให้ตัดบรรทัด
  const crowded = links.length > 3;
  const active = (l: NavLink) => (l.except?.some((e) => pathname.startsWith(e)) ? false : l.match ? l.match.some((m) => pathname.startsWith(m)) : l.href === '/student' ? pathname === '/student' : pathname.startsWith(l.href));

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">ข้ามไปเนื้อหา</a>
      <header className="no-print sticky top-0 z-20 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href={homeOf(me)} className="shrink-0 rounded-md" aria-label="หน้าแรก"><Brand compact /></Link>
          <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="เมนูหลัก">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l) ? 'page' : undefined}
                className={cx('rounded-md px-2.5 py-2 text-[15px] whitespace-nowrap', active(l) ? 'bg-brand-soft font-medium text-brand' : 'text-ink-muted hover:bg-sunken hover:text-ink')}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <InstallApp className="hidden lg:block" />
            <Link href={`/help?for=${me.student ? 'student' : isAdminUser(me) ? 'admin' : me.roles.some((r) => r === 'TEACHER' || r === 'ADVISOR') && !me.roles.some((r) => r === 'REGISTRAR' || r === 'ASSESSMENT_STAFF' || r === 'CURRICULUM_STAFF') ? 'teacher' : 'staff'}`}
              title="คู่มือการใช้งาน" className={cx(me.student ? 'hidden lg:inline-flex' : 'inline-flex', 'min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-ink-muted hover:bg-sunken hover:text-ink')}>
              <CircleHelp className="size-4" aria-hidden="true" /> <span className={crowded ? 'sr-only 2xl:not-sr-only' : 'sr-only sm:not-sr-only'}>คู่มือ</span>
            </Link>
            <span className={cx('hidden max-w-[12rem] truncate text-sm text-ink-muted', me.student || crowded ? '2xl:block' : 'xl:block')}>{me.displayName}</span>
            {!me.student && <Link href="/change-password" title="เปลี่ยนรหัสผ่าน" className={cx('inline-flex', 'min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-ink-muted hover:bg-sunken hover:text-ink')}>
              <KeyRound className="size-4" aria-hidden="true" /> <span className={crowded ? 'sr-only 2xl:not-sr-only' : 'sr-only sm:not-sr-only'}>เปลี่ยนรหัสผ่าน</span>
            </Link>}
            <button type="button" onClick={() => void logout()} className={cx(me.student ? 'hidden lg:inline-flex' : 'inline-flex', 'min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm whitespace-nowrap text-ink-muted hover:bg-sunken hover:text-ink')} title="ออกจากระบบ">
              <LogOut className="size-4" aria-hidden="true" /> <span className={me.student || crowded ? 'sr-only 2xl:not-sr-only' : 'sr-only sm:not-sr-only'}>ออกจากระบบ</span>
            </button>
          </div>
        </div>
        {links.length > 1 && !me.student && (
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden" aria-label="เมนูหลัก">
            {links.map((l) => (
              <Link key={l.href} href={l.href} aria-current={active(l) ? 'page' : undefined} className={cx('rounded-md px-3 py-1.5 text-sm whitespace-nowrap', active(l) ? 'bg-brand-soft text-brand' : 'text-ink-muted')}>{l.label}</Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className={cx('mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8', me.student && 'pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8')}>{children}</main>
      {me.student && <StudentTabBar onLogout={() => void logout()} />}
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return <MeProvider><Shell>{children}</Shell></MeProvider>;
}
