'use client';

import { formatGpa } from '@csis/shared';
import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, GradePill } from '@/components/academic';
import { Alert, Card, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { ClassPicker, ImportButton, TermPicker, useClasses, useTerms } from '../shared';

interface Grades {
  subjects: { code: string; name: string; credits: number }[];
  rows: { studentCode: string; name: string; groupNo: string; grades: Record<string, { grade: string; status: string; outcome: 'passed' | 'failed' | 'pending' }>; gpa: number | null }[];
  counts: { waiting: number; published: number };
}

export default function GradesAdmin() {
  const terms = useTerms();
  const classes = useClasses();
  const [termId, setTermId] = useState('');
  const [cls, setCls] = useState('');
  useEffect(() => { if (!termId && terms.length) setTermId(terms.find((t) => t.isCurrent)?.id ?? terms[0]!.id); }, [terms, termId]);
  useEffect(() => { if (!cls && classes.length) setCls(`${classes[0]!.programId}|${classes[0]!.yearLevel}|${classes[0]!.groupNo}`); }, [classes, cls]);
  const [programId, yearLevel, groupNo] = cls.split('|');
  const params = `termId=${termId}&programId=${programId}&yearLevel=${yearLevel}&groupNo=${encodeURIComponent(groupNo ?? '')}`;
  const data = useApi<Grades>(termId && cls ? `/admin/academic/grades?${params}` : null);
  const term = terms.find((t) => t.id === termId);

  const pending = data.data?.counts.waiting ?? 0;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="ผลการเรียนรายห้อง" subtitle="เกรดของนักเรียนทั้งห้อง ทุกวิชา · ครูผู้สอนเป็นคนกรอก งานวัดผลอนุมัติและประกาศที่แท็บ “ส่งผลการเรียน”"
        actions={<ImportButton kind="grade" terms={terms.filter((t) => !t.isCurrent)} onDone={() => void data.reload()} />} />
      <div className="flex flex-wrap items-end gap-3">
        <TermPicker terms={terms} value={termId} onChange={setTermId} />
        <ClassPicker classes={classes} value={cls} onChange={setCls} />
      </div>
      {data.error ? <Alert>{data.error}</Alert> : !data.data ? <Spinner /> : data.data.subjects.length === 0 ? (
        <Card><EmptyState icon={<GraduationCap className="size-7" aria-hidden="true" />} title="ห้องนี้ยังไม่มีผลการเรียนในภาคนี้">{term?.isCurrent ? 'ครูผู้สอนยังไม่ได้กรอกเกรด — ติดตามได้ที่แท็บ “ส่งผลการเรียน”' : 'ผลของภาคที่ผ่านมา ใช้ปุ่ม “นำเข้าผลย้อนหลัง” ยกมาจาก ศธ.02'}</EmptyState></Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-3 ring-1 ring-line/70">
            <span className="text-[15px]">ประกาศแล้ว <strong className="tabular-nums">{data.data.counts.published}</strong> · ยังไม่ประกาศ <strong className={cx('tabular-nums', pending > 0 && 'text-warn')}>{pending}</strong></span>
            {pending > 0 && <Link href="/admin/academic/grading" className="ml-auto text-[15px] font-medium text-brand underline underline-offset-2">ไปที่ส่งผลการเรียน</Link>}
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[15px]">
                <thead className="bg-sunken/50 text-left text-sm text-ink-muted">
                  <tr>
                    <th scope="col" className="sticky left-0 bg-sunken px-4 py-2 font-medium">นักเรียน</th>
                    {data.data.subjects.map((s) => <th key={s.code} scope="col" className="px-2 py-2 text-center font-medium whitespace-nowrap" title={s.name}><span className="tabular-nums">{s.code}</span><span className="block max-w-28 truncate text-xs font-normal">{s.name}</span></th>)}
                    <th scope="col" className="px-4 py-2 text-right font-medium">GPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {data.data.rows.map((r) => (
                    <tr key={r.studentCode}>
                      <th scope="row" className="sticky left-0 bg-surface px-4 py-2 text-left font-normal whitespace-nowrap"><span className="tabular-nums text-sm text-ink-muted">{r.studentCode}</span><span className="block">{r.name}</span></th>
                      {data.data!.subjects.map((s) => {
                        const g = r.grades[s.code];
                        return <td key={s.code} className="px-2 py-2 text-center">{g ? <span className={cx('inline-flex flex-col items-center', g.status !== 'published' && 'opacity-70')} title={g.status === 'published' ? 'ประกาศแล้ว' : 'ยังไม่ประกาศ'}><GradePill grade={g.grade} outcome={g.outcome} />{g.status !== 'published' && <span className="mt-0.5 text-xs text-warn">ยังไม่ประกาศ</span>}</span> : <span className="text-ink-muted">–</span>}</td>;
                      })}
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatGpa(r.gpa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
