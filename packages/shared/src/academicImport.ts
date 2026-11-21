/**
 * นำเข้าข้อมูลการเรียน (แผนการเรียน / ตารางเรียน / ผลการเรียน) — กติกาอ่านค่าจากไฟล์ (ไม่แตะฐานข้อมูล)
 * ไฟล์จริงยังไม่รู้รูปแบบ จึงเดาหัวตารางให้กว้าง แล้วให้ผู้ใช้ยืนยันก่อนบันทึก
 */
import { GRADES } from './academic.js';
import { parseLevel } from './studentImport.js';

export type AcademicKind = 'plan' | 'schedule' | 'grade' | 'staff';
/** ประเภทที่ต้องเลือกภาคเรียนก่อนนำเข้า */
export const KIND_NEEDS_TERM: Record<AcademicKind, boolean> = { plan: false, schedule: true, grade: true, staff: false };
export interface FieldInfo { label: string; required?: boolean; hint?: string }

export const ACADEMIC_FIELDS: Record<AcademicKind, Record<string, FieldInfo>> = {
  plan: {
    program: { label: 'สาขาวิชา', required: true },
    level: { label: 'ระดับ (ปวช./ปวส.)', hint: 'ไม่มีก็ได้ ถ้าชื่อสาขามีระดับเดียว' },
    yearLevel: { label: 'ชั้นปี', required: true },
    term: { label: 'ภาคเรียน', required: true },
    subjectCode: { label: 'รหัสวิชา', required: true },
    subjectName: { label: 'ชื่อวิชา', required: true },
    tpn: { label: 'ท-ป-น (รวมช่องเดียว)', hint: 'เช่น 2-2-3' },
    theory: { label: 'ทฤษฎี (ท)' },
    practice: { label: 'ปฏิบัติ (ป)' },
    credits: { label: 'หน่วยกิต (น)' },
    category: { label: 'หมวดวิชา' },
  },
  schedule: {
    program: { label: 'สาขาวิชา', required: true },
    level: { label: 'ระดับ (ปวช./ปวส.)' },
    yearLevel: { label: 'ชั้นปี', required: true },
    groupNo: { label: 'ห้อง/กลุ่ม', required: true },
    day: { label: 'วัน', required: true },
    time: { label: 'เวลา (ช่วง)', hint: 'เช่น 08.00-10.00' },
    startTime: { label: 'เวลาเริ่ม' },
    endTime: { label: 'เวลาเลิก' },
    subjectCode: { label: 'รหัสวิชา', required: true },
    subjectName: { label: 'ชื่อวิชา' },
    tpn: { label: 'ท-ป-น' },
    room: { label: 'ห้องเรียน' },
    teacher: { label: 'ครูผู้สอน' },
  },
  grade: {
    studentCode: { label: 'รหัสนักศึกษา', required: true },
    subjectCode: { label: 'รหัสวิชา', required: true },
    subjectName: { label: 'ชื่อวิชา', hint: 'ใช้เมื่อวิชายังไม่มีในระบบ' },
    tpn: { label: 'ท-ป-น' },
    credits: { label: 'หน่วยกิต' },
    grade: { label: 'ผลการเรียน (เกรด)', required: true },
    studentName: { label: 'ชื่อนักเรียน (ไว้ตรวจ)', hint: 'ไม่บันทึก ใช้เตือนถ้าชื่อไม่ตรงกับรหัส' },
  },
  staff: {
    staffCode: { label: 'รหัสบุคลากร', required: true, hint: 'ไม่ซ้ำกัน ใช้เป็นชื่อผู้ใช้เข้าระบบ' },
    name: { label: 'ชื่อ-นามสกุล (รวมช่องเดียว)', hint: 'มีคำนำหน้าได้ เช่น นายสมชาย ใจดี' },
    prefix: { label: 'คำนำหน้า' },
    firstName: { label: 'ชื่อ' },
    lastName: { label: 'นามสกุล' },
    kind: { label: 'ครู / บุคลากรสนับสนุน', hint: 'ไม่มีก็ได้ ระบบดูจากตำแหน่ง' },
    position: { label: 'ตำแหน่ง', hint: 'เช่น ครู คศ.2, ครูผู้ช่วย, เจ้าหน้าที่ธุรการ' },
    employment: { label: 'ประเภทบุคลากร', hint: 'เช่น ข้าราชการครู, พนักงานราชการ, ครูอัตราจ้าง' },
    department: { label: 'แผนกวิชา / งาน' },
    program: { label: 'สาขาวิชา' },
    status: { label: 'สถานะการปฏิบัติงาน', hint: 'ไม่มี = ปฏิบัติงาน' },
    phone: { label: 'เบอร์โทรศัพท์' },
    email: { label: 'อีเมล' },
  },
};

export type AcademicMapping = Record<string, number>;

/** คำในหัวตาราง (ตัดช่องว่าง/จุด) — เรียงคำยาว/เจาะจงก่อน */
const SYN: Record<AcademicKind, [string, string[]][]> = {
  plan: [
    ['subjectCode', ['รหัสวิชา', 'รหัสรายวิชา', 'subjectcode', 'coursecode']],
    ['subjectName', ['ชื่อวิชา', 'ชื่อรายวิชา', 'รายวิชา', 'วิชา', 'subject', 'course']],
    ['tpn', ['ทปน', 'ท-ป-น', 'tpn']],
    ['theory', ['ทฤษฎี', 'ท']], ['practice', ['ปฏิบัติ', 'ป']], ['credits', ['หน่วยกิต', 'น', 'credit', 'credits']],
    ['category', ['หมวดวิชา', 'หมวด', 'กลุ่มวิชา', 'category']],
    ['program', ['สาขาวิชา', 'สาขางาน', 'สาขา', 'program', 'major']],
    ['level', ['ระดับชั้น', 'ระดับ', 'หลักสูตร', 'level']],
    ['yearLevel', ['ชั้นปีที่', 'ชั้นปี', 'ปีที่', 'year']],
    ['term', ['ภาคเรียนที่', 'ภาคเรียน', 'ภาค', 'เทอม', 'semester', 'term']],
  ],
  schedule: [
    ['subjectCode', ['รหัสวิชา', 'รหัสรายวิชา', 'subjectcode']],
    ['subjectName', ['ชื่อวิชา', 'รายวิชา', 'วิชา', 'subject']],
    ['tpn', ['ทปน', 'tpn']],
    ['teacher', ['ครูผู้สอน', 'อาจารย์ผู้สอน', 'ผู้สอน', 'ครู', 'teacher']],
    ['room', ['ห้องเรียน', 'สถานที่', 'room']],
    ['groupNo', ['กลุ่มเรียน', 'กลุ่ม', 'ห้อง', 'group', 'class']],
    ['day', ['วันที่เรียน', 'วัน', 'day']],
    ['time', ['เวลาเรียน', 'ช่วงเวลา', 'เวลา', 'time']],
    ['startTime', ['เวลาเริ่ม', 'เริ่ม', 'start']], ['endTime', ['เวลาเลิก', 'เวลาสิ้นสุด', 'ถึง', 'เลิก', 'end']],
    ['program', ['สาขาวิชา', 'สาขางาน', 'สาขา', 'program']],
    ['level', ['ระดับชั้น', 'ระดับ', 'level']],
    ['yearLevel', ['ชั้นปีที่', 'ชั้นปี', 'year']],
  ],
  grade: [
    ['studentCode', ['รหัสนักศึกษา', 'รหัสนักเรียน', 'รหัสประจำตัว', 'เลขประจำตัว', 'studentid', 'studentcode']],
    ['subjectCode', ['รหัสวิชา', 'รหัสรายวิชา', 'subjectcode']],
    ['subjectName', ['ชื่อวิชา', 'รายวิชา', 'วิชา', 'subject']],
    ['studentName', ['ชื่อนามสกุล', 'ชื่อสกุล', 'ชื่อนักเรียน', 'ชื่อ', 'name']],
    ['grade', ['ผลการเรียน', 'ระดับผลการเรียน', 'เกรด', 'ผล', 'grade']],
    ['tpn', ['ทปน', 'tpn']], ['credits', ['หน่วยกิต', 'credit', 'credits']],
  ],
  staff: [
    ['staffCode', ['รหัสบุคลากร', 'รหัสครู', 'รหัสประจำตัว', 'เลขประจำตัว', 'รหัส', 'staffcode', 'code', 'username']],
    ['name', ['ชื่อนามสกุล', 'ชื่อสกุล', 'ชื่อเต็ม', 'fullname']],
    ['prefix', ['คำนำหน้าชื่อ', 'คำนำหน้า', 'prefix', 'title']],
    ['firstName', ['ชื่อ', 'firstname']],
    ['lastName', ['นามสกุล', 'สกุล', 'lastname', 'surname']],
    ['employment', ['ประเภทบุคลากร', 'ประเภทการจ้าง', 'สถานภาพการจ้าง', 'ประเภท', 'employment']],
    ['kind', ['ครูบุคลากร', 'กลุ่มบุคลากร', 'kind']],
    ['position', ['ตำแหน่ง', 'position']],
    ['department', ['แผนกวิชา', 'แผนก', 'ฝ่าย', 'งาน', 'department']],
    ['program', ['สาขาวิชา', 'สาขางาน', 'สาขา', 'program']],
    ['status', ['สถานะการปฏิบัติงาน', 'สถานะ', 'status']],
    ['phone', ['เบอร์โทรศัพท์', 'โทรศัพท์', 'เบอร์โทร', 'มือถือ', 'phone', 'tel']],
    ['email', ['อีเมล', 'อีเมล์', 'email', 'e-mail']],
  ],
};

// ---------------- ครูและบุคลากร ----------------
export const STAFF_KIND_LABEL = { teacher: 'ครู', support: 'บุคลากรสนับสนุน' } as const;
export type StaffKind = keyof typeof STAFF_KIND_LABEL;
export const WORK_STATUS_LABEL = { active: 'ปฏิบัติงาน', on_leave: 'ลา (ศึกษาต่อ/ลาป่วย/ลาคลอด)', transferred: 'ย้ายไปที่อื่น', retired: 'เกษียณ', resigned: 'ลาออก' } as const;
export type WorkStatus = keyof typeof WORK_STATUS_LABEL;
/** ครู/บุคลากร จากคอลัมน์ประเภท หรือเดาจากตำแหน่ง (มีคำว่าครู/อาจารย์ = ครู) */
export function parseStaffKind(kindText: string, position: string): StaffKind {
  const k = kindText.trim();
  if (/สนับสนุน|เจ้าหน้าที่|ธุรการ|support|staff/i.test(k)) return 'support';
  if (/ครู|อาจารย์|teacher/i.test(k)) return 'teacher';
  if (/ครู|อาจารย์|รองผู้อำนวยการ|ผู้อำนวยการ/.test(position)) return 'teacher';
  return position.trim() ? 'support' : 'teacher';
}
export function parseWorkStatus(v: string): WorkStatus | null {
  const s = v.trim();
  if (!s || /ปฏิบัติ|ปกติ|active|ทำงาน|ปัจจุบัน/i.test(s)) return 'active';
  if (/ลาออก|resign/i.test(s)) return 'resigned';
  if (/เกษียณ|retire/i.test(s)) return 'retired';
  if (/ย้าย|โอน|transfer/i.test(s)) return 'transferred';
  if (/ลา|leave/i.test(s)) return 'on_leave';
  return null;
}
/** รหัสบุคลากร → ชื่อผู้ใช้ (a-z 0-9 . _ -) หรือ null ถ้าแปลงไม่ได้ (เช่นเป็นภาษาไทย) */
export function staffUsername(code: string): string | null {
  const u = code.trim().toLowerCase().replace(/\s+/g, '');
  return /^[a-z0-9._-]{3,40}$/.test(u) ? u : null;
}

const squash = (s: string) => s.toLowerCase().replace(/[\s._\-/()]+/g, '');

export function guessAcademicMapping(kind: AcademicKind, headers: readonly string[]): AcademicMapping {
  const mapping: AcademicMapping = {};
  const used = new Set<number>();
  const norm = headers.map((h) => squash(String(h ?? '')));
  for (const exact of [true, false]) {
    for (const [field, words] of SYN[kind]) {
      if (mapping[field] !== undefined) continue;
      for (const w of words.map(squash)) {
        const i = norm.findIndex((h, idx) => !used.has(idx) && h !== '' && (exact ? h === w : w.length >= 3 && h.includes(w)));
        if (i >= 0) { mapping[field] = i; used.add(i); break; }
      }
    }
  }
  return mapping;
}

// ---------------- ตัวแปลงค่า ----------------
const DAYS: [RegExp, number][] = [
  [/^(จันทร์|จ\.?|mon(day)?|1)$/i, 1], [/^(อังคาร|อ\.?|tue(sday)?|2)$/i, 2], [/^(พุธ|พ\.?|wed(nesday)?|3)$/i, 3],
  [/^(พฤหัสบดี|พฤหัส|พฤ\.?|thu(rsday)?|4)$/i, 4], [/^(ศุกร์|ศ\.?|fri(day)?|5)$/i, 5], [/^(เสาร์|ส\.?|sat(urday)?|6)$/i, 6], [/^(อาทิตย์|อา\.?|sun(day)?|7)$/i, 7],
];
export function parseDay(v: string): number | null {
  const s = v.trim().replace(/^วัน/, '');
  return DAYS.find(([re]) => re.test(s))?.[1] ?? null;
}

/** "8", "8.30", "08:30", "8.30 น." → "08:30" */
export function parseTime(v: string): string | null {
  const m = /^(\d{1,2})(?:[.:](\d{2}))?\s*(น\.?)?$/.exec(v.trim());
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2] ?? 0);
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
/** "08.00-10.00", "8:00 – 10:00 น." → ["08:00","10:00"] */
export function parseTimeRange(v: string): [string, string] | null {
  const parts = v.replace(/น\.?/g, '').split(/\s*[-–—~ถึง]+\s*/).filter(Boolean);
  if (parts.length !== 2) return null;
  const a = parseTime(parts[0]!); const b = parseTime(parts[1]!);
  return a && b && a < b ? [a, b] : null;
}
/** "2-2-3" / "2(2-3)" → { theory, practice, credits } */
export function parseTpn(v: string): { theory: number; practice: number; credits: number } | null {
  const n = v.match(/\d+/g)?.map(Number);
  if (!n || n.length !== 3) return null;
  return { theory: n[0]!, practice: n[1]!, credits: n[2]! };
}
const GRADE_ALIASES: Record<string, string> = { '4.0': '4', '4.00': '4', '3.50': '3.5', '3.0': '3', '3.00': '3', '2.50': '2.5', '2.0': '2', '2.00': '2', '1.50': '1.5', '1.0': '1', '1.00': '1', '0.0': '0', '0.00': '0', 'มส.': 'มส', 'ขร.': 'ขร', 'มผ.': 'มผ', 'ผ.': 'ผ', 'ร.': 'ร' };
export function normalizeGrade(v: string): string | null {
  const s = v.trim().replace(/\s+/g, '');
  const g = GRADE_ALIASES[s] ?? s;
  return (GRADES as readonly string[]).includes(g) ? g : null;
}
/** ชั้นปีจาก "2", "ปี 2", "ปวช.2" */
export function parseYearLevel(v: string): number | null {
  const m = /(\d)\s*$/.exec(v.trim());
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 5 ? n : null;
}
/** ภาคเรียน 1/2/3(ฤดูร้อน) */
export function parseTerm(v: string): number | null {
  const s = v.trim();
  if (/ร้อน|summer/i.test(s)) return 3;
  const m = /(\d)/.exec(s);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 3 ? n : null;
}
export const normalizeGroup = (v: string) => v.replace(/\s+/g, '').trim();
/**
 * ห้องในไฟล์ตรงกับห้องของนักเรียนไหม: ตรงทั้งคำ หรือไฟล์เขียนแค่เลขห้อง ("1") แต่ในทะเบียนเป็น "สทค.68.1"
 */
export function groupMatches(fileGroup: string, studentGroup: string): boolean {
  const a = normalizeGroup(fileGroup).toLowerCase();
  const b = normalizeGroup(studentGroup).toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (/^\d+$/.test(a)) return b.split(/[./\-]/).pop() === a;
  return false;
}
export { parseLevel };
