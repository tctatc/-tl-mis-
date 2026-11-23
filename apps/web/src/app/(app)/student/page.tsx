'use client';

import {
  DAY_NAMES, LEVEL_LABEL, bangkokDateParts, formatGpa, fullName,
  type GradesView, type RegistrationCardView, type RequestSummary, type ScheduleView,
} from '@csis/shared';
import { BookOpen, CalendarDays, ClipboardList, FileText, GraduationCap, UserRound } from 'lucide-react';
import Link from 'next/link';
import { Stat } from '@/components/academic';
import { RequestList } from '@/components/RequestList';
import { StudentQrButton } from '@/components/StudentScan';
import { Card } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useApi } from '@/lib/useApi';

const TILES = [
  { href: '/student/plan', label: 'แผนการเรียน', hint: 'วิชาที่เรียนแล้วและที่เหลือ', Icon: BookOpen },
  { href: '/student/registration', label: 'บัตรลงทะเบียน', hint: 'ดูและพิมพ์บัตร', Icon: ClipboardList },
  { href: '/student/schedule', label: 'ตารางเรียน', hint: 'ตารางเรียนและตารางสอบ', Icon: CalendarDays },
  { href: '/student/grades', label: 'ผลการเรียน', hint: 'เกรดรายภาคและ GPAX', Icon: GraduationCap },
  { href: '/student/profile', label: 'ข้อมูลประวัติ', hint: 'ข้อมูลส่วนตัวและผู้ปกครอง', Icon: UserRound },
  { href: '/student/requests', label: 'คำร้องออนไลน์', hint: 'ยื่นและติดตามคำร้อง', Icon: FileText },
];

function todayDow() {
  const p = bangkokDateParts(new Date());
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return d === 0 ? 7 : d;
}

export default function StudentDashboard() {
  const { me } = useMe();
  const grades = useApi<GradesView>('/student/grades').data;
  const card = useApi<RegistrationCardView>('/student/registration').data;
  const schedule = useApi<ScheduleView>('/student/schedule').data;
  const mine = useApi<RequestSummary[]>('/requests/mine').data;
  const s = me?.student;
  if (!s) return null;

  const dow = todayDow();
  const today = schedule?.term?.isCurrent ? schedule.sessions.filter((x) => x.dayOfWeek === dow) : [];
  const open = mine?.filter((r) => r.status === 'pending' || r.status === 'returned') ?? [];

  return (
    <div className="grid gap-6">
      <section className="rise">
        <p className="text-sm text-ink-muted">สวัสดี</p>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{fullName(s)}</h1>
        <p className="mt-1 text-[15px] text-ink-muted"><span className="tabular-nums">{s.studentCode}</span> · {LEVEL_LABEL[s.level]} {s.program} ปี {s.yearLevel} กลุ่ม {s.groupNo} · {s.department}</p>
        <StudentQrButton code={s.studentCode} name={fullName(s)} className="mt-3" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุป">
        <Stat tone="brand" label="เกรดเฉลี่ยสะสม (GPAX)" value={grades ? formatGpa(grades.gpax) : '…'} hint={grades ? `${grades.creditsEarned} หน่วยกิตที่ได้` : undefined} />
        <Stat label={`ลงทะเบียน ${card?.term?.label ?? ''}`} value={card ? card.totalCredits : '…'} hint={card ? `หน่วยกิต · ${card.subjects.length} รายวิชา` : undefined} />
        <Stat label="วิชาค้าง / รอผล" value={grades ? grades.failedOutstanding.length : '…'} hint={grades?.failedOutstanding.length ? 'ดูในหน้าผลการเรียน' : 'ไม่มี'} tone={grades?.failedOutstanding.length ? 'warn' : 'default'} />
        <Stat label="คำร้องที่กำลังดำเนินการ" value={mine ? open.length : '…'} hint={open.some((r) => r.status === 'returned') ? 'มีคำร้องถูกส่งกลับ' : undefined} tone={open.some((r) => r.status === 'returned') ? 'warn' : 'default'} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
            <h2 className="font-semibold">เรียนวันนี้ · วัน{DAY_NAMES[dow]}</h2>
            <Link href="/student/schedule" className="text-sm text-brand hover:underline">ตารางทั้งสัปดาห์</Link>
          </div>
          {today.length === 0 ? <p className="px-4 py-6 text-ink-muted">วันนี้ไม่มีคาบเรียน</p> : (
            <ul className="divide-y divide-line/70">
              {today.map((x) => (
                <li key={`${x.subject.code}-${x.startTime}`} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
                  <span className="font-semibold tabular-nums">{x.startTime}–{x.endTime}</span>
                  <span className="min-w-0"><span className="block truncate font-medium">{x.subject.name}</span><span className="text-sm text-ink-muted">ห้อง {x.room} · {x.teacher}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line/80 px-4 py-3">
            <h2 className="font-semibold">คำร้องล่าสุด</h2>
            <Link href="/student/requests" className="text-sm text-brand hover:underline">ยื่นคำร้อง</Link>
          </div>
          {mine && mine.length > 0 ? <RequestList items={mine.slice(0, 3)} /> : <p className="px-4 py-6 text-ink-muted">ยังไม่มีคำร้อง</p>}
        </Card>
      </div>

      <nav aria-label="เมนูนักเรียน" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map(({ href, label, hint, Icon }) => (
          <Link key={href} href={href} className="group flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70 transition-[box-shadow,transform] duration-150 hover:ring-brand-border active:scale-[0.98]">
            <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] bg-brand-soft text-brand"><Icon className="size-5" aria-hidden="true" /></span>
            <span><span className="block font-medium group-hover:text-brand">{label}</span><span className="text-sm text-ink-muted">{hint}</span></span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
