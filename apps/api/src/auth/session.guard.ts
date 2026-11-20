import { ForbiddenException, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PositionKey, Role } from '@csis/shared';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma.service.js';
import { ALLOW_PENDING_PASSWORD, IS_PUBLIC, type AuthUser } from './decorators.js';
import { SESSION_COOKIE, hashToken } from './session.js';

/** ทุกเส้นทางต้องล็อกอิน ยกเว้นที่ติด @Public() และบัญชีที่ยังไม่เปลี่ยนรหัสผ่านครั้งแรกใช้ได้แค่หน้าเปลี่ยนรหัส */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length < 20) throw new UnauthorizedException('กรุณาเข้าสู่ระบบ');

    const session = await this.prisma.session.findUnique({
      where: { id: hashToken(token) },
      include: { user: { include: { roles: true, positions: { select: { key: true } }, student: { select: { id: true } } } } },
    });
    if (!session || session.expiresAt < new Date()) throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    const { user } = session;
    if (user.status !== 'ACTIVE' || user.deletedAt) throw new UnauthorizedException('บัญชีนี้ถูกระงับ');

    const roles = user.roles.map((r) => r.role as Role);
    // นักเรียนใช้วันเกิดเป็นรหัสผ่านต่อได้ (ตามที่วิทยาลัยเลือก) ปิดด้วย STUDENT_FORCE_PASSWORD_CHANGE=false
    // บัญชีเจ้าหน้าที่ยังบังคับเปลี่ยนรหัสครั้งแรกเสมอ
    const studentOnly = roles.length > 0 && roles.every((r) => r === 'STUDENT');
    const mustChangePassword = user.mustChangePassword && !(studentOnly && process.env.STUDENT_FORCE_PASSWORD_CHANGE === 'false');

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles,
      positions: user.positions.map((p) => p.key as PositionKey),
      mustChangePassword,
      studentId: user.student?.id ?? null,
      sessionId: session.id,
    };

    if (mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_PASSWORD, targets)) {
      throw new ForbiddenException({ message: 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน', code: 'MUST_CHANGE_PASSWORD' });
    }
    return true;
  }
}
