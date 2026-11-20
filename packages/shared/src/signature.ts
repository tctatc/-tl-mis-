/**
 * ลายเซ็นนักศึกษา (วาดบนจอ) เก็บเป็น PNG data URL
 * รับเฉพาะ PNG จริง (ขึ้นต้นด้วยหัวไฟล์ PNG) ขนาดจำกัด — กันการแอบใส่ SVG/สคริปต์หรือไฟล์ใหญ่
 */
const PREFIX = 'data:image/png;base64,';
/** base64 ประมาณ 90 KB ของไฟล์จริง — ลายเซ็นที่ตัดขอบแล้วมักไม่ถึง 15 KB */
export const SIGNATURE_MAX_CHARS = 120_000;

export function isValidSignature(value: string): boolean {
  if (!value.startsWith(PREFIX) || value.length > SIGNATURE_MAX_CHARS) return false;
  const body = value.slice(PREFIX.length);
  // หัวไฟล์ PNG (89 50 4E 47 0D 0A 1A 0A) ในรูป base64
  return body.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/]+={0,2}$/.test(body);
}
