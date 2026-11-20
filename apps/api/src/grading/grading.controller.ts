import { BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMPORT_LIMITS, SPECIAL_GRADES } from '@csis/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, isStaff, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { GradingService } from './grading.service.js';
import { parseRoster, rosterTemplate } from './roster-file.js';

const requireStaff = (u: AuthUser) => { if (!isStaff(u)) throw new ForbiddenException('เฉพาะครูและเจ้าหน้าที่'); };
/** งานวัดผล: ผู้ดูแลระบบ + เจ้าหน้าที่วัดผล */
const requireAssessment = (u: AuthUser) => {
  if (!u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'ASSESSMENT_STAFF')) throw new ForbiddenException('เฉพาะงานวัดผลและผู้ดูแลระบบ');
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง');
const score = z.number().min(0, 'คะแนน 0 ถึง 100').max(100, 'คะแนน 0 ถึง 100').multipleOf(0.01, 'ทศนิยมไม่เกิน 2 ตำแหน่ง').nullable();
const special = z.enum(SPECIAL_GRADES).nullable();
const entryRows = z.object({ rows: z.array(z.object({ studentId: z.string().uuid(), score, special })).max(500) });
const termQuery = z.object({ termId: z.string().uuid().optional() });
type Upload = { buffer: Buffer; originalname: string } | undefined;
const xlsxHeaders = (name: string) => ({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });

/** ครูผู้สอน: เห็น/แก้เฉพาะวิชาของตัวเอง (service กรองด้วย teacherUserId = ผู้ใช้) */
@Controller('teach')
export class TeachController {
  constructor(private readonly grading: GradingService) {}

  @Get('sections')
  sections(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireStaff(u); return this.grading.teacherSections(u, parseOr400(termQuery, q).termId); }

  @Get('sections/:id')
  section(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireStaff(u); return this.grading.teacherSection(u, id); }

  @Put('sections/:id/grades')
  save(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireStaff(u);
    return this.grading.save(u, id, parseOr400(entryRows, b).rows, clientIp(req));
  }

  @Post('sections/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) { requireStaff(u); return this.grading.submit(u, id, clientIp(req)); }

  @Get('sections/:id/template.xlsx')
  async template(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Res() res: Response) {
    requireStaff(u);
    const d = await this.grading.teacherSection(u, id);
    res.set(xlsxHeaders(`คะแนน ${d.subject.code} ${d.term.label.replace('/', '-')}.xlsx`)).send(await rosterTemplate(d));
  }

  /** อ่านไฟล์คะแนน — ไม่บันทึก หน้าเว็บเอาไปเติมตารางให้ครูตรวจแล้วกดบันทึกเอง */
  @Post('sections/:id/parse')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMPORT_LIMITS.maxBytes, files: 1 } }))
  async parse(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @UploadedFile() file: Upload) {
    requireStaff(u);
    if (!file) throw new BadRequestException('เลือกไฟล์ก่อน');
    const d = await this.grading.teacherSection(u, id);
    return parseRoster(file.buffer, file.originalname, d.rows);
  }
}

/** งานวัดผล: กระดานส่งผล, ส่งคืน/อนุมัติ/ประกาศ, แก้ไขผล */
@Controller('admin/grading')
export class GradingAdminController {
  constructor(private readonly grading: GradingService) {}

  @Get('board')
  board(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireAssessment(u); return this.grading.board(parseOr400(termQuery, q).termId); }

  @Get('teachers')
  teachers(@CurrentUser() u: AuthUser) { requireAssessment(u); return this.grading.teachers(); }

  @Get('sections/:id')
  section(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireAssessment(u); return this.grading.adminSection(id); }

  @Get('sections/:id/records')
  records(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireAssessment(u); return this.grading.recordIds(id); }

  @Get('sections/:id/changes')
  changes(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) { requireAssessment(u); return this.grading.changes(id); }

  @Patch('terms/:id/window')
  window(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    return this.grading.setWindow(u, id, parseOr400(z.object({ gradeOpenAt: date.nullable(), gradeDueAt: date.nullable() }), b), clientIp(req));
  }

  @Patch('sections/:id/teacher')
  teacher(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    return this.grading.assignTeacher(u, id, parseOr400(z.object({ teacherUserId: z.string().uuid().nullable() }), b).teacherUserId, clientIp(req));
  }

  @Post('sections/:id/return')
  @HttpCode(200)
  giveBack(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    const { note } = parseOr400(z.object({ note: z.string().trim().min(3, 'บอกครูว่าต้องแก้อะไร').max(500) }), b);
    return this.grading.transition(u, id, 'return', { note }, clientIp(req));
  }

  @Post('sections/:id/:action')
  @HttpCode(200)
  act(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Param('action') action: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    if (action === 'approve' || action === 'publish') {
      const { date: d } = parseOr400(z.object({ date }), b);
      return this.grading.transition(u, id, action, { date: d }, clientIp(req));
    }
    if (action === 'unapprove' || action === 'unpublish') return this.grading.transition(u, id, action, {}, clientIp(req));
    throw new BadRequestException('ไม่รู้จักคำสั่ง');
  }

  @Post('bulk/:action')
  @HttpCode(200)
  bulk(@CurrentUser() u: AuthUser, @Param('action') action: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    if (action !== 'approve' && action !== 'publish') throw new BadRequestException('ไม่รู้จักคำสั่ง');
    const body = parseOr400(z.object({ sectionIds: z.array(z.string().uuid()).min(1).max(500), date }), b);
    return this.grading.transitionMany(u, body.sectionIds, action, body.date, clientIp(req));
  }

  @Patch('records/:id')
  correct(@CurrentUser() u: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown, @Req() req: Request) {
    requireAssessment(u);
    const body = parseOr400(z.object({ score, special, reason: z.string().trim().min(5, 'ใส่เหตุผลที่แก้ (เช่น เลขที่คำร้อง)').max(500) }), b);
    return this.grading.correct(u, id, body, clientIp(req));
  }
}
