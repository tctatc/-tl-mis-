'use client';

import { DAY_NAMES } from '@csis/shared';
import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { Alert, Card, Spinner } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { ClassPicker, ImportButton, TermPicker, useClasses, useTerms } from '../shared';

interface Schedule { students: number; sessions: { id: string; dayOfWeek: number; startTime: string; endTime: string; room: string; code: string; name: string; credits: number; teacher: string; enrolled: number }[] }

export default function ScheduleAdmin() {
  const terms = useTerms();
  const classes = useClasses();
  const [termId, setTermId] = useState('');
  const [cls, setCls] = useState('');
  useEffect(() => { if (!termId && terms.length) setTermId(terms.find((t) => t.isCurrent)?.id ?? terms[0]!.id); }, [terms, termId]);
  useEffect(() => { if (!cls && classes.length) setCls(`${classes[0]!.programId}|${classes[0]!.yearLevel}|${classes[0]!.groupNo}`); }, [classes, cls]);
  const [programId, yearLevel, groupNo] = cls.split('|');
  const q = termId && cls ? `/admin/academic/schedule?termId=${termId}&programId=${programId}&yearLevel=${yearLevel}&groupNo=${encodeURIComponent(groupNo ?? '')}` : null;
  const data = useApi<Schedule>(q);
  const days = [...new Set(data.data?.sessions.map((s) => s.dayOfWeek))].sort();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="ตารางเรียน" subtitle="ตารางของแต่ละห้อง · นำเข้าแล้วระบบลงทะเบียนวิชาให้นักเรียนในห้องเอง"
        actions={<ImportButton kind="schedule" terms={terms} termId={termId} onDone={() => void data.reload()} />} />
      <div className="flex flex-wrap items-end gap-3">
        <TermPicker terms={terms} value={termId} onChange={setTermId} />
        <ClassPicker classes={classes} value={cls} onChange={setCls} />
      </div>
      {!q ? <Card><EmptyState icon={<CalendarDays className="size-7" aria-hidden="true" />} title="เลือกภาคเรียนและห้อง" /></Card>
        : data.error ? <Alert>{data.error}</Alert> : !data.data ? <Spinner /> : data.data.sessions.length === 0 ? (
          <Card><EmptyState icon={<CalendarDays className="size-7" aria-hidden="true" />} title="ห้องนี้ยังไม่มีตารางเรียนในภาคนี้">กด “นำเข้าจากไฟล์” เพื่อใส่ตารางเรียน</EmptyState></Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {days.map((d) => (
              <Card key={d} className="overflow-hidden">
                <h2 className="border-b border-line/80 bg-sunken/50 px-4 py-2.5 font-semibold">วัน{DAY_NAMES[d]}</h2>
                <ul className="divide-y divide-line/70">
                  {data.data!.sessions.filter((s) => s.dayOfWeek === d).map((s) => (
                    <li key={s.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 px-4 py-2.5 text-[15px]">
                      <span className="font-semibold tabular-nums">{s.startTime}–{s.endTime}</span>
                      <span className="min-w-0"><span className="block font-medium">{s.name}</span><span className="text-sm text-ink-muted"><span className="tabular-nums">{s.code}</span> · ห้อง {s.room || '–'} · {s.teacher || 'ยังไม่ระบุครู'} · ลงทะเบียน {s.enrolled} คน</span></span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
