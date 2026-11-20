/**
 * กลุ่มเรียน เลื่อนชั้น และตรวจสำเร็จการศึกษา (งานทะเบียน ตาม ศธ.02)
 */
import { creditsEarned, gpax, gradeOutcome, latestAttempts, type GradedCourse } from './academic.js';
import type { Level } from './model.js';

/** เลขห้อง 2 หลักจากชื่อกลุ่ม: "1" → "01", "สทค.68.12" → "12", ไม่มีตัวเลข → "01" */
export function roomNumber(groupNo: string): string {
  const m = groupNo.match(/(\d+)\D*$/);
  return (m ? m[1]! : '1').slice(-2).padStart(2, '0');
}

/**
 * รหัสกลุ่มเรียนตั้งต้น = รหัสนักศึกษา 7 หลักแรก (ปีเข้า + ระดับ + สาขา) ที่นักเรียนส่วนใหญ่ในกลุ่มใช้ + เลขห้อง 2 หลัก
 * เช่น 68319090003 ห้อง 1 → 683190901 (ตรงกับรายงานผลการศึกษาจาก ศธ.02) — งานทะเบียนแก้ได้
 */
export function defaultGroupCode(studentCodes: readonly string[], groupNo: string): string | null {
  const counts = new Map<string, number>();
  for (const c of studentCodes) {
    if (!/^\d{10,11}$/.test(c)) continue;
    const p = c.slice(0, 7);
    counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? `${top[0]}${roomNumber(groupNo)}` : null;
}

/** ชั้นปีสุดท้าย: ปวช. 3 ปี, ปวส. 2 ปี */
export const finalYear = (level: Level) => (level === 'pvc' ? 3 : 2);
export const canPromote = (level: Level, yearLevel: number) => yearLevel < finalYear(level);

export const MIN_GRADUATION_GPAX = 2;

export interface GraduationResult {
  ready: boolean;
  /** วิชาในแผนการเรียนที่ยังไม่ผ่าน (ผลครั้งล่าสุด) */
  missing: string[];
  creditsEarned: number;
  minCredits: number;
  gpax: number | null;
  reasons: string[];
}

/**
 * ตรวจเบื้องต้นว่าจบได้ไหม: ผ่านทุกวิชาในแผน + หน่วยกิตถึงขั้นต่ำของหลักสูตร + GPAX ≥ 2.00
 * (ยังไม่ตรวจหน่วยกิตขั้นต่ำรายหมวด/วิชาเลือก — งานทะเบียนต้องตรวจซ้ำก่อนอนุมัติ)
 */
export function graduationCheck(input: { plan: readonly { code: string; credits: number }[]; courses: readonly GradedCourse[]; minCredits: number }): GraduationResult {
  const latest = new Map(latestAttempts(input.courses).map((c) => [c.code, c]));
  const missing = input.plan.filter((p) => { const c = latest.get(p.code); return !c || gradeOutcome(c.grade) !== 'passed'; }).map((p) => p.code);
  const earned = creditsEarned(input.courses);
  const g = gpax(input.courses);
  const reasons: string[] = [];
  if (missing.length) reasons.push(`วิชาตามแผนยังไม่ผ่าน ${missing.length} วิชา`);
  if (earned < input.minCredits) reasons.push(`หน่วยกิตได้ ${earned} ต้องได้อย่างน้อย ${input.minCredits}`);
  if (g === null || g < MIN_GRADUATION_GPAX) reasons.push(`เกรดเฉลี่ยสะสม ${g === null ? '–' : g.toFixed(2)} ต้องได้อย่างน้อย 2.00`);
  return { ready: reasons.length === 0, missing, creditsEarned: earned, minCredits: input.minCredits, gpax: g, reasons };
}

// ---------------- ชนิดข้อมูลที่ API ส่งให้หน้าเว็บ ----------------

export interface ClassGroupRow {
  id: string;
  code: string;
  programId: string;
  program: string;
  level: Level;
  entryYear: number;
  groupNo: string;
  yearLevel: number;
  active: boolean;
  students: number;
  advisor: string;
}
