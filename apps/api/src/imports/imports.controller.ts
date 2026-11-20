import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMPORT_FIELDS, IMPORT_LIMITS } from '@csis/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { templateCsv, templateXlsx } from './file-reader.js';
import { StudentImportService } from './student-import.service.js';

/** นำเข้าข้อมูล: ผู้ดูแลระบบ + งานทะเบียน (spec 7.2) */
const requireImporter = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR')) throw new ForbiddenException('เฉพาะผู้ดูแลระบบและงานทะเบียน');
};

const fieldKeys = Object.keys(IMPORT_FIELDS) as [keyof typeof IMPORT_FIELDS, ...(keyof typeof IMPORT_FIELDS)[]];
const previewSchema = z.object({
  mapping: z.partialRecord(z.enum(fieldKeys), z.number().int().min(0).max(500)),
  mode: z.enum(['upsert', 'insert', 'update']).default('upsert'),
  createMissing: z.boolean().default(false),
});

@Controller('admin/imports/students')
export class ImportsController {
  constructor(private readonly students: StudentImportService) {}

  @Get('template.xlsx')
  async templateX(@CurrentUser() u: AuthUser, @Res() res: Response) {
    requireImporter(u);
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('แบบฟอร์มนำเข้านักเรียน.xlsx')}` });
    res.send(await templateXlsx());
  }

  @Get('template.csv')
  templateC(@CurrentUser() u: AuthUser, @Res() res: Response) {
    requireImporter(u);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('แบบฟอร์มนำเข้านักเรียน.csv')}` });
    res.send(templateCsv());
  }

  @Get()
  history(@CurrentUser() u: AuthUser) { requireImporter(u); return this.students.history(); }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_LIMITS.maxBytes, files: 1 } }))
  upload(@CurrentUser() u: AuthUser, @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined) {
    requireImporter(u);
    if (!file) throw new BadRequestException('เลือกไฟล์ก่อน');
    return this.students.upload(u, file);
  }

  @Post(':id/preview')
  @HttpCode(200)
  preview(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown) {
    requireImporter(u);
    return this.students.preview(u, id, parseOr400(previewSchema, b));
  }

  @Post(':id/commit')
  @HttpCode(200)
  commit(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    requireImporter(u);
    return this.students.commit(u, id, clientIp(req));
  }
}
