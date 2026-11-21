import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { StaffService } from './staff.service.js';

/** ข้อมูลครูและบุคลากรมีเบอร์โทร/อีเมล → ผู้ดูแลระบบเท่านั้น */
const requireAdmin = (u: AuthUser) => { if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')) throw new ForbiddenException('เฉพาะผู้ดูแลระบบ'); };

const kind = z.enum(['teacher', 'support']);
const workStatus = z.enum(['active', 'on_leave', 'transferred', 'retired', 'resigned']);
const text = (max: number) => z.string().trim().max(max).default('');
const listQuery = z.object({
  q: z.string().max(60).optional(), departmentId: z.string().uuid().optional(), programId: z.string().uuid().optional(),
  kind: kind.optional(), workStatus: workStatus.optional(), none: z.literal('1').optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});
const profile = z.object({
  staffCode: z.string().trim().max(40).transform((v) => v.replace(/\s+/g, '') || null).nullable().default(null),
  prefix: text(20), firstName: z.string().trim().min(1, 'กรอกชื่อ').max(80), lastName: text(80),
  kind: kind.default('teacher'), positionTitle: text(100), employment: text(100),
  departmentId: z.string().uuid().nullable().default(null), programId: z.string().uuid().nullable().default(null),
  workStatus: workStatus.default('active'),
  phone: z.string().trim().regex(/^[0-9-]{0,15}$/, 'ตัวเลขเท่านั้น').default(''),
  email: z.union([z.literal(''), z.string().trim().email('อีเมลไม่ถูกต้อง').max(120)]).default(''),
});

@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() u: AuthUser) { requireAdmin(u); return this.staff.dashboard(); }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireAdmin(u); return this.staff.list(parseOr400(listQuery, q)); }

  @Get(':id')
  detail(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireAdmin(u); return this.staff.detail(id); }

  @Put(':id')
  save(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAdmin(u);
    return this.staff.save(u, id, parseOr400(profile, b), clientIp(req));
  }
}
