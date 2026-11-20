'use client';

import { GRADE_MEANING, formatGpa, type Grade, type GradesView } from '@csis/shared';
import { GraduationCap, Printer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EmptyState, GradePill, PageHeader, Stat } from '@/components/academic';
import { Alert, Button, Card, Spinner } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const KIND: Record<string, string> = { repeat: 'เรียนซ้ำ', regrade: 'รีเกรด' };

export default function GradesPage() {
  const { data, error, loading } = useApi<GradesView>('/student/grades');
  // null = ยังไม่ได้เลือก → เปิดที่ภาคล่าสุด (terms เรียงจากล่าสุดไปเก่าสุด)
  const [termId, setTermId] = useState<string | null>(null);
  const router = useRouter();
  if (error) return <Alert>{error}</Alert>;
  if (loading || !data) return <Spinner />;
  if (data.terms.length === 0) return (
    <div className="grid gap-6">
      <PageHeader title="ผลการเรียน" />
      <Card><EmptyState icon={<GraduationCap className="size-7" aria-hidden="true" />} title="ยังไม่มีผลการเรียนที่ประกาศ">ผลการเรียนจะขึ้นที่นี่หลังงานวัดผลประกาศผล</EmptyState></Card>
    </div>
  );

  const latest = data.terms[0]!;
  const selected = termId === 'all' ? 'all' : data.terms.find((t) => t.term.id === termId)?.term.id ?? latest.term.id;
  const shown = selected === 'all' ? data.terms : data.terms.filter((t) => t.term.id === selected);
  const focus = selected === 'all' ? latest : shown[0]!;
  return (
    <div className="grid gap-6">
      <PageHeader title="ผลการเรียน" subtitle="แสดงเฉพาะผลที่ประกาศแล้ว · ค่าเฉลี่ยตัดทศนิยม 2 ตำแหน่ง" />

      <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="flex flex-wrap items-center gap-2 text-[15px]">
        <span className="text-ink-muted">ภาคเรียน</span>
        <select value={selected} onChange={(e) => setTermId(e.target.value)}
          className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 font-medium ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand">
          {data.terms.map((t, i) => <option key={t.term.id} value={t.term.id}>ภาคเรียนที่ {t.term.label}{i === 0 ? ' (ล่าสุด)' : ''}</option>)}
          {data.terms.length > 1 && <option value="all">ทุกภาคเรียน ({data.terms.length} ภาค)</option>}
        </select>
      </label>
      <Button variant="secondary" onClick={() => router.push(`/print/grades?term=${selected}`)} icon={<Printer className="size-4" aria-hidden="true" />}>
        พิมพ์รายงานผลการศึกษา
      </Button>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="สรุปผลการเรียน">
        <Stat tone="brand" label="เกรดเฉลี่ยสะสม (GPAX)" value={formatGpa(data.gpax)} hint={`ถึงภาคเรียน ${latest.term.label}`} />
        {/* มือถือ: เกรดเฉลี่ยรายภาคอยู่ที่หัวตารางของภาคนั้นแล้ว ไม่ต้องซ้ำ — ให้รายวิชาขึ้นมาเร็วขึ้น */}
        <div className="hidden sm:block"><Stat label={`เกรดเฉลี่ยภาคเรียน ${focus.term.label}${focus === latest ? ' (ล่าสุด)' : ''}`} value={formatGpa(focus.gpa)} hint={`${focus.credits} หน่วยกิต`} /></div>
        <Stat label="หน่วยกิตที่ได้" value={data.creditsEarned} hint="นับเฉพาะวิชาที่ผ่าน" />
      </section>

      {shown.map((t) => (
        <Card key={t.term.id} className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/80 bg-sunken/50 px-4 py-3">
            <h2 className="font-semibold">ภาคเรียนที่ {t.term.label}</h2>
            <p className="text-sm text-ink-muted tabular-nums">GPA <strong className="text-base text-ink">{formatGpa(t.gpa)}</strong> · GPAX <strong className="text-base text-ink">{formatGpa(t.gpax)}</strong> · {t.credits} หน่วยกิต</p>
          </div>
          {/* มือถือ: รายการแนวตั้ง ชื่อวิชาเต็มบรรทัด เกรดตัวใหญ่ด้านขวา */}
          <ul className="divide-y divide-line/70 sm:hidden">
            {t.rows.map((r) => (
              <li key={r.subject.code} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{r.subject.name}</p>
                  <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
                    {r.subject.code} · {r.subject.credits} หน่วยกิต
                    {KIND[r.kind] && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-xs text-info">{KIND[r.kind]}</span>}
                  </p>
                </div>
                <div className="grid shrink-0 justify-items-end gap-0.5">
                  <GradePill grade={r.grade} outcome={r.outcome} size="lg" />
                  <span className="text-xs text-ink-muted">{GRADE_MEANING[r.grade as Grade] ?? ''}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted">
                <tr><th scope="col" className="px-4 py-2 font-medium">รหัสวิชา</th><th scope="col" className="px-2 py-2 font-medium">ชื่อวิชา</th><th scope="col" className="px-2 py-2 text-center font-medium">หน่วยกิต</th><th scope="col" className="px-4 py-2 text-right font-medium">ผลการเรียน</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {t.rows.map((r) => (
                  <tr key={r.subject.code}>
                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">{r.subject.code}</td>
                    <td className="px-2 py-2.5">{r.subject.name}{KIND[r.kind] && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-xs text-info">{KIND[r.kind]}</span>}</td>
                    <td className="px-2 py-2.5 text-center tabular-nums">{r.subject.credits}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap"><span className="mr-2 text-sm text-ink-muted">{GRADE_MEANING[r.grade as Grade] ?? ''}</span><GradePill grade={r.grade} outcome={r.outcome} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {data.failedOutstanding.length > 0 && (
        <Alert tone="warn">
          <p className="font-semibold">รายวิชาที่ยังไม่ผ่านหรือรอผล</p>
          <ul className="mt-1 grid gap-0.5">
            {data.failedOutstanding.map((f) => (
              <li key={f.subject.code}><span className="tabular-nums">{f.subject.code}</span> {f.subject.name} — ได้ <strong className={/[\u0E00-\u0E7F]/.test(f.grade) ? "font-form" : undefined}>{f.grade}</strong> ({GRADE_MEANING[f.grade as Grade] ?? ''}) ภาค {f.term}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">ต้องการแก้ผลการเรียน? <Link href={`/student/new/D01?topic=${encodeURIComponent('ขอแก้ไขผลการเรียน')}`} className="font-medium underline underline-offset-2">ยื่นคำร้องขอแก้ไขผลการเรียน</Link></p>
        </Alert>
      )}
    </div>
  );
}
