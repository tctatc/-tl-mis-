'use client';

import { SECTION_STATUS_LABEL, formatThaiDate, parseIsoDate, type GradingWindow, type SectionGradeStatus, type TeachSectionsView } from '@csis/shared';
import Link from 'next/link';
import { CheckCircle2, CircleDashed, Megaphone, PencilLine, Send, Undo2 } from 'lucide-react';
import { cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';

const TONE: Record<SectionGradeStatus, string> = {
  none: 'bg-sunken text-ink-muted ring-line-strong',
  draft: 'bg-info-soft text-info ring-info/30',
  submitted: 'bg-gold-soft text-gold-ink ring-gold/50',
  returned: 'bg-warn-soft text-warn ring-warn/40',
  approved: 'bg-ok-soft text-ok ring-ok/30',
  published: 'bg-ok text-ink-inverse ring-ok',
};
const ICON: Record<SectionGradeStatus, typeof Send> = { none: CircleDashed, draft: PencilLine, submitted: Send, returned: Undo2, approved: CheckCircle2, published: Megaphone };

/** สถานะการส่งผล: คำ + สี + ไอคอน (ไม่พึ่งสีอย่างเดียว) */
export function SectionStatus({ status, className }: { status: SectionGradeStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium whitespace-nowrap ring-1', TONE[status], className)}>
      <Icon className="size-4" aria-hidden="true" />{SECTION_STATUS_LABEL[status]}
    </span>
  );
}

export const thaiDate = (iso: string | null) => (iso ? formatThaiDate(parseIsoDate(iso)) : '');

/** วันนี้ตามเวลาไทย yyyy-mm-dd */
export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
}

/** ข้อความช่วงส่งผล เช่น "ส่งผลภายใน 15 มีนาคม 2570 (เหลือ 3 วัน)" */
export function windowText(w: GradingWindow) {
  if (!w.gradeDueAt) return null;
  const days = Math.round((Date.parse(w.gradeDueAt) - Date.parse(todayIso())) / 86_400_000);
  const left = days > 0 ? `เหลือ ${days} วัน` : days === 0 ? 'วันนี้วันสุดท้าย' : `เลยกำหนดมา ${-days} วัน`;
  return { text: `ส่งผลภายใน ${thaiDate(w.gradeDueAt)}`, left, late: days < 0, soon: days >= 0 && days <= 3 };
}

/** การ์ดเตือนบนหน้าแรกของครู: ยังต้องส่งเกรดกี่วิชา (ไม่แสดงถ้าไม่มีงานค้าง) */
export function GradingReminder() {
  const { data } = useApi<TeachSectionsView>('/teach/sections');
  if (!data?.term) return null;
  const todo = data.sections.filter((s) => s.status === 'none' || s.status === 'draft' || s.status === 'returned');
  if (todo.length === 0) return null;
  const returned = todo.filter((s) => s.status === 'returned').length;
  const due = windowText(data.window);
  return (
    <Link href="/teach" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] bg-surface px-4 py-4 ring-1 ring-brand-border hover:bg-brand-soft/50 sm:px-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><PencilLine className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">กรอกเกรด ภาคเรียน {data.term.label}: ยังต้องส่ง {todo.length} วิชา</span>
        <span className={cx('block text-[15px]', returned || due?.late ? 'text-warn' : 'text-ink-muted')}>
          {returned ? `งานวัดผลส่งคืนให้แก้ ${returned} วิชา · ` : ''}{due ? `${due.text} (${due.left})` : 'กดเพื่อไปกรอกคะแนน'}
        </span>
      </span>
      <span className="inline-flex min-h-12 items-center rounded-[var(--radius-control)] bg-brand px-5 text-[16px] font-medium text-ink-inverse">ไปกรอกเกรด</span>
    </Link>
  );
}
