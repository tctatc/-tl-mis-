import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ACADEMIC_FIELDS, IMPORT_LIMITS, type AcademicKind } from '@csis/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { AcademicImportService } from '../imports/academic-import.service.js';
import { ACADEMIC_TEMPLATES, templateCsv, templateXlsx } from '../imports/file-reader.js';
import { AcademicAdminService } from './academic-admin.service.js';

/** ใส่ข้อมูลการเรียน: ผู้ดูแลระบบ + งานทะเบียน */
const requireRegistry = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR')) throw new ForbiddenException('เฉพาะผู้ดูแลระบบและงานทะเบียน');
};
const kindOf = (k: string): AcademicKind => {
  if (k !== 'plan' && k !== 'schedule' && k !== 'grade') throw new BadRequestException('ไม่รู้จักประเภทข้อมูล');
  return k;
};
const filter = z.object({
  termId: z.string().uuid().optional(),
  programId: z.string().uuid().optional(),
  yearLevel: z.coerce.number().int().min(1).max(5).optional(),
  groupNo: z.string().max(40).optional(),
});

@Controller('admin/academic')
export class AcademicAdminController {
  constructor(private readonly admin: AcademicAdminService, private readonly imports: AcademicImportService) {}

  @Get('terms') terms(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.admin.terms(); }
  @Get('classes') classes(@CurrentUser() u: AuthUser) { requireRegistry(u); return this.admin.classes(); }

  @Get('plan')
  plan(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireRegistry(u); return this.admin.plan(parseOr400(z.object({ programId: z.string().uuid('เลือกสาขา') }), q).programId); }

  @Get('schedule')
  schedule(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireRegistry(u); return this.admin.schedule(parseOr400(filter, q)); }

  @Get('grades')
  grades(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireRegistry(u); return this.admin.grades(parseOr400(filter, q)); }

  @Post('grades/publish')
  @HttpCode(200)
  publish(@CurrentUser() u: AuthUser, @Body() b: unknown, @Req() req: Request) { requireRegistry(u); return this.admin.publish(u, parseOr400(filter, b), clientIp(req)); }

  // ---------------- นำเข้า ----------------
  @Get('imports/:kind/template.:ext')
  async template(@CurrentUser() u: AuthUser, @Param('kind') k: string, @Param('ext') ext: string, @Res() res: Response) {
    requireRegistry(u);
    const t = ACADEMIC_TEMPLATES[kindOf(k)];
    const headers = [...t.headers];
    const sample = t.sample.map((r) => [...r]);
    if (ext === 'xlsx') {
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`แบบฟอร์ม${t.name}.xlsx`)}` });
      res.send(await templateXlsx(headers, sample, t.name));
    } else {
      res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`แบบฟอร์ม${t.name}.csv`)}` });
      res.send(templateCsv(headers, sample));
    }
  }

  @Post('imports/:kind')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_LIMITS.maxBytes, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @Param('kind') k: string, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined) {
    requireRegistry(u);
    if (!file) throw new BadRequestException('เลือกไฟล์ก่อน');
    return this.imports.upload(u, kindOf(k), file);
  }

  @Post('imports/:kind/:id/preview')
  @HttpCode(200)
  preview(@CurrentUser() u: AuthUser, @Param('kind') k: string, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown) {
    requireRegistry(u);
    const kind = kindOf(k);
    const fields = Object.keys(ACADEMIC_FIELDS[kind]) as [string, ...string[]];
    const body = parseOr400(z.object({ mapping: z.partialRecord(z.enum(fields), z.number().int().min(0).max(500)), termId: z.string().uuid().optional() }), b);
    return this.imports.preview(u, kind, id, { mapping: body.mapping as Record<string, number>, ...(body.termId ? { termId: body.termId } : {}) });
  }

  @Post('imports/:kind/:id/commit')
  @HttpCode(200)
  commit(@CurrentUser() u: AuthUser, @Param('kind') k: string, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    requireRegistry(u);
    return this.imports.commit(u, kindOf(k), id, clientIp(req));
  }
}
