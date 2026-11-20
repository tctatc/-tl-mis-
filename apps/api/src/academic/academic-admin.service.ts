import { BadRequestException, Injectable } from '@nestjs/common';
import { gpa, gradeOutcome, termLabel, type Level } from '@csis/shared';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export interface ClassFilter { termId?: string; programId?: string; yearLevel?: number; groupNo?: string }

/** หลังบ้าน: ดูแผนการเรียน/ตารางเรียน/ผลการเรียนตามห้อง และประกาศผล */
@Injectable()
export class AcademicAdminService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async terms() {
    const rows = await this.prisma.academicTerm.findMany({ orderBy: [{ year: 'desc' }, { term: 'desc' }] });
    return rows.map((t) => ({ id: t.id, label: termLabel(t.year, t.term), isCurrent: t.isCurrent }));
  }

  /** ห้องเรียนจริงจากทะเบียน (สาขา × ชั้นปี × ห้อง) ใช้เป็นตัวกรอง */
  async classes() {
    const rows = await this.prisma.student.groupBy({ by: ['programId', 'yearLevel', 'groupNo'], where: { deletedAt: null, status: { in: ['studying', 'on_leave'] } }, _count: true, orderBy: [{ programId: 'asc' }, { yearLevel: 'asc' }, { groupNo: 'asc' }] });
    const programs = new Map((await this.prisma.program.findMany()).map((p) => [p.id, p]));
    return rows.map((r) => {
      const p = programs.get(r.programId)!;
      return { programId: r.programId, program: p.name, level: p.level as Level, yearLevel: r.yearLevel, groupNo: r.groupNo, students: r._count };
    });
  }

  async plan(programId: string) {
    const cur = await this.prisma.curriculum.findFirst({ where: { programId }, orderBy: { year: 'desc' }, include: { items: { include: { subject: true }, orderBy: [{ yearLevel: 'asc' }, { term: 'asc' }] } } });
    if (!cur) return { curriculum: null, items: [] };
    return {
      curriculum: { id: cur.id, name: cur.name, year: cur.year, minCredits: cur.minCredits },
      items: cur.items.map((i) => ({ id: i.id, yearLevel: i.yearLevel, term: i.term, category: i.category, code: i.subject.code, name: i.subject.name, theory: i.subject.theory, practice: i.subject.practice, credits: i.subject.credits })),
    };
  }

  private async classStudents(f: ClassFilter) {
    if (!f.programId || !f.yearLevel) throw new BadRequestException('เลือกสาขาและชั้นปี');
    return this.prisma.student.findMany({
      where: { programId: f.programId, yearLevel: f.yearLevel, ...(f.groupNo ? { groupNo: f.groupNo } : {}), deletedAt: null },
      orderBy: { studentCode: 'asc' }, select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, groupNo: true, status: true },
    });
  }

  async schedule(f: ClassFilter) {
    if (!f.termId) throw new BadRequestException('เลือกภาคเรียน');
    const students = await this.classStudents(f);
    const sections = await this.prisma.courseSection.findMany({
      where: { termId: f.termId, enrolments: { some: { withdrawn: false, registration: { studentId: { in: students.map((s) => s.id) } } } } },
      include: { subject: true, teacher: { select: { displayName: true } }, sessions: true, _count: { select: { enrolments: true } } },
    });
    return {
      students: students.length,
      sessions: sections.flatMap((s) => s.sessions.map((x) => ({ id: x.id, dayOfWeek: x.dayOfWeek, startTime: x.startTime, endTime: x.endTime, room: x.room, code: s.subject.code, name: s.subject.name, credits: s.subject.credits, teacher: s.teacher?.displayName || s.teacherName, enrolled: s._count.enrolments })))
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)),
    };
  }

  /** ผลการเรียนของห้อง: นักเรียน × วิชา (ทุกสถานะ — หลังบ้านเห็นก่อนประกาศ) */
  async grades(f: ClassFilter) {
    if (!f.termId) throw new BadRequestException('เลือกภาคเรียน');
    const students = await this.classStudents(f);
    const records = await this.prisma.gradeRecord.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, section: { termId: f.termId } },
      include: { section: { include: { subject: true } } },
    });
    const subjects = [...new Map(records.map((r) => [r.section.subject.code, { code: r.section.subject.code, name: r.section.subject.name, credits: r.section.subject.credits }])).values()].sort((a, b) => a.code.localeCompare(b.code));
    return {
      subjects,
      rows: students.map((s) => {
        const mine = records.filter((r) => r.studentId === s.id);
        return {
          studentCode: s.studentCode, name: `${s.prefix}${s.firstName} ${s.lastName}`, groupNo: s.groupNo,
          grades: Object.fromEntries(mine.map((r) => [r.section.subject.code, { grade: r.grade, status: r.status, outcome: gradeOutcome(r.grade) }])),
          gpa: gpa(mine.map((r) => ({ credits: r.section.subject.credits, grade: r.grade }))),
        };
      }),
      counts: {
        waiting: records.filter((r) => r.status !== 'published').length,
        published: records.filter((r) => r.status === 'published').length,
      },
    };
  }
}
