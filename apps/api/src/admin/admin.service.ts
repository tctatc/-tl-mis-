import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { POSITIONS, ROLES, defaultStudentPassword, passwordProblem, type Role } from '@csis/shared';
import { hashPassword } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const PAGE = 30;
const PRIVILEGED: readonly Role[] = ['SUPER_ADMIN', 'ADMIN'];
const isSuper = (u: AuthUser) => u.roles.includes('SUPER_ADMIN');

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ---------------- Dashboard ----------------
  async stats() {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [students, byStatus, staff, departments, programs, curriculums, requests, logins, failed, term, recent] = await Promise.all([
      this.prisma.student.count({ where: { deletedAt: null } }),
      this.prisma.student.groupBy({ by: ['status'], _count: true, where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, roles: { some: { role: { not: 'STUDENT' } } } } }),
      this.prisma.department.count(),
      this.prisma.program.count(),
      this.prisma.curriculum.count(),
      this.prisma.request.groupBy({ by: ['status'], _count: true }),
      this.prisma.loginLog.count({ where: { success: true, at: { gte: since } } }),
      this.prisma.loginLog.count({ where: { success: false, at: { gte: since } } }),
      this.prisma.academicTerm.findFirst({ where: { isCurrent: true } }),
      this.prisma.auditLog.findMany({ orderBy: { at: 'desc' }, take: 8 }),
    ]);
    const registered = term ? await this.prisma.registration.count({ where: { termId: term.id, status: 'registered' } }) : 0;
    const names = await this.userNames(recent.map((r) => r.actorUserId));
    return {
      students, staff, departments, programs, curriculums,
      studentsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      requestsByStatus: Object.fromEntries(requests.map((r) => [r.status, r._count])),
      term: term ? { year: term.year, term: term.term, registered } : null,
      logins7d: { success: logins, failed },
      recent: recent.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, actor: names.get(r.actorUserId ?? '') ?? 'ระบบ', at: r.at.toISOString() })),
    };
  }

  private async userNames(ids: (string | null)[]) {
    const list = [...new Set(ids.filter((x): x is string => !!x))];
    const users = list.length ? await this.prisma.user.findMany({ where: { id: { in: list } }, select: { id: true, displayName: true } }) : [];
    return new Map(users.map((u) => [u.id, u.displayName]));
  }

  // ---------------- ผู้ใช้ ----------------
  /** staff = ครู/เจ้าหน้าที่เท่านั้น (บัญชีนักเรียนมีหลายพันบัญชี ดูที่หน้านักเรียนแทน) */
  async listUsers(q: { q?: string; role?: Role; status?: 'ACTIVE' | 'SUSPENDED'; staff?: '1'; page: number }) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      AND: [
        ...(q.role ? [{ roles: { some: { role: q.role } } }] : []),
        ...(q.staff ? [{ roles: { none: { role: 'STUDENT' as Role } } }] : []),
      ],
      ...(q.status ? { status: q.status } : {}),
      ...(q.q?.trim() ? { OR: [{ username: { contains: q.q.trim(), mode: 'insensitive' } }, { displayName: { contains: q.q.trim(), mode: 'insensitive' } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where, orderBy: [{ status: 'asc' }, { username: 'asc' }], skip: q.page * PAGE, take: PAGE,
        include: { roles: true, positions: { select: { key: true } }, headOf: { select: { name: true, level: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      total, pageSize: PAGE,
      items: rows.map((u) => ({
        id: u.id, username: u.username, displayName: u.displayName, status: u.status, roles: u.roles.map((r) => r.role),
        positions: u.positions.map((p) => p.key), headOf: u.headOf.map((p) => p.name),
        mustChangePassword: u.mustChangePassword, lockedUntil: iso(u.lockedUntil), lastLoginAt: iso(u.lastLoginAt), createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  /** รายชื่อสั้น ๆ สำหรับช่องเลือกคน (ครู/เจ้าหน้าที่ที่ใช้งานอยู่) */
  async staffOptions() {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { not: 'STUDENT' } } } },
      orderBy: { displayName: 'asc' }, select: { id: true, displayName: true, username: true },
    });
    return rows;
  }

  private assertCanGrant(actor: AuthUser, roles: readonly Role[]) {
    if (roles.some((r) => PRIVILEGED.includes(r)) && !isSuper(actor)) throw new ForbiddenException('ให้สิทธิ์ผู้ดูแลระบบได้เฉพาะ SUPER_ADMIN');
  }

  /** แอดมินตั้งรหัสผ่านให้เอง (แบบระบบรับสมัคร) — ไม่ต้องบังคับเปลี่ยน เว้นแต่เลือกไว้ */
  async createUser(actor: AuthUser, input: { username: string; displayName: string; roles: Role[]; password: string; mustChangePassword: boolean }, ip: string) {
    if (input.roles.includes('STUDENT')) throw new BadRequestException('บัญชีนักเรียนเพิ่มที่เมนูนักเรียน (ต้องมีข้อมูลทะเบียน)');
    this.assertCanGrant(actor, input.roles);
    const password = input.password;
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { username: input.username, displayName: input.displayName, passwordHash: await hashPassword(password), mustChangePassword: input.mustChangePassword, roles: { create: input.roles.map((role) => ({ role })) } },
        });
        await this.audit.log({ actorUserId: actor.id, action: 'user.create', entity: 'user', entityId: u.id, after: { username: u.username, displayName: u.displayName, roles: input.roles }, ip }, tx);
        return u;
      });
      return { id: user.id, username: user.username };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException({ message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว', fields: { username: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' } });
      throw e;
    }
  }

  async updateUser(actor: AuthUser, id: string, input: { displayName?: string; roles?: Role[]; status?: 'ACTIVE' | 'SUSPENDED' }, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
    if (!user || user.deletedAt) throw new NotFoundException('ไม่พบผู้ใช้');
    const before = { displayName: user.displayName, status: user.status, roles: user.roles.map((r) => r.role as Role) };
    // แก้บัญชีผู้ดูแลระบบได้เฉพาะ SUPER_ADMIN
    if (before.roles.some((r) => PRIVILEGED.includes(r)) && !isSuper(actor)) throw new ForbiddenException('แก้ไขบัญชีผู้ดูแลระบบได้เฉพาะ SUPER_ADMIN');
    if (id === actor.id && input.status === 'SUSPENDED') throw new BadRequestException('ระงับบัญชีตัวเองไม่ได้');
    if (input.roles) {
      if (before.roles.includes('STUDENT') !== input.roles.includes('STUDENT')) throw new BadRequestException('เปลี่ยนบัญชีนักเรียนเป็นเจ้าหน้าที่ (หรือกลับกัน) ไม่ได้');
      this.assertCanGrant(actor, input.roles.filter((r) => !before.roles.includes(r)));
      if (id === actor.id && before.roles.includes('SUPER_ADMIN') && !input.roles.includes('SUPER_ADMIN')) throw new BadRequestException('ถอดสิทธิ์ SUPER_ADMIN ของตัวเองไม่ได้');
    }
    const losingSuper = before.roles.includes('SUPER_ADMIN') && ((input.roles && !input.roles.includes('SUPER_ADMIN')) || input.status === 'SUSPENDED');
    await this.prisma.$transaction(async (tx) => {
      if (losingSuper) {
        const supers = await tx.user.count({ where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: 'SUPER_ADMIN' } } } });
        if (supers <= 1) throw new BadRequestException('ต้องมี SUPER_ADMIN ที่ใช้งานได้อย่างน้อย 1 คน');
      }
      await tx.user.update({
        where: { id },
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.roles ? { roles: { deleteMany: {}, create: input.roles.map((role) => ({ role })) } } : {}),
        },
      });
      // ระงับหรือเปลี่ยนสิทธิ์ → ออกจากระบบทุกเครื่อง (สิทธิ์ใหม่มีผลทันที)
      if (input.status === 'SUSPENDED' || input.roles) await tx.session.deleteMany({ where: { userId: id } });
      await this.audit.log({ actorUserId: actor.id, action: 'user.update', entity: 'user', entityId: id, before, after: input, ip }, tx);
    });
  }

  /** ตั้งรหัสใหม่: password ว่าง + เป็นนักเรียน = กลับเป็นวันเกิด, เจ้าหน้าที่ต้องกำหนดรหัสเสมอ */
  async resetPassword(actor: AuthUser, id: string, input: { password: string; mustChangePassword: boolean }, ip: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { roles: true, student: true } });
    if (!user || user.deletedAt) throw new NotFoundException('ไม่พบผู้ใช้');
    if (user.roles.some((r) => PRIVILEGED.includes(r.role as Role)) && !isSuper(actor)) throw new ForbiddenException('รีเซ็ตรหัสผู้ดูแลระบบได้เฉพาะ SUPER_ADMIN');
    const birth = user.student?.birthDate ? dateOnly(user.student.birthDate)! : null;
    const useBirth = !input.password && !!birth;
    if (!input.password && !birth) throw new BadRequestException({ message: 'กำหนดรหัสผ่านใหม่', fields: { password: 'กำหนดรหัสผ่านใหม่' } });
    if (input.password) {
      const problem = passwordProblem(input.password);
      if (problem) throw new BadRequestException({ message: problem, fields: { password: problem } });
    }
    const password = useBirth ? defaultStudentPassword(birth!) : input.password;
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: input.mustChangePassword, failedLogins: 0, lockedUntil: null } });
      await tx.session.deleteMany({ where: { userId: id } });
      await this.audit.log({ actorUserId: actor.id, action: 'user.reset_password', entity: 'user', entityId: id, ip }, tx);
    });
    return { isBirthDate: useBirth, password: useBirth ? password : null };
  }

  async unlock(actor: AuthUser, id: string, ip: string) {
    await this.prisma.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
    await this.audit.log({ actorUserId: actor.id, action: 'user.unlock', entity: 'user', entityId: id, ip });
  }

  async loginLogs(q: { userId?: string; failedOnly?: boolean; page: number }) {
    const where: Prisma.LoginLogWhereInput = { ...(q.userId ? { userId: q.userId } : {}), ...(q.failedOnly ? { success: false } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.loginLog.findMany({ where, orderBy: { at: 'desc' }, skip: q.page * PAGE, take: PAGE }),
      this.prisma.loginLog.count({ where }),
    ]);
    return { total, pageSize: PAGE, items: rows.map((r) => ({ id: r.id, username: r.username, success: r.success, reason: r.reason, ip: r.ip, at: r.at.toISOString() })) };
  }

  // ---------------- ตำแหน่งผู้ลงนาม / หัวหน้าสาขา ----------------
  async positions() {
    const rows = await this.prisma.position.findMany({ include: { user: { select: { id: true, displayName: true } } } });
    const order = Object.keys(POSITIONS);
    return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((p) => ({ key: p.key, title: p.title, holderName: p.holderName, userId: p.userId, userName: p.user?.displayName ?? null }));
  }

  async updatePosition(actor: AuthUser, key: string, input: { userId: string | null; holderName: string }, ip: string) {
    const before = await this.prisma.position.findUnique({ where: { key } });
    if (!before) throw new NotFoundException('ไม่พบตำแหน่ง');
    if (input.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: input.userId }, include: { roles: true } });
      if (!u || u.deletedAt || u.status !== 'ACTIVE' || u.roles.every((r) => r.role === 'STUDENT')) throw new BadRequestException('เลือกได้เฉพาะบัญชีครู/เจ้าหน้าที่ที่ใช้งานอยู่');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.position.update({ where: { key }, data: { userId: input.userId, holderName: input.holderName } });
      // ผู้ดำรงตำแหน่งเปลี่ยน → เซสชันเดิมของทั้งสองคนต้องโหลดสิทธิ์ใหม่
      await tx.session.deleteMany({ where: { userId: { in: [before.userId, input.userId].filter((x): x is string => !!x) } } });
      await this.audit.log({ actorUserId: actor.id, action: 'position.update', entity: 'position', entityId: key, before: { userId: before.userId, holderName: before.holderName }, after: input, ip }, tx);
    });
  }

  async programs() {
    const rows = await this.prisma.program.findMany({
      orderBy: [{ department: { name: 'asc' } }, { level: 'asc' }, { name: 'asc' }],
      include: { department: true, head: { select: { id: true, displayName: true } }, _count: { select: { students: true } } },
    });
    return rows.map((p) => ({ id: p.id, name: p.name, level: p.level, department: p.department.name, headUserId: p.headUserId, headName: p.head?.displayName ?? null, students: p._count.students }));
  }

  async setProgramHead(actor: AuthUser, id: string, headUserId: string | null, ip: string) {
    const before = await this.prisma.program.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('ไม่พบสาขา');
    await this.prisma.program.update({ where: { id }, data: { headUserId } });
    await this.audit.log({ actorUserId: actor.id, action: 'program.set_head', entity: 'program', entityId: id, before: { headUserId: before.headUserId }, after: { headUserId }, ip });
  }

  // ---------------- นักเรียน ----------------
  async listStudents(q: { q?: string; programId?: string; status?: string; yearLevel?: number; page: number }) {
    const term = q.q?.trim();
    const where: Prisma.StudentWhereInput = {
      deletedAt: null,
      ...(q.programId ? { programId: q.programId } : {}),
      ...(q.status ? { status: q.status as Prisma.StudentWhereInput['status'] } : {}),
      ...(q.yearLevel ? { yearLevel: q.yearLevel } : {}),
      ...(term ? { OR: [{ studentCode: { contains: term } }, { firstName: { contains: term } }, { lastName: { contains: term } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.student.findMany({ where, orderBy: { studentCode: 'asc' }, skip: q.page * PAGE, take: PAGE, include: { program: { include: { department: true } }, advisor: { select: { displayName: true } }, user: { select: { status: true } } } }),
      this.prisma.student.count({ where }),
    ]);
    return {
      total, pageSize: PAGE,
      items: rows.map((s) => ({
        id: s.id, userId: s.userId, studentCode: s.studentCode, name: `${s.prefix}${s.firstName} ${s.lastName}`, level: s.program.level, program: s.program.name,
        department: s.program.department.name, yearLevel: s.yearLevel, groupNo: s.groupNo, status: s.status, advisor: s.advisor?.displayName ?? '', accountStatus: s.user.status,
      })),
    };
  }

  async getStudent(id: string) {
    const s = await this.prisma.student.findUnique({ where: { id }, include: { guardians: true, addresses: true } });
    if (!s || s.deletedAt) throw new NotFoundException('ไม่พบนักเรียน');
    return {
      id: s.id, userId: s.userId, studentCode: s.studentCode, prefix: s.prefix, firstName: s.firstName, lastName: s.lastName, birthDate: dateOnly(s.birthDate),
      programId: s.programId, yearLevel: s.yearLevel, groupNo: s.groupNo, status: s.status, advisorUserId: s.advisorUserId, curriculumId: s.curriculumId,
      phone: s.phone, email: s.email, fatherName: s.fatherName, motherName: s.motherName, nickname: s.nickname, nationalId: s.nationalId,
    };
  }

  async saveStudent(actor: AuthUser, id: string | null, input: StudentInput, ip: string) {
    const program = await this.prisma.program.findUnique({ where: { id: input.programId } });
    if (!program) throw new BadRequestException({ message: 'ไม่พบสาขา', fields: { programId: 'เลือกสาขา' } });
    if (input.advisorUserId) {
      const adv = await this.prisma.user.findUnique({ where: { id: input.advisorUserId }, include: { roles: true } });
      if (!adv || adv.roles.every((r) => r.role === 'STUDENT')) throw new BadRequestException({ message: 'ครูที่ปรึกษาไม่ถูกต้อง', fields: { advisorUserId: 'เลือกครูที่ปรึกษา' } });
    }
    const curriculum = await this.prisma.curriculum.findFirst({ where: { programId: input.programId }, orderBy: { year: 'desc' } });
    const data = {
      prefix: input.prefix, firstName: input.firstName, lastName: input.lastName, birthDate: input.birthDate ? new Date(`${input.birthDate}T00:00:00Z`) : null,
      programId: input.programId, yearLevel: input.yearLevel, groupNo: input.groupNo, status: input.status, advisorUserId: input.advisorUserId,
      phone: input.phone, email: input.email, fatherName: input.fatherName, motherName: input.motherName, nickname: input.nickname, nationalId: input.nationalId,
    };
    const displayName = `${input.prefix}${input.firstName} ${input.lastName}`;
    try {
      if (!id) {
        if (!input.birthDate) throw new BadRequestException({ message: 'ต้องมีวันเกิด (ใช้เป็นรหัสผ่านเริ่มต้น)', fields: { birthDate: 'กรอกวันเกิด' } });
        const created = await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { username: input.studentCode, displayName, passwordHash: await hashPassword(defaultStudentPassword(input.birthDate!)), mustChangePassword: true, roles: { create: [{ role: 'STUDENT' }] } } });
          const s = await tx.student.create({ data: { ...data, studentCode: input.studentCode, userId: user.id, curriculumId: curriculum?.id ?? null } });
          await this.audit.log({ actorUserId: actor.id, action: 'student.create', entity: 'student', entityId: s.id, after: { ...input, nationalId: input.nationalId ? '***' : '' }, ip }, tx);
          return s;
        });
        return { id: created.id, password: defaultStudentPassword(input.birthDate) };
      }
      const before = await this.getStudent(id);
      await this.prisma.$transaction(async (tx) => {
        await tx.student.update({ where: { id }, data: { ...data, ...(before.programId !== input.programId ? { curriculumId: curriculum?.id ?? null } : {}) } });
        await tx.user.update({ where: { id: before.userId }, data: { displayName } });
        const mask = (v: Record<string, unknown>) => ({ ...v, nationalId: v.nationalId ? '***' : '' });
        await this.audit.log({ actorUserId: actor.id, action: 'student.update', entity: 'student', entityId: id, before: mask(before), after: mask({ ...input }), ip }, tx);
      });
      return { id };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException({ message: 'รหัสนักศึกษานี้มีอยู่แล้ว', fields: { studentCode: 'รหัสนักศึกษานี้มีอยู่แล้ว' } });
      throw e;
    }
  }

  // ---------------- Audit ----------------
  async auditLogs(q: { entity?: string; action?: string; page: number }) {
    const where: Prisma.AuditLogWhereInput = { ...(q.entity ? { entity: q.entity } : {}), ...(q.action ? { action: { startsWith: q.action } } : {}) };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({ where, orderBy: { at: 'desc' }, skip: q.page * PAGE, take: PAGE }),
      this.prisma.auditLog.count({ where }),
    ]);
    const names = await this.userNames(rows.map((r) => r.actorUserId));
    return {
      total, pageSize: PAGE,
      items: rows.map((r) => ({ id: r.id, action: r.action, entity: r.entity, entityId: r.entityId, actor: names.get(r.actorUserId ?? '') ?? 'ระบบ', ip: r.ip, at: r.at.toISOString(), before: r.before, after: r.after })),
    };
  }
}

export interface StudentInput {
  studentCode: string; prefix: string; firstName: string; lastName: string; birthDate: string | null; programId: string; yearLevel: number; groupNo: string;
  status: 'studying' | 'on_leave' | 'graduated' | 'resigned' | 'dismissed'; advisorUserId: string | null;
  phone: string; email: string; fatherName: string; motherName: string; nickname: string; nationalId: string;
}

export const ALL_ROLES = ROLES;
