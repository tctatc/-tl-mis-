import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'csis_session';

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionDays = () => Math.max(1, Number(process.env.SESSION_DAYS ?? 7));

/**
 * secure: บังคับด้วย COOKIE_SECURE=true หรือเมื่อคำขอมาจากหน้าเว็บ https (Origin ที่เบราว์เซอร์ส่ง และ CSRF ตรวจแล้วว่าเป็นเว็บของเรา)
 * — เปิดผ่านลิงก์ https ได้คุกกี้ Secure ส่วน http://localhost ตอนพัฒนายังล็อกอินได้
 */
export function cookieOptions(maxAgeMs?: number, origin?: string) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' || !!origin?.startsWith('https://'),
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
  };
}
