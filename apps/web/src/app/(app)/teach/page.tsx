'use client';

import type { TeachSectionCard, TeachSectionsView } from '@csis/shared';
import { BookOpenCheck, ChevronRight, Clock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EmptyState, PageHeader, TermSelect } from '@/components/academic';
import { SectionStatus, windowText } from '@/components/grading';
import { Alert, Card, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';

/** ปุ่มของแต่ละวิชาบอกสิ่งที่ต้องทำต่อ เป็นคำกริยา */
function nextStep(s: TeachSectionCard) {
  if (s.status === 'none') return 'เริ่มกรอกคะแนน';
  if (s.status === 'draft') return 'กรอกต่อ';
  if (s.status === 'returned') return 'แก้ไขตามที่ส่งคืน';
  return 'ดูผลที่ส่ง';
}

export default function TeachPage() {
  const [termId, setTermId] = useState<string>();
  const { data, error } = useApi<TeachSectionsView>(`/teach/sections${termId ? `?termId=${termId}` : ''}`);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const due = windowText(data.window);
  const todo = data.sections.filter((s) => s.status === 'none' || s.status === 'draft' || s.status === 'returned').length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader
        title="กรอกเกรด"
        subtitle={data.term ? <>ภาคเรียน {data.term.label} · วิชาที่คุณสอน {data.sections.length} วิชา{todo > 0 && <> · <strong className="text-ink">ยังต้องส่ง {todo} วิชา</strong></>}</> : undefined}
        actions={data.terms.length > 1 ? <TermSelect terms={data.terms} value={data.term?.id} onChange={setTermId} /> : undefined}
      />

      {due && (
        <p className={cx('flex items-center gap-2 rounded-[var(--radius-card)] px-4 py-3 text-[16px] ring-1', due.late ? 'bg-danger-soft text-danger ring-danger/25' : due.soon ? 'bg-warn-soft text-warn ring-warn/30' : 'bg-surface ring-line/70')}>
          <Clock className="size-5 shrink-0" aria-hidden="true" />
          <span><strong>{due.text}</strong> · {due.left}</span>
        </p>
      )}

      {data.sections.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpenCheck className="size-7" aria-hidden="true" />} title="ภาคนี้ยังไม่มีวิชาที่คุณสอน">
            ถ้ามีวิชาที่คุณสอนแต่ไม่ขึ้นที่นี่ ให้แจ้งงานวัดผลให้ใส่ชื่อคุณเป็นครูผู้สอนของวิชานั้น
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line/70">
            {data.sections.map((s) => (
              <li key={s.id}>
                <Link href={`/teach/${s.id}`} className="group grid gap-3 px-4 py-4 hover:bg-sunken/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold leading-snug">{s.subject.name}</p>
                    <p className="mt-0.5 text-[15px] text-ink-muted"><span className="tabular-nums">{s.subject.code}</span> · {s.className}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <SectionStatus status={s.status} />
                      <span className="text-[15px] tabular-nums text-ink-muted">กรอกแล้ว {s.graded} จาก {s.students} คน</span>
                    </div>
                    {s.status === 'returned' && s.returnNote && (
                      <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-[15px] text-warn">งานวัดผลแจ้งว่า: {s.returnNote}</p>
                    )}
                  </div>
                  <span className={cx('inline-flex min-h-12 items-center justify-center gap-1 rounded-[var(--radius-control)] px-5 text-[16px] font-medium', s.status === 'submitted' || s.status === 'approved' || s.status === 'published' ? 'text-ink-muted ring-1 ring-line-strong group-hover:text-ink' : 'bg-brand text-ink-inverse group-hover:bg-brand-hover')}>
                    {nextStep(s)}<ChevronRight className="size-5" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="rounded-[var(--radius-card)] bg-surface px-4 py-3 text-[15px] ring-1 ring-line/70">
        <summary className="cursor-pointer font-medium">ขั้นตอนการส่งผลการเรียน</summary>
        <ol className="mt-2 grid list-decimal gap-1 pl-6 text-ink-muted">
          <li>กดที่วิชา แล้วกรอกคะแนนรวม (เต็ม 100) ของนักเรียนทุกคน ระบบตัดเกรดให้เอง หรือดาวน์โหลดไฟล์ Excel ไปกรอกแล้วอัปโหลดกลับ</li>
          <li>นักเรียนที่ไม่มีคะแนน ให้เลือกผลพิเศษ เช่น ร (รอการประเมิน) หรือ มส (ไม่มีสิทธิ์สอบ)</li>
          <li>กด “บันทึก” ได้ตลอด ยังแก้ได้ เมื่อครบทุกคนแล้วกด “ยืนยันส่งผลการเรียน”</li>
          <li>งานวัดผลตรวจ ถ้ามีจุดต้องแก้จะส่งคืนพร้อมบอกเหตุผล ถ้าถูกต้องจะอนุมัติและประกาศให้นักเรียนเห็น</li>
        </ol>
      </details>
    </div>
  );
}
