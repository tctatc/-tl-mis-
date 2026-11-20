'use client';

import { DAY_NAMES, THAI_MONTHS_SHORT, bangkokDateParts, parseIsoDate, toBuddhistYear, type ScheduleView } from '@csis/shared';
import { CalendarDays, Clock, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader, TermSelect } from '@/components/academic';
import { CollegeTimetable } from '@/components/timetable';
import { Alert, Card, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';

type Tab = 'week' | 'today' | 'exam';
type Session = ScheduleView['sessions'][number];
const TINTS = ['bg-brand-soft ring-brand-border', 'bg-gold-soft ring-gold/40', 'bg-info-soft ring-info/25', 'bg-ok-soft ring-ok/25', 'bg-warn-soft ring-warn/25', 'bg-sunken ring-line-strong'];

/** วันในสัปดาห์ตามเวลาไทย 1=จันทร์ … 7=อาทิตย์ */
function todayDow() {
  const p = bangkokDateParts(new Date());
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return d === 0 ? 7 : d;
}

function examDate(iso: string) {
  const p = parseIsoDate(iso)!;
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return `${DAY_NAMES[dow === 0 ? 7 : dow]} ${p.day} ${THAI_MONTHS_SHORT[p.month - 1]} ${toBuddhistYear(p.year)}`;
}

export default function SchedulePage() {
  const [termId, setTermId] = useState<string>();
  const [tab, setTab] = useState<Tab>('week');
  const { data, error } = useApi<ScheduleView>(`/student/schedule${termId ? `?termId=${termId}` : ''}`);

  const tint = useMemo(() => {
    const codes = [...new Set(data?.sessions.map((s) => s.subject.code))];
    return (code: string) => TINTS[codes.indexOf(code) % TINTS.length]!;
  }, [data]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const days = [1, 2, 3, 4, 5, ...(data.sessions.some((s) => s.dayOfWeek >= 6) ? [6, 7] : [])];
  const byDay = (d: number) => data.sessions.filter((s) => s.dayOfWeek === d);
  const now = todayDow();
  const isCurrent = !!data.term?.isCurrent;
  // วันนี้ไม่มีเรียน (เช่น เสาร์-อาทิตย์) → แสดงวันถัดไปที่มีเรียน
  const nextDay = [...days.filter((d) => d >= now), ...days].find((d) => byDay(d).length > 0) ?? now;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'week', label: 'รายสัปดาห์' },
    ...(isCurrent ? [{ key: 'today' as Tab, label: 'วันนี้' }] : []),
    { key: 'exam', label: `ตารางสอบ (${data.exams.length})` },
  ];

  return (
    <div className="grid gap-6">
      <PageHeader title="ตารางเรียนและตารางสอบ" subtitle={data.term ? `ภาคเรียน ${data.term.label}` : undefined}
        actions={<TermSelect terms={data.terms} value={data.term?.id} onChange={(id) => { setTermId(id); setTab('week'); }} />} />

      {!data.term ? (
        <Card><EmptyState icon={<CalendarDays className="size-7" aria-hidden="true" />} title="ยังไม่มีตารางเรียน">ตารางเรียนจะขึ้นเมื่อลงทะเบียนแล้ว</EmptyState></Card>
      ) : (
        <>
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                className={cx('min-h-11 rounded-md px-4 text-[15px] whitespace-nowrap', tab === t.key ? 'bg-brand-soft font-medium text-brand' : 'text-ink-muted hover:bg-sunken')}>{t.label}</button>
            ))}
          </div>

          {tab === 'week' && (
            <>
              {/* จอใหญ่: ตารางแบบที่วิทยาลัยแจก */}
              <Card className="hidden p-4 md:block">
                <CollegeTimetable sessions={data.sessions} today={isCurrent ? now : undefined} />
              </Card>
              {/* มือถือ: รายการต่อวัน */}
              <div className="grid gap-3 md:hidden">
                {days.filter((d) => byDay(d).length).map((d) => (
                  <Card key={d} className="overflow-hidden">
                    <h2 className={cx('px-4 py-2 font-semibold', isCurrent && d === now ? 'bg-brand text-ink-inverse' : 'bg-sunken/60')}>วัน{DAY_NAMES[d]}{isCurrent && d === now ? ' · วันนี้' : ''}</h2>
                    <SessionList sessions={byDay(d)} tint={tint} />
                  </Card>
                ))}
              </div>
            </>
          )}

          {tab === 'today' && (
            <Card className="overflow-hidden">
              <h2 className="bg-sunken/60 px-4 py-2.5 font-semibold">
                {byDay(now).length ? `วันนี้ · วัน${DAY_NAMES[now]}` : `วันนี้ไม่มีเรียน · คาบถัดไปวัน${DAY_NAMES[nextDay]}`}
              </h2>
              <SessionList sessions={byDay(byDay(now).length ? now : nextDay)} tint={tint} />
            </Card>
          )}

          {tab === 'exam' && (
            data.exams.length === 0 ? <Card><EmptyState icon={<CalendarDays className="size-7" aria-hidden="true" />} title="ยังไม่ประกาศตารางสอบ" /></Card> : (
              <div className="grid gap-4 lg:grid-cols-2">
                {(['midterm', 'final'] as const).map((kind) => (
                  <Card key={kind} className="overflow-hidden">
                    <h2 className="bg-sunken/60 px-4 py-2.5 font-semibold">{kind === 'midterm' ? 'สอบกลางภาค' : 'สอบปลายภาค'}</h2>
                    <ul className="divide-y divide-line/70">
                      {data.exams.filter((e) => e.kind === kind).map((e) => (
                        <li key={e.subject.code} className="px-4 py-3">
                          <p className="font-medium">{e.subject.name} <span className="text-sm font-normal tabular-nums text-ink-muted">{e.subject.code}</span></p>
                          <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-ink-muted">
                            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden="true" />{examDate(e.date)}</span>
                            <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="size-3.5" aria-hidden="true" />{e.startTime}–{e.endTime}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{e.room}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function SessionList({ sessions, tint }: { sessions: Session[]; tint: (code: string) => string }) {
  return (
    <ul className="divide-y divide-line/70">
      {sessions.map((s) => (
        <li key={`${s.subject.code}-${s.startTime}`} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-3">
          <p className="text-sm font-semibold tabular-nums">{s.startTime}<br /><span className="font-normal text-ink-muted">{s.endTime}</span></p>
          <div className={cx('min-w-0 rounded-md px-3 py-2 ring-1', tint(s.subject.code))}>
            <p className="font-medium">{s.subject.name}</p>
            <p className="text-sm text-ink-muted"><span className="tabular-nums">{s.subject.code}</span> · ห้อง {s.room} · {s.teacher}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
