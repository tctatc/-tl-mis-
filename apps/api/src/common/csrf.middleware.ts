import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * กัน CSRF สำหรับเซสชันแบบคุกกี้ (นอกเหนือจาก SameSite=Lax):
 * คำขอที่แก้ไขข้อมูลต้องมี header X-CSIS (เว็บอื่นใส่ไม่ได้ถ้าไม่ผ่าน preflight ซึ่งเราไม่เปิด CORS)
 * และถ้าเบราว์เซอร์ส่ง Origin มา ต้องเป็นเว็บของเราเท่านั้น
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowed = (process.env.WEB_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE.has(req.method)) return next();
    if (req.get('x-csis') !== '1') throw new ForbiddenException('คำขอไม่ได้มาจากหน้าเว็บของระบบ');
    const origin = req.get('origin');
    if (origin && this.allowed.length > 0 && !this.allowed.includes(origin)) {
      throw new ForbiddenException('คำขอไม่ได้มาจากหน้าเว็บของระบบ');
    }
    next();
  }
}
