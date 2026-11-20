'use client';

import { tpn, type PlanStatus, type StudyPlanView } from '@csis/shared';
import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, GradePill, PageHeader, Stat } from '@/components/academic';
import { Alert, Card, Spinner, cx } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useApi } from '@/lib/useApi';

const STATUS: Record<PlanStatus, { label: string; cls: string }> = {
  passed: { label: 'ผ่าน', cls: 'text-ok' },
  failed: { label: 'ไม่ผ่าน · ต้องเรียนซ้ำ', cls: 'text-danger' },
  pending: { label: 'รอผล (ร)', cls: 'text-warn' },
  enrolled: { label: 'กำลังเรียน', cls: 'text-info' },
  remaining: { label: 'ยังไม่เรียน', cls: 'text-ink-muted' },
};
type Filter = 'all' | 'todo' | 'failed';

export default function StudyPlanPage() {
  const { data, error, loading } = useApi<StudyPlanView>('/student/study-plan');
  const ctx = useApi<{ current: { year: number; term: number } }>('/student/form-context').data;
  const { me } = useMe();
  const [filter, setFilter] = useState<Filter>('all');
  /** 'all' หรือ "ชั้นปี-ภาค" เช่น '2-2' — เริ่มที่ภาคที่นักเรียนกำลังเรียน */
  const [termKey, setTermKey] = useState<string | null>(null);

  useEffect(() => {
    if (termKey !== null || !data || !ctx || !me?.student) return;
    const key = `${me.student.yearLevel}-${Math.min(ctx.current.term, 2)}`;
    setTermKey(data.groups.some((g) => `${g.yearLevel}-${g.term}` === key) ? key : 'all');
  }, [termKey, data, ctx, me?.student]);

  if (error) return <Alert>{error}</Alert>;
  if (loading || !data) return <Spinner />;
  if (!data.curriculum) return <EmptyState icon={<BookOpen className="size-7" aria-hidden="true" />} title="ยังไม่ได้ผูกหลักสูตร">ติดต่องานทะเบียนให้กำหนดหลักสูตรของคุณ</EmptyState>;

  const s = data.summary;
  const pct = s.minCredits ? Math.min(100, Math.round((s.creditsEarned / s.minCredits) * 100)) : 0;
  const selected = termKey ?? 'all';
  const groups = data.groups.filter((g) => selected === 'all' || `${g.yearLevel}-${g.term}` === selected);
  const currentKey = me?.student && ctx ? `${me.student.yearLevel}-${Math.min(ctx.current.term, 2)}` : '';
  const show = (st: PlanStatus) => filter === 'all' || (filter === 'failed' ? st === 'failed' : st !== 'passed');

  return (
    <div className="grid gap-6">
      <PageHeader title="แผนการเรียน" subtitle={data.curriculum.name} />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="สรุปความก้าวหน้า">
        <Stat tone="brand" label="หน่วยกิตที่ได้แล้ว" value={<>{s.creditsEarned}<span className="text-lg font-normal text-white/70"> / {s.minCredits}</span></>}
          hint={<span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="ความก้าวหน้าหน่วยกิต"><span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></span>} />
        <Stat label="ผ่านแล้ว" value={s.passed} hint={`จาก ${s.total} รายวิชาในแผน`} />
        <Stat label="กำลังเรียน / รอผล" value={s.enrolled} hint="ภาคเรียนนี้" />
        <Stat label="ยังไม่เรียน" value={s.remaining} hint={s.failed ? `ไม่ผ่าน ${s.failed} วิชา` : 'ไม่มีวิชาค้าง'} tone={s.failed ? 'warn' : 'default'} />
      </section>

      <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[15px]">
        <span className="text-ink-muted">ภาคเรียน</span>
        <select value={selected} onChange={(e) => setTermKey(e.target.value)}
          className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 font-medium ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="all">ทั้งหมด ({data.groups.length} ภาคเรียน)</option>
          {data.groups.map((g) => {
            const k = `${g.yearLevel}-${g.term}`;
            return <option key={k} value={k}>ปีที่ {g.yearLevel} ภาคเรียนที่ {g.term}{k === currentKey ? ' (ภาคนี้)' : ''}</option>;
          })}
        </select>
      </label>
      <div className="flex gap-1.5" role="group" aria-label="กรองรายวิชา">
        {([['all', 'ทั้งหมด'], ['todo', 'ที่ยังเหลือ'], ['failed', 'ไม่ผ่าน']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={cx('min-h-10 rounded-full px-4 text-[15px] ring-1', filter === k ? 'bg-brand text-ink-inverse ring-brand' : 'bg-surface ring-line-strong hover:bg-sunken')}>{label}</button>
        ))}
      </div>
      </div>

      <div className={selected === 'all' ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4'}>
        {groups.map((g) => {
          const items = g.items.filter((i) => show(i.status));
          const credits = g.items.reduce((sum, i) => sum + i.subject.credits, 0);
          return (
            <Card key={`${g.yearLevel}-${g.term}`} className="overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-line/80 bg-sunken/50 px-4 py-2.5">
                <h2 className="font-semibold">ปีที่ {g.yearLevel} ภาคเรียนที่ {g.term}</h2>
                <span className="text-sm tabular-nums text-ink-muted">ผ่าน {g.items.filter((i) => i.status === 'passed').length}/{g.items.length} วิชา · {credits} หน่วยกิต</span>
              </div>
              {items.length === 0 ? <p className="px-4 py-5 text-sm text-ink-muted">ไม่มีรายวิชาตามตัวกรอง</p> : (
                <ul className="divide-y divide-line/70">
                  {items.map((i) => (
                    <li key={i.subject.code} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{i.subject.name}</p>
                        <p className="text-sm text-ink-muted"><span className="tabular-nums">{i.subject.code}</span> · {tpn(i.subject)} · <span className={STATUS[i.status].cls}>{STATUS[i.status].label}</span></p>
                      </div>
                      {i.grade ? <GradePill grade={i.grade} outcome={i.status === 'passed' ? 'passed' : i.status === 'failed' ? 'failed' : 'pending'} /> : <span className="text-sm text-ink-muted">–</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
