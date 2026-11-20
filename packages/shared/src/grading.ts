/**
 * ขั้นตอนส่งผลการเรียนตามแบบ ศธ.02:
 * ครูกรอก (บันทึก) → ยืนยันส่ง → งานวัดผลตรวจ (ส่งคืน/อนุมัติ) → ประกาศ → นักเรียนเห็น
 * วิชา (section) เป็นเจ้าของสถานะ — เกรดรายคนเปลี่ยนตามเสมอผ่าน recordStatusFor
 */
import type { Grade, TermRef } from './academic.js';

/** เกณฑ์ตัดเกรดเริ่มต้น: คะแนนรวมขั้นต่ำ → เกรด */
export const GRADE_CRITERIA: readonly (readonly [number, Grade])[] = [
  [80, '4'], [75, '3.5'], [70, '3'], [65, '2.5'], [60, '2'], [55, '1.5'], [50, '1'], [0, '0'],
];

/** ผลพิเศษที่ครูเลือกแทนคะแนนได้ */
export const SPECIAL_GRADES = ['ร', 'มส', 'ขร', 'ผ', 'มผ'] as const;
export type SpecialGrade = (typeof SPECIAL_GRADES)[number];

export function cutGrade(score: number): Grade {
  for (const [min, grade] of GRADE_CRITERIA) if (score >= min) return grade;
  return '0';
}

/** เกรดของแถวที่ครูกรอก: ผลพิเศษชนะคะแนน; ไม่มีทั้งคู่ = ยังไม่กรอก */
export function entryGrade(row: { score?: number | null; special?: SpecialGrade | null }): Grade | null {
  if (row.special) return row.special;
  if (row.score === null || row.score === undefined) return null;
  return cutGrade(row.score);
}

/** คะแนนจากช่องกรอก: null = ว่าง, undefined = ไม่ถูกต้อง (0–100 ทศนิยมไม่เกิน 2 ตำแหน่ง) */
export function parseScore(raw: string): number | null | undefined {
  const s = raw.trim();
  if (s === '') return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return undefined;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : undefined;
}

export const SECTION_STATUSES = ['none', 'draft', 'submitted', 'returned', 'approved', 'published'] as const;
export type SectionGradeStatus = (typeof SECTION_STATUSES)[number];
export type SectionAction = 'save' | 'submit' | 'return' | 'approve' | 'unapprove' | 'publish' | 'unpublish';

/** ชื่อสถานะที่แสดง — ใช้คำเดียวกันทุกหน้า */
export const SECTION_STATUS_LABEL: Record<SectionGradeStatus, string> = {
  none: 'ยังไม่กรอก',
  draft: 'กำลังกรอก',
  submitted: 'ส่งแล้ว รอตรวจ',
  returned: 'ส่งคืนให้แก้',
  approved: 'อนุมัติแล้ว รอประกาศ',
  published: 'ประกาศแล้ว',
};

export const canTeacherEdit = (s: SectionGradeStatus) => s === 'none' || s === 'draft' || s === 'returned';

const TRANSITIONS: Record<SectionAction, Partial<Record<SectionGradeStatus, SectionGradeStatus>>> = {
  save: { none: 'draft', draft: 'draft', returned: 'returned' },
  submit: { draft: 'submitted', returned: 'submitted' },
  return: { submitted: 'returned' },
  approve: { submitted: 'approved' },
  unapprove: { approved: 'submitted' },
  publish: { approved: 'published' },
  unpublish: { published: 'approved' },
};

export function nextSectionStatus(from: SectionGradeStatus, action: SectionAction): SectionGradeStatus | null {
  return TRANSITIONS[action][from] ?? null;
}

/** สถานะที่ต้องอยู่ก่อนทำ action (ใช้เป็นเงื่อนไข updateMany กันกดซ้ำ/ชนกัน) */
export function fromStatuses(action: SectionAction): SectionGradeStatus[] {
  return Object.keys(TRANSITIONS[action]) as SectionGradeStatus[];
}

/** สถานะเกรดรายคนตามสถานะวิชา — นักเรียนเห็นเฉพาะ published */
export function recordStatusFor(s: SectionGradeStatus): 'draft' | 'submitted' | 'approved' | 'published' {
  if (s === 'published') return 'published';
  if (s === 'approved') return 'approved';
  if (s === 'submitted') return 'submitted';
  return 'draft';
}

/** ส่งได้เมื่อนักเรียนที่ลงทะเบียนทุกคนมีผลการเรียน */
export function isComplete(enrolledIds: readonly string[], grades: ReadonlyMap<string, string>): boolean {
  return enrolledIds.length > 0 && enrolledIds.every((id) => grades.has(id));
}

// ---------------- ชนิดข้อมูลที่ API ส่งให้หน้าเว็บ ----------------

export interface GradingWindow { gradeOpenAt: string | null; gradeDueAt: string | null }

/** การ์ดวิชาในหน้า "กรอกเกรด" ของครู */
export interface TeachSectionCard {
  id: string;
  subject: { code: string; name: string; credits: number };
  className: string;
  status: SectionGradeStatus;
  students: number;
  graded: number;
  returnNote: string;
}

export interface TeachSectionsView { terms: TermRef[]; term: TermRef | null; window: GradingWindow; sections: TeachSectionCard[] }

export interface TeachRosterRow { studentId: string; studentCode: string; name: string; score: number | null; special: SpecialGrade | null; grade: string | null }

export interface TeachSectionDetail extends TeachSectionCard {
  term: TermRef;
  window: GradingWindow;
  submittedAt: string | null;
  rows: TeachRosterRow[];
}

/** แถวในกระดานงานวัดผล */
export interface BoardRow extends TeachSectionCard {
  teacher: string;
  teacherUserId: string | null;
  submittedAt: string | null;
  approvalDate: string | null;
  publishDocDate: string | null;
}

export interface BoardView { terms: TermRef[]; term: TermRef | null; window: GradingWindow; rows: BoardRow[] }
