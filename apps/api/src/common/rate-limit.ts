import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { clientIp } from './request-ip.js';

/**
 * จำกัดจำนวนคำขอต่อ IP ต่อ endpoint (หน้าต่างเวลาคงที่) — แทน @nestjs/throttler ที่ยังเป็น CommonJS
 * (โหลด @nestjs/common v12 ซึ่งเป็น ESM ไม่ได้บน Vercel)
 * นับในหน่วยความจำของเครื่องที่รันอยู่: บน serverless แต่ละ instance นับแยกกัน
 * การล็อกบัญชีเมื่อรหัสผิดซ้ำ (เก็บในฐานข้อมูล) ยังเป็นด่านหลักกันเดารหัส
 */
const RATE_LIMIT = 'csis:rate-limit';
export const RateLimit = (limit: number, ttlMs: number) => SetMetadata(RATE_LIMIT, { limit, ttlMs });
const DEFAULT = { limit: 300, ttlMs: 60_000 };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; reset: number }>();
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<{ limit: number; ttlMs: number }>(RATE_LIMIT, [ctx.getHandler(), ctx.getClass()]) ?? DEFAULT;
    const req = ctx.switchToHttp().getRequest<Request>();
    const key = `${clientIp(req)}|${ctx.getClass().name}.${ctx.getHandler().name}`;
    const now = Date.now();
    if (this.hits.size > 20_000) for (const [k, v] of this.hits) if (v.reset <= now) this.hits.delete(k);
    const cur = this.hits.get(key);
    if (!cur || cur.reset <= now) {
      this.hits.set(key, { count: 1, reset: now + rule.ttlMs });
      return true;
    }
    cur.count += 1;
    if (cur.count > rule.limit) {
      const wait = Math.ceil((cur.reset - now) / 1000);
      throw new HttpException(`ส่งคำขอถี่เกินไป กรุณารอ ${wait} วินาทีแล้วลองใหม่`, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }
}
