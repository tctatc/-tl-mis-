/**
 * นำเข้านักเรียนจากไฟล์ (CSV/Excel) — กฎการแปลงข้อมูลทั้งหมดอยู่ที่นี่ (ไม่มีการอ่านไฟล์/ฐานข้อมูล ทดสอบได้)
 * ไฟล์จริงของวิทยาลัยอาจหัวตาราง/รูปแบบไม่ตรงกัน จึงเดาให้มากที่สุด แล้วให้ผู้ใช้ยืนยันก่อนบันทึก
 */
import type { Level } from './model.js';

export const IMPORT_FIELDS = {
  studentCode: { label: 'รหัสนักศึกษา', required: true },
  fullName: { label: 'ชื่อ-นามสกุล (รวมช่องเดียว)', required: false },
  prefix: { label: 'คำนำหน้า', required: false },
  firstName: { label: 'ชื่อ', required: false },
  lastName: { label: 'นามสกุล', required: false },
  birthDate: { label: 'วันเกิด', required: false },
  level: { label: 'ระดับ (ปวช./ปวส.)', required: false },
  department: { label: 'แผนกวิชา', required: false },
  program: { label: 'สาขาวิชา', required: true },
  yearLevel: { label: 'ชั้นปี', required: false },
  groupNo: { label: 'กลุ่ม/ห้อง', required: false },
  phone: { label: 'โทรศัพท์', required: false },
  nationalId: { label: 'เลขประจำตัวประชาชน', required: false },
  fatherName: { label: 'ชื่อ-สกุล บิดา', required: false },
  motherName: { label: 'ชื่อ-สกุล มารดา', required: false },
  advisor: { label: 'ครูที่ปรึกษา', required: false },
} as const;
export type ImportField = keyof typeof IMPORT_FIELDS;
export type ImportMapping = Partial<Record<ImportField, number>>; // field → index คอลัมน์ในไฟล์

/** คำที่พบบ่อยในหัวตาราง (ตัดช่องว่าง/จุดแล้ว ตัวพิมพ์เล็ก) — ตรวจคำยาวก่อน กันจับ "ชื่อ" ไปเป็น "ชื่อบิดา" */
const SYNONYMS: [ImportField, string[]][] = [
  ['fatherName', ['ชื่อสกุลบิดา', 'ชื่อบิดา', 'บิดา', 'father']],
  ['motherName', ['ชื่อสกุลมารดา', 'ชื่อมารดา', 'มารดา', 'mother']],
  ['advisor', ['ครูที่ปรึกษา', 'อาจารย์ที่ปรึกษา', 'ที่ปรึกษา', 'advisor']],
  ['nationalId', ['เลขประจำตัวประชาชน', 'เลขบัตรประชาชน', 'บัตรประชาชน', 'เลขบัตร', 'nationalid', 'idcard', 'citizenid']],
  ['studentCode', ['รหัสนักศึกษา', 'รหัสนักเรียน', 'รหัสประจำตัว', 'เลขประจำตัว', 'รหัส', 'studentid', 'studentcode', 'code', 'id']],
  ['fullName', ['ชื่อนามสกุล', 'ชื่อสกุล', 'ชื่อและนามสกุล', 'fullname', 'name']],
  ['prefix', ['คำนำหน้าชื่อ', 'คำนำหน้า', 'prefix', 'title']],
  ['lastName', ['นามสกุล', 'สกุล', 'lastname', 'surname']],
  ['firstName', ['ชื่อจริง', 'ชื่อ', 'firstname']],
  ['birthDate', ['วันเดือนปีเกิด', 'วันเกิด', 'เกิด', 'birthdate', 'dob', 'birthday']],
  ['department', ['แผนกวิชา', 'แผนก', 'department', 'dept']],
  ['program', ['สาขาวิชา', 'สาขางาน', 'สาขา', 'program', 'major']],
  ['level', ['ระดับการศึกษา', 'ระดับชั้น', 'ระดับ', 'หลักสูตร', 'level']],
  ['yearLevel', ['ชั้นปีที่', 'ชั้นปี', 'year']],
  ['groupNo', ['กลุ่มเรียน', 'กลุ่ม', 'ห้อง', 'group', 'class']],
  ['phone', ['เบอร์โทรศัพท์', 'โทรศัพท์', 'เบอร์โทร', 'มือถือ', 'phone', 'tel', 'mobile']],
];

const squash = (s: string) => s.toLowerCase().replace(/[\s._\-/()]+/g, '');

/** เดาการจับคู่คอลัมน์จากหัวตาราง (คอลัมน์หนึ่งใช้ได้ช่องเดียว) */
export function guessMapping(headers: readonly string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  const norm = headers.map((h) => squash(String(h ?? '')));
  // รอบแรก: ตรงทั้งคำ, รอบสอง: ขึ้นต้นด้วย/มีคำนั้น
  for (const exact of [true, false]) {
    for (const [field, words] of SYNONYMS) {
      if (mapping[field] !== undefined) continue;
      for (const w of words) {
        const i = norm.findIndex((h, idx) => !used.has(idx) && h !== '' && (exact ? h === w : w.length >= 3 && h.includes(w)));
        if (i >= 0) { mapping[field] = i; used.add(i); break; }
      }
    }
  }
  // มีชื่อ+นามสกุลแยกแล้ว ไม่ต้องใช้ช่องชื่อรวม
  if (mapping.firstName !== undefined && mapping.lastName !== undefined) delete mapping.fullName;
  return mapping;
}

// ---------------- ชื่อ ----------------
const PREFIXES: [RegExp, string][] = [
  [/^(นางสาว|น\.ส\.?|นส\.?)\s*/, 'นางสาว'],
  [/^(เด็กชาย|ด\.ช\.?)\s*/, 'เด็กชาย'],
  [/^(เด็กหญิง|ด\.ญ\.?)\s*/, 'เด็กหญิง'],
  [/^นาย\s*/, 'นาย'],
  [/^นาง\s*/, 'นาง'],
  [/^(mr\.?)\s+/i, 'นาย'],
  [/^(miss|ms\.?)\s+/i, 'นางสาว'],
  [/^(mrs\.?)\s+/i, 'นาง'],
];
export function normalizePrefix(s: string): string {
  const t = s.trim();
  for (const [re, v] of PREFIXES) if (re.test(`${t} `)) return v;
  return t;
}
/** "นายสมชาย  ใจดี" → { prefix: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี' } */
export function splitThaiName(full: string): { prefix: string; firstName: string; lastName: string } {
  let rest = full.replace(/\s+/g, ' ').trim();
  let prefix = '';
  for (const [re, v] of PREFIXES) {
    const m = re.exec(rest);
    if (m) { prefix = v; rest = rest.slice(m[0].length).trim(); break; }
  }
  const [firstName = '', ...last] = rest.split(' ');
  return { prefix, firstName, lastName: last.join(' ') };
}

// ---------------- วันที่ ----------------
const MONTHS: [RegExp, number][] = [
  [/^(มกราคม|ม\.?ค\.?)$/, 1], [/^(กุมภาพันธ์|ก\.?พ\.?)$/, 2], [/^(มีนาคม|มี\.?ค\.?)$/, 3], [/^(เมษายน|เม\.?ย\.?)$/, 4],
  [/^(พฤษภาคม|พ\.?ค\.?)$/, 5], [/^(มิถุนายน|มิ\.?ย\.?)$/, 6], [/^(กรกฎาคม|ก\.?ค\.?)$/, 7], [/^(สิงหาคม|ส\.?ค\.?)$/, 8],
  [/^(กันยายน|ก\.?ย\.?)$/, 9], [/^(ตุลาคม|ต\.?ค\.?)$/, 10], [/^(พฤศจิกายน|พ\.?ย\.?)$/, 11], [/^(ธันวาคม|ธ\.?ค\.?)$/, 12],
];
const pad = (n: number) => String(n).padStart(2, '0');
/** ปีจากไฟล์ → ค.ศ. (พ.ศ. 4 หลัก, พ.ศ. 2 หลักเช่น 51, หรือ ค.ศ.) */
function toCE(y: number): number {
  if (y >= 2400) return y - 543;
  if (y < 100) return 2500 + y - 543; // 51 → 2551 → 2008
  return y;
}
function valid(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > days) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * อ่านวันเกิดได้หลายแบบ → 'YYYY-MM-DD' (ค.ศ.)
 * 01/11/2551, 1/11/51, 01-11-2008, 2551-11-01, 1 พ.ย. 2551, 1 พฤศจิกายน 51, เลขวันที่ของ Excel, Date
 */
export function parseThaiDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return valid(toCE(value.getUTCFullYear()), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === 'number' && value > 1000 && value < 80000) {
    // เลขวันที่ของ Excel (นับจาก 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return valid(toCE(d.getUTCFullYear()), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(value).trim().replace(/\s+/g, ' ');
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return valid(toCE(+m[1]!), +m[2]!, +m[3]!);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s);
  if (m) return valid(toCE(+m[3]!), +m[2]!, +m[1]!);
  m = /^(\d{1,2}) ?([ก-๙.]+) ?(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.find(([re]) => re.test(m![2]!))?.[1];
    if (month) return valid(toCE(+m[3]!), month, +m[1]!);
  }
  return null;
}

// ---------------- รหัส / รุ่น / ระดับ ----------------
/** รหัสขึ้นต้นด้วยปีที่เข้า: 68xxxxxxx → 2568 */
export function entryYearFromCode(code: string): number | null {
  const m = /^(\d{2})\d{3,}$/.exec(code);
  if (!m) return null;
  const year = 2500 + Number(m[1]);
  return year >= 2540 && year <= 2600 ? year : null;
}
/** ชั้นปีปัจจุบัน = ปีการศึกษาปัจจุบัน − ปีที่เข้า + 1 */
export const yearLevelFrom = (entryYear: number, currentYear: number) => currentYear - entryYear + 1;

export function parseLevel(s: string): { level: Level | null; year: number | null } {
  const t = squash(s);
  const year = /(\d)$/.exec(t)?.[1];
  if (/ปวส|highvoc|^pvs|diploma/.test(t)) return { level: 'pvs', year: year ? +year : null };
  if (/ปวช|^pvc|voc|certificate/.test(t)) return { level: 'pvc', year: year ? +year : null };
  return { level: null, year: null };
}

/** ตัดคำนำหน้าแผนก/สาขาออกก่อนเทียบ: "แผนกวิชา ช่างยนต์" = "ช่างยนต์" */
export function normalizeOrgName(s: string): string {
  return s.replace(/^(แผนกวิชา|แผนก|สาขาวิชา|สาขางาน|สาขา|ประเภทวิชา)\s*/, '').replace(/\s+/g, ' ').trim();
}
export const orgKey = (s: string) => squash(normalizeOrgName(s));

export function validNationalId(id: string): boolean {
  if (!/^\d{13}$/.test(id)) return false;
  const sum = [...id.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (13 - i), 0);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

// ---------------- แปลง 1 แถว ----------------
export interface ImportedStudent {
  studentCode: string; prefix: string; firstName: string; lastName: string; birthDate: string | null;
  level: Level | null; department: string; program: string; yearLevel: number | null; entryYear: number | null; groupNo: string;
  phone: string; nationalId: string; fatherName: string; motherName: string; advisor: string;
}
export interface RowIssue { column: ImportField | '_'; message: string; level: 'error' | 'warning' }

const cell = (row: readonly unknown[], i: number | undefined): unknown => (i === undefined ? undefined : row[i]);
const text = (v: unknown) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).replace(/\s+/g, ' ').trim());

export function mapRow(row: readonly unknown[], mapping: ImportMapping, currentYear: number): { student: ImportedStudent; issues: RowIssue[] } {
  const issues: RowIssue[] = [];
  const err = (column: RowIssue['column'], message: string) => issues.push({ column, message, level: 'error' });
  const warn = (column: RowIssue['column'], message: string) => issues.push({ column, message, level: 'warning' });

  // รหัส: Excel อาจตัด 0 หน้า/แปลงเป็นตัวเลข → เก็บเฉพาะตัวเลข
  const studentCode = text(cell(row, mapping.studentCode)).replace(/[\s-]/g, '').replace(/\.0+$/, '');
  if (!studentCode) err('studentCode', 'ไม่มีรหัสนักศึกษา');
  else if (!/^\d{5,15}$/.test(studentCode)) err('studentCode', `รหัส "${studentCode}" ต้องเป็นตัวเลข 5–15 หลัก`);

  let { prefix, firstName, lastName } = { prefix: normalizePrefix(text(cell(row, mapping.prefix))), firstName: text(cell(row, mapping.firstName)), lastName: text(cell(row, mapping.lastName)) };
  if ((!firstName || !lastName) && mapping.fullName !== undefined) {
    const split = splitThaiName(text(cell(row, mapping.fullName)));
    prefix ||= split.prefix;
    firstName ||= split.firstName;
    lastName ||= split.lastName;
  } else if (firstName && !prefix) {
    const split = splitThaiName(firstName); // บางไฟล์ใส่ "นายสมชาย" ในช่องชื่อ
    if (split.prefix) { prefix = split.prefix; firstName = `${split.firstName}${split.lastName ? ` ${split.lastName}` : ''}`; }
  }
  if (!firstName) err('firstName', 'ไม่มีชื่อ');
  if (!lastName) err('lastName', 'ไม่มีนามสกุล');
  if (!prefix) warn('prefix', 'ไม่มีคำนำหน้า');

  const rawBirth = cell(row, mapping.birthDate);
  const birthDate = parseThaiDate(rawBirth);
  if (rawBirth !== undefined && rawBirth !== '' && rawBirth !== null && !birthDate) err('birthDate', `อ่านวันเกิด "${text(rawBirth)}" ไม่ได้`);
  if (birthDate) {
    const age = Number(currentYear - 543) - Number(birthDate.slice(0, 4));
    if (age < 12 || age > 70) warn('birthDate', `อายุ ${age} ปี ดูไม่ปกติ ตรวจสอบปี พ.ศ./ค.ศ.`);
  }

  const lv = parseLevel(text(cell(row, mapping.level)));
  const program = normalizeOrgName(text(cell(row, mapping.program)));
  const department = normalizeOrgName(text(cell(row, mapping.department)));
  if (!program) err('program', 'ไม่มีสาขาวิชา');

  // ชั้นปี: คิดจากรหัส (ปีที่เข้า) เป็นหลัก ตามที่วิทยาลัยใช้ 68xx = เข้าปี 2568
  const entryYear = studentCode ? entryYearFromCode(studentCode) : null;
  const fileYear = Number(text(cell(row, mapping.yearLevel)).replace(/\D/g, '')) || lv.year;
  let yearLevel: number | null = entryYear ? yearLevelFrom(entryYear, currentYear) : null;
  if (entryYear && (yearLevel! < 1 || yearLevel! > 6)) { warn('studentCode', `รหัสบอกว่าเข้าปี ${entryYear} คิดเป็นชั้นปีที่ ${yearLevel} ไม่สมเหตุสมผล`); yearLevel = null; }
  if (fileYear && yearLevel && fileYear !== yearLevel) warn('yearLevel', `ในไฟล์เป็นปี ${fileYear} แต่รหัสบอกว่าเข้าปี ${entryYear} (ควรเป็นปี ${yearLevel}) — ใช้ตามรหัส`);
  if (!yearLevel && fileYear) yearLevel = fileYear;
  if (!yearLevel) err('yearLevel', 'ไม่รู้ชั้นปี (รหัสไม่ได้ขึ้นต้นด้วยปีที่เข้า และไม่มีคอลัมน์ชั้นปี)');

  const phone = text(cell(row, mapping.phone)).replace(/[^\d]/g, '');
  const nationalId = text(cell(row, mapping.nationalId)).replace(/[^\d]/g, '');
  if (nationalId && !validNationalId(nationalId)) warn('nationalId', 'เลขประจำตัวประชาชนไม่ถูกต้อง (เลขตรวจสอบไม่ตรง) — จะไม่บันทึก');

  return {
    student: {
      studentCode, prefix, firstName, lastName, birthDate, level: lv.level, department, program, yearLevel, entryYear,
      groupNo: text(cell(row, mapping.groupNo)).slice(0, 10), phone: phone.slice(0, 15),
      nationalId: nationalId && validNationalId(nationalId) ? nationalId : '',
      fatherName: text(cell(row, mapping.fatherName)).slice(0, 80), motherName: text(cell(row, mapping.motherName)).slice(0, 80),
      advisor: text(cell(row, mapping.advisor)).slice(0, 80),
    },
    issues,
  };
}

export const IMPORT_LIMITS = { maxRows: 5000, maxBytes: 5 * 1024 * 1024 } as const;
