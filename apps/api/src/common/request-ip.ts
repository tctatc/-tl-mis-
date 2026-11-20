import type { Request } from 'express';

/** IP ของผู้ใช้ (main.ts ตั้ง trust proxy ไว้ 1 ชั้น = Next.js ที่ส่งต่อมา) */
export const clientIp = (req: Request) => (req.ip ?? '').replace(/^::ffff:/, '');
