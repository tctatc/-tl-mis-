import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

type Kind = 'teacher' | 'support';
type WorkStatus = 'active' | 'on_leave' | 'transferred' | 'retired' | 'resigned';
export interface StaffQuery { q?: string; departmentId?: string; programId?: string; kind?: Kind; workStatus?: WorkStatus; none?: '1'; page: number }
export interface ProfileInput {
  staffCode: string | null; prefix: string; firstName: string; lastName: string; kind: Kind; positionTitle: string; employment: string;
  departmentId: string | null; programId: string | null; workStatus: WorkStatus; phone: string; email: string;
}

const PAGE = 30;
/** ครูและบุคลากร = บัญชีที่ไม่ใช่นักเรียน หรือมีโปรไฟล์บุคลากร */
const STAFF: Prisma.UserWhereInput = { deletedAt: null, OR: [{ staffProfile: { isNot: null } }, { roles: { some: { role: { not: 'STUDENT' } } }, student: { is: null } }] };
const fullName = (p: { prefix: string; firstName: string; lastName: string }) => `${p.prefix}${p.firstName} ${p.lastName}`.trim();

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async dashboard() {
    const [total, profiles, departments, programs] = await Promise.all([
      this.prisma.user.count({ where: STAFF }),
      this.prisma.staffProfile.findMany({ where: { user: { deletedAt: null } }, select: { kind: true, workStatus: true, employment: true, departmentId: true, programId: true } }),
      this.prisma.department.findMany({ select: { id: true, name: true } }),
      this.prisma.program.findMany({ select: { id: true, name: true, level: true, departmentId: true } }),
    ]);
    const active = profiles.filter((p) => p.workStatus === 'active');
    const count = <K extends string>(list: typeof profiles, key: (p: (typeof profiles)[number]) => K | null) => {
      const m = new Map<K, number>();
      for (const p of list) { const k = key(p); if (k !== null) m.set(k, (m.get(k) ?? 0) + 1); }
      return m;
    };
    const byDept = count(active, (p) => p.departmentId ?? '');
    const byProg = count(active, (p) => p.programId);
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    return {
      total,
      withProfile: profiles.length,
      noProfile: total - profiles.length,
      kind: Object.fromEntries(count(active, (p) => p.kind)) as Partial<Record<Kind, number>>,
      workStatus: Object.fromEntries(count(profiles, (p) => p.workStatus)) as Partial<Record<WorkStatus, number>>,
      byDepartment: [...byDept].map(([id, n]) => ({ id: id || null, name: id ? deptName.get(id) ?? '–' : 'ไม่ระบุแผนก', count: n })).sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1) || b.count - a.count),
      byProgram: programs.filter((p) => byProg.has(p.id)).map((p) => ({ id: p.id, name: p.name, level: p.level, department: deptName.get(p.departmentId) ?? '', count: byProg.get(p.id)! })).sort((a, b) => b.count - a.count),
      byEmployment: [...count(active, (p) => p.employment.trim() || 'ไม่ระบุ')].map(([name, n]) => ({ name, count: n })).sort((a, b) => b.count - a.count),
    };
  }

  async list(q: StaffQuery) {
    const term = q.q?.trim();
    const profile: Prisma.StaffProfileWhereInput = {
      ...(q.departmentId ? { departmentId: q.departmentId } : {}),
      ...(q.programId ? { programId: q.programId } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.workStatus ? { workStatus: q.workStatus } : {}),
    };
    const hasProfileFilter = Object.keys(profile).length > 0;
    const where: Prisma.UserWhereInput = {
      AND: [
        STAFF,
        ...(q.none ? [{ staffProfile: { is: null } }] : hasProfileFilter ? [{ staffProfile: { is: profile } }] : []),
        ...(term ? [{ OR: [
          { displayName: { contains: term, mode: 'insensitive' as const } },
          { username: { contains: term, mode: 'insensitive' as const } },
          { staffProfile: { is: { OR: [{ staffCode: { contains: term, mode: 'insensitive' as const } }, { positionTitle: { contains: term } }] } } },
        ] }] : []),
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where, orderBy: { displayName: 'asc' }, skip: q.page * PAGE, take: PAGE,
        select: { id: true, username: true, displayName: true, status: true, roles: { select: { role: true } },
          staffProfile: { include: { department: { select: { name: true } }, program: { select: { name: true, level: true } } } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      total, pageSize: PAGE,
      items: rows.map((u) => ({
        id: u.id, username: u.username, name: u.staffProfile ? fullName(u.staffProfile) : u.displayName, accountStatus: u.status,
        roles: u.roles.map((r) => r.role), staffCode: u.staffProfile?.staffCode ?? null, hasProfile: !!u.staffProfile,
        kind: u.staffProfile?.kind ?? null, positionTitle: u.staffProfile?.positionTitle ?? '', workStatus: u.staffProfile?.workStatus ?? null,
        department: u.staffProfile?.department?.name ?? '', program: u.staffProfile?.program ? u.staffProfile.program.name : '',
      })),
    };
  }

  async detail(userId: string) {
    const u = await this.prisma.user.findFirst({
      where: { id: userId, ...STAFF },
      select: { id: true, username: true, displayName: true, status: true, lastLoginAt: true, roles: { select: { role: true } }, staffProfile: true,
        _count: { select: { advisees: true } } },
    });
    if (!u) throw new NotFoundException('ไม่พบบุคลากร');
    const term = await this.prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    const sections = term ? await this.prisma.courseSection.findMany({
      where: { termId: term.id, teacherUserId: userId }, orderBy: { subject: { code: 'asc' } },
      select: { id: true, groupCode: true, subject: { select: { code: true, name: true } } },
    }) : [];
    return {
      id: u.id, username: u.username, displayName: u.displayName, accountStatus: u.status, lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      roles: u.roles.map((r) => r.role), advisees: u._count.advisees, profile: u.staffProfile,
      teaching: { term: term ? `${term.term}/${term.year}` : null, sections: sections.map((s) => ({ id: s.id, code: s.subject.code, name: s.subject.name, group: s.groupCode })) },
    };
  }

  async save(actor: AuthUser, userId: string, input: ProfileInput, ip: string) {
    const before = await this.prisma.staffProfile.findUnique({ where: { userId } });
    const user = await this.prisma.user.findFirst({ where: { id: userId, ...STAFF }, select: { id: true } });
    if (!user) throw new NotFoundException('ไม่พบบุคลากร');
    if (input.programId && !input.departmentId) {
      input.departmentId = (await this.prisma.program.findUnique({ where: { id: input.programId }, select: { departmentId: true } }))?.departmentId ?? null;
    }
    const after = await this.prisma.$transaction(async (tx) => {
      if (input.staffCode) {
        const clash = await tx.staffProfile.findUnique({ where: { staffCode: input.staffCode }, select: { userId: true } });
        if (clash && clash.userId !== userId) throw new ConflictException({ message: 'รหัสบุคลากรนี้มีคนใช้แล้ว', fields: { staffCode: 'รหัสบุคลากรนี้มีคนใช้แล้ว' } });
      }
      const saved = await tx.staffProfile.upsert({ where: { userId }, create: { userId, ...input }, update: input });
      await tx.user.update({ where: { id: userId }, data: { displayName: fullName(input) } });
      await this.audit.log({ actorUserId: actor.id, action: before ? 'staff.update' : 'staff.create', entity: 'user', entityId: userId, before: before ?? undefined, after: saved, ip }, tx);
      return saved;
    });
    return after;
  }
}
