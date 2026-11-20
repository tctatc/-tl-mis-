'use client';

import { LEVEL_LABEL, type Level } from '@csis/shared';
import { BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { Alert, Card, Spinner } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { ImportButton, Labeled, selectCls, useTerms } from '../shared';

interface Program { id: string; name: string; level: Level; department: string; students: number }
interface Plan { curriculum: { name: string; minCredits: number } | null; items: { id: string; yearLevel: number; term: number; category: string; code: string; name: string; theory: number; practice: number; credits: number }[] }

export default function PlanAdmin() {
  const terms = useTerms();
  const programs = useApi<Program[]>('/admin/programs').data ?? [];
  const [programId, setProgramId] = useState('');
  useEffect(() => { if (!programId && programs.length) setProgramId(programs.find((p) => p.students > 0)?.id ?? programs[0]!.id); }, [programs, programId]);
  const plan = useApi<Plan>(programId ? `/admin/academic/plan?programId=${programId}` : null);
  const groups = new Map<string, Plan['items']>();
  for (const it of plan.data?.items ?? []) groups.set(`${it.yearLevel}-${it.term}`, [...(groups.get(`${it.yearLevel}-${it.term}`) ?? []), it]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="แผนการเรียน" subtitle="รายวิชาตามหลักสูตรของแต่ละสาขา แยกชั้นปี/ภาคเรียน · นักเรียนในสาขาเห็นในเมนู “แผนการเรียน”"
        actions={<ImportButton kind="plan" terms={terms} onDone={() => void plan.reload()} />} />
      <div className="flex flex-wrap items-end gap-3">
        <Labeled label="สาขาวิชา">
          <select className={`${selectCls} w-full sm:w-auto sm:min-w-72`} value={programId} onChange={(e) => setProgramId(e.target.value)}>
            {programs.map((p) => <option key={p.id} value={p.id}>{LEVEL_LABEL[p.level]} {p.name} ({p.students} คน)</option>)}
          </select>
        </Labeled>
        {plan.data?.curriculum && <p className="pb-2.5 text-sm text-ink-muted">{plan.data.curriculum.name} · รวม {plan.data.curriculum.minCredits} หน่วยกิต · {plan.data.items.length} วิชา</p>}
      </div>
      {plan.error ? <Alert>{plan.error}</Alert> : !plan.data ? <Spinner /> : plan.data.items.length === 0 ? (
        <Card><EmptyState icon={<BookOpen className="size-7" aria-hidden="true" />} title="สาขานี้ยังไม่มีแผนการเรียน">กด “นำเข้าจากไฟล์” เพื่อใส่รายวิชาจาก Excel หรือ CSV</EmptyState></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...groups.entries()].map(([k, items]) => (
            <Card key={k} className="overflow-hidden">
              <div className="flex items-baseline justify-between border-b border-line/80 bg-sunken/50 px-4 py-2.5">
                <h2 className="font-semibold">ปีที่ {items[0]!.yearLevel} ภาคเรียนที่ {items[0]!.term === 3 ? 'ฤดูร้อน' : items[0]!.term}</h2>
                <span className="text-sm tabular-nums text-ink-muted">{items.length} วิชา · {items.reduce((s, i) => s + i.credits, 0)} หน่วยกิต</span>
              </div>
              <table className="w-full text-[15px]">
                <tbody className="divide-y divide-line/70">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-2 tabular-nums whitespace-nowrap">{i.code}</td>
                      <td className="px-2 py-2">{i.name}<span className="block text-xs text-ink-muted">{i.category}</span></td>
                      <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">{i.theory}-{i.practice}-{i.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
