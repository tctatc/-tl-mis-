import { Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { RegistryService } from './registry.service.js';

const requireRegistry = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR')) throw new ForbiddenException('เฉพาะงานทะเบียนและผู้ดูแลระบบ');
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง');
const code = z.string().trim().regex(/^[0-9A-Za-z-]{4,20}$/, 'รหัสกลุ่มใช้ตัวเลข/ตัวอักษร 4–20 ตัว');
const groupNo = z.string().trim().min(1, 'ใส่ชื่อห้อง').max(20);

@Controller('admin/registry')
export class RegistryController {
  constructor(private readonly registry: RegistryService) {}

  @Get('groups')
  groups(@CurrentUser() u: AuthUser, @Query() q: unknown) {
    requireRegistry(u);
    const f = parseOr400(z.object({ programId: z.string().uuid().optional(), active: z.enum(['true', 'false']).optional(), search: z.string().max(40).optional() }), q);
    return this.registry.groups({ ...(f.programId ? { programId: f.programId } : {}), ...(f.active ? { active: f.active === 'true' } : {}), ...(f.search ? { search: f.search } : {}) });
  }

  @Get('groups/:id/students')
  students(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireRegistry(u); return this.registry.groupStudents(id); }

  @Post('groups')
  create(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) {
    requireRegistry(u);
    const body = parseOr400(z.object({ code, programId: z.string().uuid(), entryYear: z.number().int().min(2540).max(2600), groupNo, yearLevel: z.number().int().min(1).max(3) }), b);
    return this.registry.createGroup(u, body, clientIp(req));
  }

  @Patch('groups/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireRegistry(u);
    const body = parseOr400(z.object({ code: code.optional(), groupNo: groupNo.optional(), active: z.boolean().optional() }), b);
    return this.registry.updateGroup(u, id, body, clientIp(req));
  }

  @Post('groups/backfill')
  @HttpCode(200)
  backfill(@CurrentUser() u: AuthUser, @Body() b: unknown) {
    requireRegistry(u);
    return this.registry.backfill(u, parseOr400(z.object({ dryRun: z.boolean() }), b).dryRun);
  }

  @Get('promotion')
  promotion(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.registry.promotionPreview(); }

  @Get('promotion/history')
  history(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.registry.promotionHistory(); }

  @Post('promotion')
  @HttpCode(200)
  promote(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) {
    requireRegistry(u);
    const body = parseOr400(z.object({ groupIds: z.array(z.string().uuid()).min(1).max(500), academicYear: z.number().int().min(2540).max(2600) }), b);
    return this.registry.promote(u, body.groupIds, body.academicYear, clientIp(req));
  }

  @Post('promotion/:id/undo')
  @HttpCode(200)
  undo(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) { requireRegistry(u); return this.registry.undoPromotion(u, id, clientIp(req)); }

  @Get('graduation/:groupId')
  candidates(@CurrentUser() u: AuthUser, @Param('groupId', new ParseUUIDPipe()) id: string) { requireRegistry(u); return this.registry.graduationCandidates(id); }

  @Post('graduation')
  @HttpCode(200)
  graduate(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) {
    requireRegistry(u);
    const body = parseOr400(z.object({ studentIds: z.array(z.string().uuid()).min(1).max(500), date }), b);
    return this.registry.approveGraduation(u, body.studentIds, body.date, clientIp(req));
  }

  @Post('graduation/:studentId/undo')
  @HttpCode(200)
  undoGraduate(@CurrentUser() u: AuthUser, @Param('studentId', new ParseUUIDPipe()) id: string, @Req() req: Request) { requireRegistry(u); return this.registry.undoGraduation(u, id, clientIp(req)); }
}
