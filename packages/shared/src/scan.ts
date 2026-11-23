import type { Level } from './model.js';

/** สแกน QR บัตรนักศึกษา — QR เก็บแค่ลิงก์ /scan/<รหัส> ไม่มีข้อมูลส่วนตัว ข้อมูลจริงอยู่หลังการล็อกอินของครู/เจ้าหน้าที่ */
export const STUDENT_CODE_RE = /^\d{5,15}$/;
export const studentScanPath = (code: string) => `/scan/${code}`;

/**
 * อ่านข้อความจาก QR → รหัสนักศึกษา (null = ไม่ใช่ QR บัตรนักศึกษา)
 * รับลิงก์ https://<เว็บไหนก็ได้>/scan/<รหัส> (ย้ายโดเมนแล้ว QR ที่พิมพ์ไว้ยังใช้ได้) หรือรหัสล้วน
 * ไม่เปิดลิงก์อื่นที่สแกนเจอ — กันการหลอกพาไปเว็บปลอม
 */
export function parseStudentQr(text: string): string | null {
  const t = text.trim();
  if (STUDENT_CODE_RE.test(t)) return t;
  let u: URL;
  try { u = new URL(t); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const m = /^\/scan\/(\d{5,15})\/?$/.exec(u.pathname);
  return m ? m[1]! : null;
}

export interface StudentScanContact {
  phone: string;
  email: string;
  guardians: { relation: string; name: string; phone: string; isPrimary: boolean }[];
}

export interface StudentScanView {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  nickname: string;
  level: Level;
  program: string;
  department: string;
  yearLevel: number;
  groupNo: string;
  status: string;
  advisor: string;
  /** basic = ครู/เจ้าหน้าที่ทั่วไป · full = งานทะเบียน/ผู้ดูแลระบบ/ครูที่ปรึกษาของนักเรียนคนนี้ (เห็นเบอร์ติดต่อ) */
  access: 'basic' | 'full';
  /** ผู้สแกนเป็นครูที่ปรึกษาของนักเรียนคนนี้ */
  isAdvisee: boolean;
  /** มีเฉพาะ access = full */
  contact: StudentScanContact | null;
}
