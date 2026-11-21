import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { defaultStudentPassword, legacyStudentPassword, type Me, type PositionKey, type Role, type StudentSnapshot } from '@csis/shared';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { loadStudentSnapshot } from '../common/student-snapshot.js';
import type { AuthUser } from './decorators.js';
import { hashToken, newSessionToken, sessionDays } from './session.js';

/** Argon2id ตามข้อกำหนด (ค่าตาม OWASP: m=19 MiB, t=2, p=1) */
const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const hashPassword = (password: string) => hash(password, ARGON);

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_FAILS = 30;

/** hash จำลอง ใช้ตรวจเมื่อไม่พบชื่อผู้ใช้ ให้เวลาตอบเท่ากัน (เดาไม่ได้ว่ารหัสนักศึกษาไหนมีอยู่จริง) */
let dummyHash: Promise<string> | null = null;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async login(usernameRaw: string, password: string, ip: string, userAgent: string) {
    const username = usernameRaw.trim();
    const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000);
    const ipFails = await this.prisma.loginLog.count({ where: { ip, success: false, at: { gte: since } } });
    if (ipFails >= IP_MAX_FAILS) {
      throw new HttpException('ลองเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({ where: { username } });
    const fail = async (reason: string, userId: string | null = null) => {
      await this.prisma.loginLog.create({ data: { username, userId, success: false, reason, ip } });
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    };

    if (!user || user.deletedAt) {
      dummyHash ??= hash('not-a-real-password', ARGON);
      await verify(await dummyHash, password).catch(() => false);
      return fail('unknown_user');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
      await this.prisma.loginLog.create({ data: { username, userId: user.id, success: false, reason: 'locked', ip } });
      throw new HttpException(`บัญชีถูกล็อกชั่วคราว ลองใหม่ในอีก ${minutes} นาที`, HttpStatus.TOO_MANY_REQUESTS);
    }

    const ok = await verify(user.passwordHash, password).catch(() => false);
    if (!ok) {
      const fails = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: fails },
      });
      return fail('bad_password', user.id);
    }
    if (user.status !== 'ACTIVE') return fail('suspended', user.id);

    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + sessionDays() * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.session.create({ data: { id: hashToken(token), userId: user.id, expiresAt, ip, userAgent: userAgent.slice(0, 300) } }),
      this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } }),
      this.prisma.loginLog.create({ data: { username, userId: user.id, success: true, ip } }),
      // เก็บกวาดเซสชันหมดอายุของผู้ใช้คนนี้ไปด้วย
      this.prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    ]);
    return { token, expiresAt };
  }

  async logout(sessionId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  async changePassword(user: AuthUser, current: string, next: string, ip: string) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { student: true } });
    if (!(await verify(row.passwordHash, current).catch(() => false))) {
      throw new BadRequestException({ message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง', fields: { current: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } });
    }
    if (current === next) throw new BadRequestException({ message: 'ต้องไม่ซ้ำรหัสเดิม', fields: { next: 'ต้องไม่ซ้ำรหัสเดิม' } });
    const birth = row.student?.birthDate?.toISOString().slice(0, 10);
    const birthForms = birth ? [defaultStudentPassword(birth), legacyStudentPassword(birth), birth, birth.replaceAll('-', '')] : [];
    if (birthForms.includes(next) || next.toLowerCase().includes(row.username.toLowerCase())) {
      throw new BadRequestException({ message: 'ห้ามใช้วันเกิดหรือรหัสนักศึกษาเป็นรหัสผ่าน', fields: { next: 'ห้ามใช้วันเกิดหรือรหัสนักศึกษาเป็นรหัสผ่าน' } });
    }

    const passwordHash = await hashPassword(next);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
      // ออกจากระบบทุกเครื่องอื่น เหลือเครื่องที่เปลี่ยนรหัสอยู่
      await tx.session.deleteMany({ where: { userId: user.id, id: { not: user.sessionId } } });
      await this.audit.log({ actorUserId: user.id, action: 'user.password_change', entity: 'user', entityId: user.id, ip }, tx);
    });
  }

  async me(user: AuthUser): Promise<Me> {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles as Role[],
      positions: user.positions as PositionKey[],
      mustChangePassword: user.mustChangePassword,
      student: user.studentId ? await this.studentSnapshot(user.studentId) : null,
    };
  }

  studentSnapshot(studentId: string): Promise<StudentSnapshot> {
    return loadStudentSnapshot(this.prisma, studentId);
  }
}
