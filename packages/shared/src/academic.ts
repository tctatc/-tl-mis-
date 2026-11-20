/**
 * ผลการเรียน: เกรด, GPA, GPAX, สถานะผ่าน/ไม่ผ่าน และชนิดข้อมูลของหน้าฝั่งนักศึกษา
 * (ใช้ทั้ง API และหน้าเว็บ คิดเลขที่เดียว ตรงกันทุกที่)
 */

export const GRADE_POINTS: Readonly<Record<string, number>> = { '4': 4, '3.5': 3.5, '3': 3, '2.5': 2.5, '2': 2, '1.5': 1.5, '1': 1, '0': 0 };
export const GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'ร', 'มส', 'ขร', 'ผ', 'มผ'] as const;
export type Grade = (typeof GRADES)[number];

export const GRADE_MEANING: Record<Grade, string> = {
  '4': 'ดีเยี่ยม', '3.5': 'ดีมาก', '3': 'ดี', '2.5': 'ค่อนข้างดี', '2': 'พอใช้', '1.5': 'อ่อน', '1': 'อ่อนมาก', '0': 'ตก',
  'ร': 'รอการประเมิน', 'มส': 'ไม่มีสิทธิ์รับการประเมิน', 'ขร': 'ขาดเรียน', 'ผ': 'ผ่าน', 'มผ': 'ไม่ผ่าน',
};

export type GradeOutcome = 'passed' | 'failed' | 'pending';

export function gradeOutcome(grade: string): GradeOutcome {
  if (grade === 'ร') return 'pending';
  if (grade === 'ผ') return 'passed';
  const points = GRADE_POINTS[grade];
  if (points !== undefined) return points >= 1 ? 'passed' : 'failed';
  return 'failed'; // 0, มส, ขร, มผ ต้องเรียนใหม่
}

/** ตัดทศนิยม 2 ตำแหน่ง (ไม่ปัดขึ้น ตามระเบียบการคิดค่าระดับคะแนนเฉลี่ย) */
export const truncate2 = (n: number) => Math.floor(n * 100 + 1e-9) / 100;

export interface GradedCourse { code: string; credits: number; grade: string; termOrder: number }

/** GPA ของรายการวิชา (นับเฉพาะเกรดตัวเลข) — ไม่มีวิชาที่นับได้คืน null */
export function gpa(courses: readonly Pick<GradedCourse, 'credits' | 'grade'>[]): number | null {
  let points = 0;
  let credits = 0;
  for (const c of courses) {
    const p = GRADE_POINTS[c.grade];
    if (p === undefined || c.credits <= 0) continue;
    points += p * c.credits;
    credits += c.credits;
  }
  return credits === 0 ? null : truncate2(points / credits);
}

/** วิชาที่เรียนหลายครั้ง (เรียนซ้ำ/รีเกรด) ใช้ผลครั้งล่าสุด */
export function latestAttempts<T extends GradedCourse>(courses: readonly T[]): T[] {
  const byCode = new Map<string, T>();
  for (const c of [...courses].sort((a, b) => a.termOrder - b.termOrder)) byCode.set(c.code, c);
  return [...byCode.values()];
}

export function gpax(courses: readonly GradedCourse[]): number | null {
  return gpa(latestAttempts(courses));
}

export function creditsEarned(courses: readonly GradedCourse[]): number {
  return latestAttempts(courses).filter((c) => gradeOutcome(c.grade) === 'passed').reduce((sum, c) => sum + c.credits, 0);
}

export const formatGpa = (n: number | null) => (n === null ? '–' : n.toFixed(2));
export const termOrder = (year: number, term: number) => year * 10 + term;
export const termLabel = (year: number, term: number) => (term === 3 ? `ฤดูร้อน/${year}` : `${term}/${year}`);
export const tpn = (s: { theory: number; practice: number; credits: number }) => `${s.theory}-${s.practice}-${s.credits}`;

export const DAY_NAMES = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'] as const;

// ---------------- ชนิดข้อมูลที่ API ส่งให้หน้าเว็บ ----------------

export interface TermRef { id: string; year: number; term: number; label: string; isCurrent: boolean }
export interface SubjectRef { code: string; name: string; theory: number; practice: number; credits: number }

export type PlanStatus = 'passed' | 'failed' | 'pending' | 'enrolled' | 'remaining';
export interface StudyPlanView {
  curriculum: { name: string; year: number; minCredits: number } | null;
  groups: { yearLevel: number; term: number; items: { subject: SubjectRef; category: string; status: PlanStatus; grade: string | null }[] }[];
  summary: { creditsEarned: number; creditsPlanned: number; minCredits: number; passed: number; failed: number; enrolled: number; remaining: number; total: number };
}

export interface RegistrationCardView {
  terms: TermRef[];
  term: TermRef | null;
  registeredAt: string | null;
  advisor: string;
  subjects: { subject: SubjectRef; groupCode: string; teacher: string; kind: string }[];
  totalCredits: number;
}

export interface ScheduleView {
  terms: TermRef[];
  term: TermRef | null;
  sessions: { dayOfWeek: number; startTime: string; endTime: string; room: string; subject: SubjectRef; groupCode: string; teacher: string }[];
  exams: { kind: 'midterm' | 'final'; date: string; startTime: string; endTime: string; room: string; subject: SubjectRef }[];
}

export interface GradesView {
  /** creditsEarned = หน่วยกิตสะสม (ผ่านแล้ว) ถึงภาคนั้น */
  terms: { term: TermRef; rows: { subject: SubjectRef; grade: string; outcome: GradeOutcome; kind: string }[]; credits: number; gpa: number | null; gpax: number | null; creditsEarned: number }[];
  gpax: number | null;
  creditsEarned: number;
  failedOutstanding: { subject: SubjectRef; grade: string; term: string }[];
}

export interface ProfileView {
  status: string;
  nickname: string;
  email: string;
  nationalIdMasked: string;
  nationality: string;
  religion: string;
  bloodType: string;
  entry: string;
  curriculum: string;
  advisor: string;
  previous: { school: string; level: string; gpa: string };
  addresses: { kind: 'home' | 'current'; text: string }[];
  guardians: { relation: string; name: string; occupation: string; phone: string; isPrimary: boolean }[];
}

export const STUDENT_STATUS_LABEL: Record<string, string> = {
  studying: 'กำลังศึกษา', on_leave: 'ลาพัก/รักษาสภาพ', graduated: 'สำเร็จการศึกษา', resigned: 'ลาออก', dismissed: 'พ้นสภาพ',
};

/** 1-2345-67890-12-3 → x-xxxx-xxxxx-12-3 (โชว์แค่ท้าย ตาม PDPA) */
export function maskNationalId(id: string): string {
  const digits = id.replace(/\D/g, '');
  if (digits.length !== 13) return '';
  return `x-xxxx-xxxxx-${digits.slice(10, 12)}-${digits.slice(12)}`;
}
