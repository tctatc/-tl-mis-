/** วันที่แบบไทยสำหรับเอกสารราชการ — ทุกฟังก์ชันคิดตามเวลาไทย (Asia/Bangkok) ไม่ขึ้นกับเครื่องที่รัน */

export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

export interface DateParts { day: number; month: number; year: number }

export const toBuddhistYear = (ceYear: number) => ceYear + 543;

/** แยกวัน/เดือน/ปี (ค.ศ.) ของเวลา ISO ตามเวลาไทย */
export function bangkokDateParts(iso: string | Date): DateParts {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { day: get('day'), month: get('month'), year: get('year') };
}

/** 'YYYY-MM-DD' → ส่วนของวันที่ (ไม่ผ่าน Date เพื่อไม่ให้เขตเวลาเลื่อนวัน) */
export function parseIsoDate(value: string | null | undefined): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month, year };
}

/** 1 พฤศจิกายน 2569 */
export function formatThaiDate(parts: DateParts | null): string {
  if (!parts) return '';
  return `${parts.day} ${THAI_MONTHS[parts.month - 1]} ${toBuddhistYear(parts.year)}`;
}

/** 17 พ.ย. 2569 14:05 — ใช้ในหน้าจอ ไม่ใช้บนแบบฟอร์ม */
export function formatThaiDateTime(iso: string): string {
  const date = new Date(iso);
  const p = bangkokDateParts(date);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${p.day} ${THAI_MONTHS_SHORT[p.month - 1]} ${toBuddhistYear(p.year)} ${time}`;
}

/** 17/11/2569 — ช่อง ..../..../.... ใต้ลายเซ็น */
export function formatSlashDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = bangkokDateParts(iso);
  return `${p.day}/${p.month}/${toBuddhistYear(p.year)}`;
}

/** ปีการศึกษาไทย (พ.ศ.) ของวันที่: เปิดภาคเรียนที่ 1 ราวพฤษภาคม ก่อนพฤษภาคมยังนับเป็นปีการศึกษาก่อนหน้า */
export function academicYearOf(iso: string | Date): number {
  const p = bangkokDateParts(iso);
  return toBuddhistYear(p.month >= 5 ? p.year : p.year - 1);
}

/** รหัสผ่านเริ่มต้นของนักศึกษา = วันเกิดรูปแบบ DD/MM/YYYY (ปี ค.ศ. ตามข้อกำหนด) */
export function defaultStudentPassword(birthDate: string): string {
  const p = parseIsoDate(birthDate);
  if (!p) throw new Error('วันเกิดไม่ถูกต้อง');
  return `${String(p.day).padStart(2, '0')}/${String(p.month).padStart(2, '0')}/${p.year}`;
}
