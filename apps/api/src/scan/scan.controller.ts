import { BadRequestException, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Req } from '@nestjs/common';
import { STUDENT_CODE_RE, type StudentScanView } from '@csis/shared';
import type { Request } from 'express';
import { CurrentUser, isStaff, seesAllRequests, type AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { RateLimit } from '../common/rate-limit.js';
import { clientIp } from '../common/request-ip.js';
import { PrismaService } from '../common/prisma.service.js';

/**
 * สแกน QR บัตรนักศึกษา
 * - ต้องล็อกอินเป็นครู/เจ้าหน้าที่ (นักเรียนสแกนดูคนอื่นไม่ได้)
 * - ข้อมูลพื้นฐาน (ชื่อ ชั้น สาขา สถานะ ครูที่ปรึกษา) เห็นได้ทุกคนที่เป็นครู/เจ้าหน้าที่
 * - เบอร์โทร/อีเมล/ผู้ปกครอง เห็นเฉพาะผู้ดูแลระบบ งานทะเบียน และครูที่ปรึกษาของนักเรียนคนนั้น
 * - ไม่ส่งวันเกิด (เป็นรหัสผ่านเริ่มต้น) เลขบัตรประชาชน และที่อยู่ ในหน้านี้เลย
 * - บันทึกทุกครั้งที่สแกนลงประวัติการใช้งาน
 */
@Injectable()
export class ScanService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async student(u: AuthUser, code: string, ip: string): Promise<StudentScanView> {
    const s = await this.prisma.student.findFirst({
      where: { studentCode: code, deletedAt: null },
      include: { program: { include: { department: true } }, advisor: { select: { displayName: true } }, guardians: true },
    });
    if (!s) throw new NotFoundException(`ไม่พบนักเรียนรหัส ${code}`);
    const isAdvisee = s.advisorUserId === u.id;
    const full = seesAllRequests(u) || isAdvisee;
    await this.audit.log({ actorUserId: u.id, action: 'student.scan', entity: 'student', entityId: s.id, after: { access: full ? 'full' : 'basic' }, ip });
    return {
      studentCode: s.studentCode, prefix: s.prefix, firstName: s.firstName, lastName: s.lastName, nickname: s.nickname,
      level: s.program.level, program: s.program.name, department: s.program.department.name, yearLevel: s.yearLevel, groupNo: s.groupNo,
      status: s.status, advisor: s.advisor?.displayName ?? '',
      access: full ? 'full' : 'basic', isAdvisee,
      contact: full ? {
        phone: s.phone, email: s.email,
        guardians: [...s.guardians].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((g) => ({ relation: g.relation, name: g.name, phone: g.phone, isPrimary: g.isPrimary })),
      } : null,
    };
  }
}

@Controller('scan')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  @RateLimit(60, 60_000)
  @Get('student/:code')
  student(@CurrentUser() u: AuthUser, @Param('code') code: string, @Req() req: Request) {
    if (!isStaff(u)) throw new ForbiddenException('การสแกนดูข้อมูลนักเรียนใช้ได้เฉพาะครูและเจ้าหน้าที่');
    if (!STUDENT_CODE_RE.test(code)) throw new BadRequestException('รหัสนักศึกษาไม่ถูกต้อง');
    return this.scan.student(u, code, clientIp(req));
  }
}
