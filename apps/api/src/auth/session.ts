import { createHash, randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'csis_session';

export const newSessionToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const sessionDays = () => Math.max(1, Number(process.env.SESSION_DAYS ?? 7));

export function cookieOptions(maxAgeMs?: number) {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    ...(maxAgeMs === undefined ? {} : { maxAge: maxAgeMs }),
  };
}
