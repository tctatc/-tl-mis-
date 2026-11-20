import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { POSITIONS, ROLES, passwordProblem } from '@csis/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { AdminService } from './admin.service.js';

/** ทุกเส้นทางใน /admin ใช้ได้เฉพาะ SUPER_ADMIN / ADMIN (ตรวจที่นี่ ไม่พึ่งการซ่อนเมนูของหน้าเว็บ) */
const requireAdmin = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN')) throw new ForbiddenException('เฉพาะผู้ดูแลระบบ');
};
/** ข้อมูลนักเรียน: ผู้ดูแลระบบ + งานทะเบียน (spec 5.1 งานทะเบียนจัดการประวัตินักศึกษา) */
const requireRegistry = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR')) throw new ForbiddenException('เฉพาะผู้ดูแลระบบและงานทะเบียน');
};

const page = z.coerce.number().int().min(0).max(10_000).default(0);
const role = z.enum(ROLES);
const name = z.string().trim().min(1, 'กรอกข้อมูล').max(80);
const opt = (max: number) => z.string().trim().max(max).default('');
const uuidOrNull = z.string().uuid().nullable().default(null);

const userCreate = z.object({
  username: z.string().trim().min(3, 'อย่างน้อย 3 ตัว').max(40).regex(/^[a-zA-Z0-9._-]+$/, 'ใช้ได้เฉพาะ a-z 0-9 . _ -'),
  displayName: name,
  roles: z.array(role).min(1, 'เลือกบทบาทอย่างน้อย 1').max(8),
  password: z.string().superRefine((v, ctx) => { const p = passwordProblem(v); if (p) ctx.addIssue({ code: 'custom', message: p }); }),
  mustChangePassword: z.boolean().default(false),
});
const resetSchema = z.object({ password: z.string().max(128).default(''), mustChangePassword: z.boolean().default(false) });
const userUpdate = z.object({ displayName: name.optional(), roles: z.array(role).min(1).max(8).optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional() });
const student = z.object({
  studentCode: z.string().trim().regex(/^\d{5,15}$/, 'ตัวเลข 5–15 หลัก'),
  prefix: z.string().trim().min(1).max(20), firstName: name, lastName: name,
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง').nullable().default(null),
  programId: z.string().uuid('เลือกสาขา'), yearLevel: z.coerce.number().int().min(1, 'ชั้นปี 1–5').max(5, 'ชั้นปี 1–5'), groupNo: opt(10),
  status: z.enum(['studying', 'on_leave', 'graduated', 'resigned', 'dismissed']).default('studying'), advisorUserId: uuidOrNull,
  phone: z.string().trim().regex(/^[0-9-]{0,15}$/, 'ตัวเลขเท่านั้น').default(''), email: z.union([z.literal(''), z.string().trim().email('อีเมลไม่ถูกต้อง').max(120)]).default(''),
  fatherName: opt(80), motherName: opt(80), nickname: opt(30),
  nationalId: z.string().trim().regex(/^(\d{13})?$/, 'เลข 13 หลัก').default(''),
});

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(@CurrentUser() u: AuthUser) { requireAdmin(u); return this.admin.stats(); }

  @Get('users')
  users(@CurrentUser() u: AuthUser, @Query() q: unknown) {
    requireAdmin(u);
    return this.admin.listUsers(parseOr400(z.object({ q: z.string().max(60).optional(), role: role.optional(), status: z.enum(['ACTIVE', 'SUSPENDED']).optional(), staff: z.literal('1').optional(), page }), q));
  }

  @Get('staff-options')
  staffOptions(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.admin.staffOptions(); }

  @Post('users')
  createUser(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) { requireAdmin(u); return this.admin.createUser(u, parseOr400(userCreate, b), clientIp(req)); }

  @Patch('users/:id')
  async updateUser(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAdmin(u);
    await this.admin.updateUser(u, id, parseOr400(userUpdate, b), clientIp(req));
    return { ok: true };
  }

  @Post('users/:id/reset-password')
  @HttpCode(200)
  reset(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) { requireAdmin(u); return this.admin.resetPassword(u, id, parseOr400(resetSchema, b), clientIp(req)); }

  @Post('users/:id/unlock')
  @HttpCode(200)
  async unlock(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) { requireAdmin(u); await this.admin.unlock(u, id, clientIp(req)); return { ok: true }; }

  @Get('logins')
  logins(@CurrentUser() u: AuthUser, @Query() q: unknown) {
    requireAdmin(u);
    return this.admin.loginLogs(parseOr400(z.object({ userId: z.string().uuid().optional(), failedOnly: z.enum(['1', '0']).optional().transform((v) => v === '1'), page }), q));
  }

  @Get('positions')
  positions(@CurrentUser() u: AuthUser) { requireAdmin(u); return this.admin.positions(); }

  @Put('positions/:key')
  async updatePosition(@CurrentUser() u: AuthUser, @Param('key') key: string, @Body() b: unknown, @Req() req: Request) {
    requireAdmin(u);
    if (!(key in POSITIONS)) throw new ForbiddenException('ไม่พบตำแหน่ง');
    await this.admin.updatePosition(u, key, parseOr400(z.object({ userId: uuidOrNull, holderName: opt(80) }), b), clientIp(req));
    return { ok: true };
  }

  @Get('programs')
  programs(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.admin.programs(); }

  @Put('programs/:id/head')
  async programHead(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAdmin(u);
    await this.admin.setProgramHead(u, id, parseOr400(z.object({ headUserId: uuidOrNull }), b).headUserId, clientIp(req));
    return { ok: true };
  }

  @Get('students')
  students(@CurrentUser() u: AuthUser, @Query() q: unknown) {
    requireRegistry(u);
    return this.admin.listStudents(parseOr400(z.object({ q: z.string().max(60).optional(), programId: z.string().uuid().optional(), status: z.string().max(20).optional(), yearLevel: z.coerce.number().int().min(1).max(5).optional(), page }), q));
  }

  @Get('students/:id')
  student(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireRegistry(u); return this.admin.getStudent(id); }

  @Post('students')
  createStudent(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) { requireRegistry(u); return this.admin.saveStudent(u, null, parseOr400(student, b), clientIp(req)); }

  @Put('students/:id')
  updateStudent(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireRegistry(u);
    return this.admin.saveStudent(u, id, parseOr400(student, b), clientIp(req));
  }

  @Get('audit')
  audit(@CurrentUser() u: AuthUser, @Query() q: unknown) {
    requireAdmin(u);
    return this.admin.auditLogs(parseOr400(z.object({ entity: z.string().max(30).optional(), action: z.string().max(40).optional(), page }), q));
  }
}
