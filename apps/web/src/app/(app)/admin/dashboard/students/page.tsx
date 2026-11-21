'use client';

import { LEVEL_LABEL } from '@csis/shared';
import { GraduationCap, PauseCircle, UserCheck, Users, UserX } from 'lucide-react';
import { PageHeader } from '@/components/academic';
import { BarList, Panel, StatLink } from '@/components/charts';
import { Alert, Spinner } from '@/components/ui';
import { useApi } from '@/lib/useApi';

interface Data {
  total: number;
  status: Record<string, number>;
  byLevelYear: { level: 'pvc' | 'pvs'; yearLevel: number; count: number }[];
  byDepartment: { id: string; name: string; pvc: number; pvs: number }[];
  byProgram: { id: string; name: string; level: 'pvc' | 'pvs'; department: string; departmentId: string; count: number }[];
}

/** ลิงก์ไปหน้ารายชื่อนักเรียนพร้อมตัวกรอง */
const list = (p: Record<string, string | number>) => `/admin/students?${new URLSearchParams(Object.entries(p).map(([k, v]) => [k, String(v)]))}`;

export default function StudentDashboard() {
  const { data, error } = useApi<Data>('/admin/dashboard/students');
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  const n = (k: string) => data.status[k] ?? 0;
  const studying = n('studying');
  const out = n('resigned') + n('dismissed');
  const fmt = (v: number) => v.toLocaleString('th-TH');

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="ข้อมูลนักเรียน นักศึกษา" subtitle="กดตัวเลขหรือแถบกราฟเพื่อดูรายชื่อ · กราฟนับเฉพาะคนที่กำลังศึกษา" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="ตัวเลขหลัก">
        <StatLink tone="brand" icon={<Users className="size-4" aria-hidden="true" />} label="ทั้งหมดในระบบ" value={fmt(data.total)} hint="คน" href="/admin/students" />
        <StatLink tone="ok" icon={<UserCheck className="size-4" aria-hidden="true" />} label="กำลังศึกษา" value={fmt(studying)} hint={data.total ? `${Math.round((studying / data.total) * 100)}% ของทั้งหมด` : 'คน'} href={list({ status: 'studying' })} />
        <StatLink icon={<GraduationCap className="size-4" aria-hidden="true" />} label="สำเร็จการศึกษา" value={fmt(n('graduated'))} hint="คน" href={list({ status: 'graduated' })} />
        <StatLink tone={n('on_leave') ? 'warn' : 'default'} icon={<PauseCircle className="size-4" aria-hidden="true" />} label="ลาพัก / รักษาสภาพ" value={fmt(n('on_leave'))} hint="คน" href={list({ status: 'on_leave' })} />
        <StatLink tone={out ? 'danger' : 'default'} icon={<UserX className="size-4" aria-hidden="true" />} label="ลาออก / พ้นสภาพ" value={fmt(out)} hint={`ลาออก ${n('resigned')} · พ้นสภาพ ${n('dismissed')}`} href={list({ status: n('dismissed') > n('resigned') ? 'dismissed' : 'resigned' })} />
      </section>

      {studying === 0 ? (
        <Alert tone="info">ยังไม่มีนักเรียนที่กำลังศึกษา นำเข้ารายชื่อได้ที่ <a className="underline" href="/admin/import">นำเข้าข้อมูล</a></Alert>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="แยกตามระดับชั้น">
              <BarList unit="คน" items={data.byLevelYear.map((r) => ({
                key: `${r.level}${r.yearLevel}`, label: `${LEVEL_LABEL[r.level]} ${r.yearLevel}`, value: r.count,
                tone: r.level === 'pvc' ? 'brand' : 'gold', href: list({ level: r.level, yearLevel: r.yearLevel, status: 'studying' }),
              }))} />
              <p className="mt-2 flex gap-4 px-2 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand" aria-hidden="true" />ปวช. {fmt(data.byLevelYear.filter((r) => r.level === 'pvc').reduce((a, r) => a + r.count, 0))} คน</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-gold" aria-hidden="true" />ปวส. {fmt(data.byLevelYear.filter((r) => r.level === 'pvs').reduce((a, r) => a + r.count, 0))} คน</span>
              </p>
            </Panel>
            <Panel title="แยกตามแผนกวิชา">
              <BarList unit="คน" items={data.byDepartment.map((d) => ({
                key: d.id, label: d.name, value: d.pvc + d.pvs, sub: [d.pvc && `ปวช. ${d.pvc}`, d.pvs && `ปวส. ${d.pvs}`].filter(Boolean).join(' · '),
                href: list({ departmentId: d.id, status: 'studying' }),
              }))} />
            </Panel>
          </div>
          <Panel title="แยกตามสาขาวิชา">
            <BarList unit="คน" items={data.byProgram.map((p) => ({
                key: p.id, label: p.name, sub: `${LEVEL_LABEL[p.level]} · ${p.department}`, value: p.count,
                tone: p.level === 'pvc' ? 'brand' : 'gold', href: list({ programId: p.id, status: 'studying' }),
              }))} />
          </Panel>
        </>
      )}
    </div>
  );
}
