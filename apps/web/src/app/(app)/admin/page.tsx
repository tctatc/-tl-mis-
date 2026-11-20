'use client';

import { STATUS_LABEL, STUDENT_STATUS_LABEL, formatThaiDateTime, type RequestStatus } from '@csis/shared';
import Link from 'next/link';
import { PageHeader, Stat } from '@/components/academic';
import { Alert, Card, Spinner, StatusBadge } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { actionLabel } from './labels';

interface Stats {
  students: number; staff: number; departments: number; programs: number; curriculums: number;
  studentsByStatus: Record<string, number>; requestsByStatus: Partial<Record<RequestStatus, number>>;
  term: { year: number; term: number; registered: number } | null;
  logins7d: { success: number; failed: number };
  recent: { id: string; action: string; entity: string; actor: string; at: string }[];
}

export default function AdminHome() {
  const { data, error } = useApi<Stats>('/admin/stats');
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  const reqTotal = Object.values(data.requestsByStatus).reduce((a, b) => a + (b ?? 0), 0);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="ภาพรวมระบบ" subtitle={data.term ? `ภาคเรียนปัจจุบัน ${data.term.term}/${data.term.year}` : 'ยังไม่ได้ตั้งภาคเรียนปัจจุบัน'} />
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="ตัวเลขหลัก">
        <Stat tone="brand" label="นักเรียน นักศึกษา" value={data.students.toLocaleString('th-TH')} hint={`กำลังศึกษา ${data.studentsByStatus.studying ?? 0} คน`} />
        <Stat label="ครูและบุคลากร" value={data.staff} hint={`${data.departments} แผนก · ${data.programs} สาขา · ${data.curriculums} หลักสูตร`} />
        <Stat label="ลงทะเบียนภาคนี้" value={data.term?.registered ?? '–'} hint="คน" />
        <Stat label="เข้าสู่ระบบ 7 วัน" value={data.logins7d.success} hint={`ล้มเหลว ${data.logins7d.failed} ครั้ง`} tone={data.logins7d.failed > 20 ? 'warn' : 'default'} />
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <div className="flex items-baseline justify-between"><h2 className="font-semibold">คำร้อง</h2><Link href="/staff" className="text-sm text-brand hover:underline">ดูทั้งหมด</Link></div>
          {reqTotal === 0 ? <p className="mt-3 text-ink-muted">ยังไม่มีคำร้อง</p> : (
            <ul className="mt-3 grid gap-2">
              {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => (
                <li key={s} className="flex items-center justify-between"><StatusBadge status={s} /><span className="font-semibold tabular-nums">{data.requestsByStatus[s] ?? 0}</span></li>
              ))}
            </ul>
          )}
          <h3 className="mt-5 font-semibold">สถานภาพนักเรียน</h3>
          <ul className="mt-2 grid gap-1.5 text-[15px]">
            {Object.entries(STUDENT_STATUS_LABEL).map(([k, label]) => (
              <li key={k} className="flex justify-between"><span className="text-ink-muted">{label}</span><span className="tabular-nums">{data.studentsByStatus[k] ?? 0}</span></li>
            ))}
          </ul>
        </Card>
        <Card className="overflow-hidden">
          <div className="flex items-baseline justify-between px-4 pt-4 sm:px-5"><h2 className="font-semibold">ความเคลื่อนไหวล่าสุด</h2><Link href="/admin/audit" className="text-sm text-brand hover:underline">ประวัติทั้งหมด</Link></div>
          <ul className="mt-2 divide-y divide-line/70">
            {data.recent.map((r) => (
              <li key={r.id} className="px-4 py-2.5 sm:px-5"><p className="text-[15px]"><span className="font-medium">{r.actor}</span> · {actionLabel(r.action)}</p><p className="text-sm text-ink-muted">{formatThaiDateTime(r.at)}</p></li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
