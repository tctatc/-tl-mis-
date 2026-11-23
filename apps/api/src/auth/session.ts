import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'csis_session';

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionDays = () => Math.max(1, Number(process.env.SESSION_DAYS ?? 7));

/**
 * secure: บังคับด้วย COOKIE_SECURE=true หรือเมื่อคำขอมาจากหน้าเว็บ https (Origin ที่เบราว์เซอร์ส่ง และ CSRF ตรวจแล้วว่าเป็นเว็บของเรา)
 * — เปิดผ่านลิงก์ https ได้คุกกี้ Secure ส่วน http://localhost ตอนพัฒนายังล็อกอินได้
 *
 * https: SameSite=None + Partitioned (CHIPS) เพื่อให้ล็อกอินได้เมื่อหน้าเว็บถูกฝังใน iframe ของเว็บอื่น
 * คุกกี้ถูกแยกตามเว็บแม่ → เว็บที่ฝังเราไว้มองไม่เห็นเซสชันที่ล็อกอินไว้ตรงๆ (กัน clickjacking) และคำขอข้ามเว็บไม่แนบคุกกี้นี้
 * CSRF ยังตรวจ Origin + x-csis ทุกคำขอที่เปลี่ยนข้อมูลเหมือนเดิม
 */
export function cookieOptions(maxAgeMs?: number, origin?: string) {
  const secure = process.env.COOKIE_SECURE === 'true' || !!origin?.startsWith('https://');
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? ('none' as const) : ('lax' as const),
    partitioned: secure,
    path: '/',
    ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
  };
}

/** คุกกี้แบบเดิม (Lax ไม่แยกพาร์ทิชัน) ที่ยังค้างในเบราว์เซอร์ — ล้างทิ้งตอนล็อกอิน/ออกจากระบบ */
export const legacyCookieOptions = (origin?: string) => ({
  ...cookieOptions(undefined, origin),
  sameSite: 'lax' as const,
  partitioned: false,
});
