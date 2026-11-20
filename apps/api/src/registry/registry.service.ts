import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LEVEL_LABEL, canPromote, defaultGroupCode, entryYearFromCode, finalYear, graduationCheck, termOrder,
  type ClassGroupRow, type Level,
} from '@csis/shared';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService, type Tx } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

const ACTIVE_STATUSES = ['studying', 'on_leave'] as const;
type PromotionItem = { classGroupId: string; from: number; to: number; studentIds: string[] };

/** งานทะเบียน: กลุ่มเรียน · เลื่อนชั้น · ตรวจ/อนุมัติสำเร็จการศึกษา (ตามเมนูของ ศธ.02) */
@Injectable()
export class RegistryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ---------------- กลุ่มเรียน ----------------

  /** หา/สร้างกลุ่มเรียนของ (สาขา, รุ่น, ห้อง) — ใช้ตอนนำเข้านักเรียนและตอนยกข้อมูลเดิม */
  async ensureGroup(tx: Tx, g: { programId: string; entryYear: number; groupNo: string; yearLevel: number; studentCodes: string[] }) {
    const found = await tx.classGroup.findUnique({ where: { programId_entryYear_groupNo: { programId: g.programId, entryYear: g.entryYear, groupNo: g.groupNo } } });
    if (found) return found;
    const base = defaultGroupCode(g.studentCodes, g.groupNo) ?? `${String(g.entryYear).slice(2)}0000${g.groupNo.replace(/\D/g, '').slice(-2).padStart(2, '0')}`;
    // รหัสชนกับกลุ่มอื่น (ข้อมูลเดิมไม่สม่ำเสมอ) → ต่อท้าย -2, -3 ให้งานทะเบียนแก้ทีหลัง
    let code = base;
    for (let n = 2; await tx.classGroup.findUnique({ where: { code } }); n++) code = `${base}-${n}`;
    return tx.classGroup.create({ data: { code, programId: g.programId, entryYear: g.entryYear, groupNo: g.groupNo, yearLevel: g.yearLevel } });
  }

  /** จัดนักเรียนที่ยังไม่มีกลุ่มเข้ากลุ่ม (รันซ้ำได้) — dryRun = รายงานอย่างเดียว */
  async backfill(actor: AuthUser | null, dryRun: boolean) {
    const students = await this.prisma.student.findMany({ where: { classGroupId: null, deletedAt: null }, select: { id: true, studentCode: true, programId: true, entryYear: true, groupNo: true, yearLevel: true } });
    const buckets = new Map<string, typeof students>();
    for (const s of students) {
      const entry = s.entryYear ?? entryYearFromCode(s.studentCode);
      if (!entry) continue;
      const k = `${s.programId}|${entry}|${s.groupNo}`;
      buckets.set(k, [...(buckets.get(k) ?? []), s]);
    }
    const plan = [...buckets.entries()].map(([k, list]) => {
      const [programId, entryYear, groupNo] = k.split('|') as [string, string, string];
      const levels = new Map<number, number>();
      for (const s of list) levels.set(s.yearLevel, (levels.get(s.yearLevel) ?? 0) + 1);
      const yearLevel = [...levels.entries()].sort((a, b) => b[1] - a[1])[0]![0];
      return { programId, entryYear: Number(entryYear), groupNo, yearLevel, studentCodes: list.map((s) => s.studentCode), ids: list.map((s) => s.id), mixedLevels: levels.size > 1 };
    });
    const skipped = students.length - plan.reduce((n, p) => n + p.ids.length, 0);
    if (dryRun) return { groups: plan.length, students: students.length - skipped, skipped, preview: plan.map((p) => ({ code: defaultGroupCode(p.studentCodes, p.groupNo), entryYear: p.entryYear, groupNo: p.groupNo, yearLevel: p.yearLevel, students: p.ids.length, mixedLevels: p.mixedLevels })) };
    const created: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const p of plan) {
        const g = await this.ensureGroup(tx, p);
        created.push(g.code);
        await tx.student.updateMany({ where: { id: { in: p.ids } }, data: { classGroupId: g.id } });
      }
      await this.audit.log({ actorUserId: actor?.id ?? null, action: 'group.backfill', entity: 'class_group', entityId: 'all', after: { groups: created.length, codes: created.slice(0, 50) } }, tx);
    });
    return { groups: created.length, students: students.length - skipped, skipped, codes: created };
  }

  async groups(q: { programId?: string; active?: boolean; search?: string }): Promise<ClassGroupRow[]> {
    const rows = await this.prisma.classGroup.findMany({
      where: { ...(q.programId ? { programId: q.programId } : {}), ...(q.active === undefined ? {} : { active: q.active }), ...(q.search ? { OR: [{ code: { contains: q.search } }, { groupNo: { contains: q.search } }, { program: { name: { contains: q.search } } }] } : {}) },
      include: { program: true, students: { where: { deletedAt: null, status: { in: [...ACTIVE_STATUSES] } }, select: { advisor: { select: { displayName: true } } } } },
      orderBy: [{ entryYear: 'desc' }, { code: 'asc' }],
    });
    return rows.map((g) => {
      const advisors = [...new Set(g.students.map((s) => s.advisor?.displayName).filter(Boolean))] as string[];
      return { id: g.id, code: g.code, programId: g.programId, program: g.program.name, level: g.program.level as Level, entryYear: g.entryYear, groupNo: g.groupNo, yearLevel: g.yearLevel, active: g.active, students: g.students.length, advisor: advisors.join(', ') };
    });
  }

  async groupStudents(id: string) {
    const g = await this.prisma.classGroup.findUnique({ where: { id }, include: { program: true } });
    if (!g) throw new NotFoundException('ไม่พบกลุ่มเรียน');
    const students = await this.prisma.student.findMany({ where: { classGroupId: id, deletedAt: null }, orderBy: { studentCode: 'asc' }, select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, status: true, yearLevel: true } });
    return { group: { id: g.id, code: g.code, label: `${LEVEL_LABEL[g.program.level as Level]} ${g.program.name} ปี ${g.yearLevel} ห้อง ${g.groupNo}` }, students: students.map((s) => ({ id: s.id, studentCode: s.studentCode, name: `${s.prefix}${s.firstName} ${s.lastName}`, status: s.status })) };
  }

  /** แก้รหัสกลุ่ม / ชื่อห้อง / ปิด-เปิดใช้งาน — ชื่อห้องเปลี่ยน → นักเรียนในกลุ่มเปลี่ยนตาม */
  async updateGroup(actor: AuthUser, id: string, input: { code?: string; groupNo?: string; active?: boolean }, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.classGroup.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('ไม่พบกลุ่มเรียน');
      if (input.code && input.code !== before.code && (await tx.classGroup.findUnique({ where: { code: input.code } }))) throw new ConflictException(`รหัสกลุ่ม ${input.code} มีอยู่แล้ว`);
      if (input.active === false) {
        const n = await tx.student.count({ where: { classGroupId: id, deletedAt: null, status: { in: [...ACTIVE_STATUSES] } } });
        if (n > 0) throw new ConflictException(`ยังมีนักเรียนที่กำลังศึกษาในกลุ่มนี้ ${n} คน — ปิดได้เมื่อไม่มีนักเรียนแล้ว`);
      }
      const g = await tx.classGroup.update({ where: { id }, data: input });
      if (input.groupNo && input.groupNo !== before.groupNo) await tx.student.updateMany({ where: { classGroupId: id }, data: { groupNo: input.groupNo } });
      await this.audit.log({ actorUserId: actor.id, action: 'group.update', entity: 'class_group', entityId: id, before: { code: before.code, groupNo: before.groupNo, active: before.active }, after: input, ip }, tx);
      return { id: g.id, code: g.code };
    });
  }

  async createGroup(actor: AuthUser, input: { code: string; programId: string; entryYear: number; groupNo: string; yearLevel: number }, ip: string) {
    try {
      const g = await this.prisma.classGroup.create({ data: input });
      await this.audit.log({ actorUserId: actor.id, action: 'group.create', entity: 'class_group', entityId: g.id, after: input, ip });
      return { id: g.id };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('มีกลุ่มเรียนนี้แล้ว (รหัสซ้ำ หรือ สาขา+รุ่น+ห้อง ซ้ำ)');
      throw e;
    }
  }

  // ---------------- เลื่อนชั้น ----------------

  /** ตัวอย่างก่อนเลื่อนชั้น: กลุ่มที่เปิดใช้งาน พร้อมบอกว่าเลื่อนได้หรือเป็นปีสุดท้าย */
  async promotionPreview() {
    const groups = await this.groups({ active: true });
    return groups.map((g) => ({ ...g, nextYear: canPromote(g.level, g.yearLevel) ? g.yearLevel + 1 : null, finalYear: finalYear(g.level) }));
  }

  async promote(actor: AuthUser, groupIds: string[], academicYear: number, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const groups = await tx.classGroup.findMany({ where: { id: { in: groupIds }, active: true }, include: { program: true } });
      if (groups.length !== groupIds.length) throw new BadRequestException('มีกลุ่มเรียนที่ไม่พบหรือปิดใช้งานแล้ว — โหลดหน้าใหม่');
      const items: PromotionItem[] = [];
      for (const g of groups) {
        if (!canPromote(g.program.level as Level, g.yearLevel)) throw new BadRequestException(`กลุ่ม ${g.code} อยู่ปีสุดท้ายแล้ว — ใช้เมนูสำเร็จการศึกษาแทน`);
        const to = g.yearLevel + 1;
        // ล็อกแบบมีเงื่อนไข: กันเลื่อนซ้ำจากการกดสองครั้ง
        const upd = await tx.classGroup.updateMany({ where: { id: g.id, yearLevel: g.yearLevel }, data: { yearLevel: to } });
        if (upd.count === 0) throw new ConflictException(`กลุ่ม ${g.code} ถูกเลื่อนไปแล้ว — โหลดหน้าใหม่`);
        const students = await tx.student.findMany({ where: { classGroupId: g.id, deletedAt: null, status: { in: [...ACTIVE_STATUSES] } }, select: { id: true } });
        await tx.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { yearLevel: to } });
        items.push({ classGroupId: g.id, from: g.yearLevel, to, studentIds: students.map((s) => s.id) });
      }
      const batch = await tx.promotionBatch.create({ data: { academicYear, byId: actor.id, items: items as unknown as Prisma.InputJsonValue } });
      await this.audit.log({ actorUserId: actor.id, action: 'group.promote', entity: 'promotion', entityId: batch.id, after: { academicYear, groups: items.length, students: items.reduce((n, i) => n + i.studentIds.length, 0) }, ip }, tx);
      return { batchId: batch.id, groups: items.length, students: items.reduce((n, i) => n + i.studentIds.length, 0) };
    });
  }

  async promotionHistory() {
    const rows = await this.prisma.promotionBatch.findMany({ orderBy: { at: 'desc' }, take: 20 });
    const names = new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.flatMap((r) => [r.byId, r.undoneById].filter(Boolean) as string[]))] } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
    return rows.map((r) => {
      const items = r.items as unknown as PromotionItem[];
      return { id: r.id, academicYear: r.academicYear, at: r.at.toISOString(), by: names.get(r.byId) ?? '', groups: items.length, students: items.reduce((n, i) => n + i.studentIds.length, 0), undoneAt: r.undoneAt?.toISOString() ?? null, undoneBy: r.undoneById ? names.get(r.undoneById) ?? '' : null };
    });
  }

  /** ยกเลิกการเลื่อนชั้น — ได้เฉพาะกลุ่มที่ยังอยู่ชั้นปีที่เลื่อนไป (ยังไม่ถูกเลื่อนต่อ) */
  async undoPromotion(actor: AuthUser, batchId: string, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.promotionBatch.findUnique({ where: { id: batchId } });
      if (!b) throw new NotFoundException('ไม่พบรายการเลื่อนชั้น');
      if (b.undoneAt) throw new ConflictException('รายการนี้ยกเลิกไปแล้ว');
      const items = b.items as unknown as PromotionItem[];
      for (const it of items) {
        const upd = await tx.classGroup.updateMany({ where: { id: it.classGroupId, yearLevel: it.to }, data: { yearLevel: it.from } });
        if (upd.count === 0) throw new ConflictException('มีกลุ่มที่ถูกเลื่อนชั้นต่อไปแล้ว ยกเลิกรายการนี้ไม่ได้ — ยกเลิกรายการที่ใหม่กว่าก่อน');
        await tx.student.updateMany({ where: { id: { in: it.studentIds }, yearLevel: it.to }, data: { yearLevel: it.from } });
      }
      await tx.promotionBatch.update({ where: { id: batchId }, data: { undoneAt: new Date(), undoneById: actor.id } });
      await this.audit.log({ actorUserId: actor.id, action: 'group.promote_undo', entity: 'promotion', entityId: batchId, ip }, tx);
      return { ok: true };
    });
  }

  // ---------------- สำเร็จการศึกษา ----------------

  /** กลุ่มปีสุดท้าย: ตรวจเบื้องต้นรายคน */
  async graduationCandidates(groupId: string) {
    const g = await this.prisma.classGroup.findUnique({ where: { id: groupId }, include: { program: true } });
    if (!g) throw new NotFoundException('ไม่พบกลุ่มเรียน');
    const students = await this.prisma.student.findMany({
      where: { classGroupId: groupId, deletedAt: null, status: { in: ['studying', 'on_leave', 'graduated'] } },
      orderBy: { studentCode: 'asc' },
      include: {
        curriculum: { include: { items: { include: { subject: { select: { code: true, credits: true } } } } } },
        grades: { where: { status: 'published' }, include: { section: { include: { subject: true, term: true } } } },
      },
    });
    return {
      group: { id: g.id, code: g.code, label: `${LEVEL_LABEL[g.program.level as Level]} ${g.program.name} ปี ${g.yearLevel} ห้อง ${g.groupNo}`, isFinalYear: g.yearLevel >= finalYear(g.program.level as Level) },
      students: students.map((s) => {
        const check = graduationCheck({
          plan: s.curriculum?.items.map((i) => ({ code: i.subject.code, credits: i.subject.credits })) ?? [],
          courses: s.grades.map((r) => ({ code: r.section.subject.code, credits: r.section.subject.credits, grade: r.grade, termOrder: termOrder(r.section.term.year, r.section.term.term) })),
          minCredits: s.curriculum?.minCredits ?? 0,
        });
        return {
          id: s.id, studentCode: s.studentCode, name: `${s.prefix}${s.firstName} ${s.lastName}`, status: s.status,
          graduationDate: s.graduationDate?.toISOString().slice(0, 10) ?? null,
          hasCurriculum: !!s.curriculum, ...check,
        };
      }),
    };
  }

  async approveGraduation(actor: AuthUser, studentIds: string[], date: string, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.student.updateMany({ where: { id: { in: studentIds }, status: { in: [...ACTIVE_STATUSES] }, deletedAt: null }, data: { status: 'graduated', graduationDate: new Date(date) } });
      await this.audit.log({ actorUserId: actor.id, action: 'student.graduate', entity: 'student', entityId: studentIds.length === 1 ? studentIds[0]! : 'many', after: { studentIds, date, count }, ip }, tx);
      return { graduated: count };
    });
  }

  async undoGraduation(actor: AuthUser, studentId: string, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.student.updateMany({ where: { id: studentId, status: 'graduated' }, data: { status: 'studying', graduationDate: null } });
      if (!count) throw new ConflictException('นักเรียนคนนี้ไม่ได้อยู่ในสถานะสำเร็จการศึกษา');
      await this.audit.log({ actorUserId: actor.id, action: 'student.graduate_undo', entity: 'student', entityId: studentId, ip }, tx);
      return { ok: true };
    });
  }
}
