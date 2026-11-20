import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  LEVEL_LABEL, SECTION_STATUS_LABEL, SPECIAL_GRADES, entryGrade, isComplete, nextSectionStatus, recordStatusFor, termLabel, termOrder,
  type BoardView, type GradingWindow, type Level, type SectionAction, type SectionGradeStatus, type SpecialGrade,
  type TeachRosterRow, type TeachSectionCard, type TeachSectionDetail, type TeachSectionsView, type TermRef,
} from '@csis/shared';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService, type Tx } from '../common/prisma.service.js';

type TermRow = { id: string; year: number; term: number; isCurrent: boolean; gradeOpenAt: Date | null; gradeDueAt: Date | null };
const toTerm = (t: TermRow): TermRef => ({ id: t.id, year: t.year, term: t.term, label: termLabel(t.year, t.term), isCurrent: t.isCurrent });
const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const windowOf = (t: TermRow): GradingWindow => ({ gradeOpenAt: isoDate(t.gradeOpenAt), gradeDueAt: isoDate(t.gradeDueAt) });
const sortTerms = (ts: TermRow[]) => [...ts].sort((a, b) => termOrder(b.year, b.term) - termOrder(a.year, a.term));
const isSpecial = (g: string): g is SpecialGrade => (SPECIAL_GRADES as readonly string[]).includes(g);

export interface EntryRow { studentId: string; score: number | null; special: SpecialGrade | null }

const SECTION_INCLUDE = {
  subject: { select: { code: true, name: true, credits: true } },
  program: { select: { name: true, level: true } },
  teacher: { select: { displayName: true } },
  enrolments: {
    where: { withdrawn: false },
    select: { registration: { select: { student: { select: { id: true, studentCode: true, prefix: true, firstName: true, lastName: true, yearLevel: true, groupNo: true, program: { select: { name: true, level: true } } } } } } },
  },
  grades: { select: { id: true, studentId: true, grade: true, score: true } },
} as const;

/**
 * ขั้นตอนส่งผลการเรียนตาม ศธ.02 — วิชา (section) เป็นเจ้าของสถานะ
 * ทุกการบันทึก/เปลี่ยนสถานะ: ล็อกแถว section ใน transaction → ตรวจสิทธิ์+สถานะ → เขียน section และเกรดรายคนพร้อมกัน → audit
 */
@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  // ---------------- อ่าน ----------------

  private async loadSection(id: string, teacherId?: string) {
    const s = await this.prisma.courseSection.findFirst({ where: { id, ...(teacherId ? { teacherUserId: teacherId } : {}) }, include: { ...SECTION_INCLUDE, term: true } });
    // ครูเปิดวิชาของคนอื่น → ไม่พบ (ไม่บอกว่ามีอยู่)
    if (!s) throw new NotFoundException('ไม่พบรายวิชานี้');
    return s;
  }

  private card(s: Awaited<ReturnType<GradingService['loadSection']>> | Omit<Awaited<ReturnType<GradingService['loadSection']>>, 'term'>): TeachSectionCard {
    const students = s.enrolments.map((e) => e.registration.student);
    const ids = new Set(students.map((x) => x.id));
    return {
      id: s.id,
      subject: s.subject,
      className: this.className(s, students),
      status: s.gradeStatus,
      students: students.length,
      graded: s.grades.filter((g) => ids.has(g.studentId)).length,
      returnNote: s.returnNote,
    };
  }

  /** ชื่อห้อง: จาก section ถ้ามี ไม่งั้นใช้ห้องที่นักเรียนส่วนใหญ่อยู่ */
  private className(s: { program: { name: string; level: string } | null; yearLevel: number | null; groupNo: string }, students: { yearLevel: number; groupNo: string; program: { name: string; level: string } }[]) {
    const label = (p: { name: string; level: string }, y: number, g: string) => `${LEVEL_LABEL[p.level as Level]} ${p.name} ปี ${y}${g ? ` ห้อง ${g}` : ''}`;
    if (s.program && s.yearLevel) return label(s.program, s.yearLevel, s.groupNo);
    const counts = new Map<string, { n: number; text: string }>();
    for (const st of students) {
      const text = label(st.program, st.yearLevel, st.groupNo);
      counts.set(text, { n: (counts.get(text)?.n ?? 0) + 1, text });
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n);
    return top[0] ? `${top[0].text}${top.length > 1 ? ` และห้องอื่น` : ''}` : 'ยังไม่มีนักเรียน';
  }

  private rows(s: Awaited<ReturnType<GradingService['loadSection']>>): TeachRosterRow[] {
    const grades = new Map(s.grades.map((g) => [g.studentId, g]));
    return s.enrolments.map((e) => e.registration.student).sort((a, b) => a.studentCode.localeCompare(b.studentCode)).map((st) => {
      const g = grades.get(st.id);
      return {
        studentId: st.id, studentCode: st.studentCode, name: `${st.prefix}${st.firstName} ${st.lastName}`,
        score: g?.score === null || g?.score === undefined ? null : Number(g.score),
        special: g && isSpecial(g.grade) ? g.grade : null,
        grade: g?.grade ?? null,
      };
    });
  }

  private detail(s: Awaited<ReturnType<GradingService['loadSection']>>): TeachSectionDetail {
    return { ...this.card(s), term: toTerm(s.term), window: windowOf(s.term), submittedAt: s.submittedAt?.toISOString() ?? null, rows: this.rows(s) };
  }

  private async pickTerm(termId: string | undefined, candidates: TermRow[]) {
    if (termId) {
      const t = await this.prisma.academicTerm.findUnique({ where: { id: termId } });
      if (!t) throw new NotFoundException('ไม่พบภาคเรียน');
      return t;
    }
    return candidates.find((t) => t.isCurrent) ?? candidates[0] ?? (await this.prisma.academicTerm.findFirst({ where: { isCurrent: true } }));
  }

  /** หน้า "กรอกเกรด": วิชาที่ครูคนนี้สอน */
  async teacherSections(user: AuthUser, termId?: string): Promise<TeachSectionsView> {
    const terms = sortTerms(await this.prisma.academicTerm.findMany({ where: { sections: { some: { teacherUserId: user.id } } } }));
    const term = await this.pickTerm(termId, terms);
    if (!term) return { terms: [], term: null, window: { gradeOpenAt: null, gradeDueAt: null }, sections: [] };
    const sections = await this.prisma.courseSection.findMany({ where: { termId: term.id, teacherUserId: user.id }, include: SECTION_INCLUDE, orderBy: { subject: { code: 'asc' } } });
    return { terms: terms.map(toTerm), term: toTerm(term), window: windowOf(term), sections: sections.map((s) => this.card(s)) };
  }

  async teacherSection(user: AuthUser, id: string) { return this.detail(await this.loadSection(id, user.id)); }
  async adminSection(id: string) { return this.detail(await this.loadSection(id)); }

  // ---------------- เขียน ----------------

  /** ล็อกแถววิชาไว้จนจบ transaction — กันบันทึกชนกับส่ง/อนุมัติ และกดซ้ำ */
  private async lock(tx: Tx, id: string, teacherId?: string): Promise<SectionGradeStatus> {
    const rows = teacherId
      ? await tx.$queryRaw<{ gradeStatus: SectionGradeStatus }[]>`SELECT "gradeStatus" FROM "course_sections" WHERE id = ${id}::uuid AND "teacherUserId" = ${teacherId}::uuid FOR UPDATE`
      : await tx.$queryRaw<{ gradeStatus: SectionGradeStatus }[]>`SELECT "gradeStatus" FROM "course_sections" WHERE id = ${id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new NotFoundException('ไม่พบรายวิชานี้');
    return rows[0].gradeStatus;
  }

  private step(from: SectionGradeStatus, action: SectionAction): SectionGradeStatus {
    const to = nextSectionStatus(from, action);
    if (to) return to;
    const msg: Partial<Record<SectionAction, string>> = {
      save: 'วิชานี้ส่งผลแล้ว แก้ไขไม่ได้ — ถ้าต้องแก้ ติดต่องานวัดผลให้ส่งคืน',
      submit: 'ส่งผลไม่ได้ในสถานะนี้',
    };
    throw new ConflictException(msg[action] ?? `ทำรายการนี้ไม่ได้ เพราะสถานะตอนนี้คือ "${SECTION_STATUS_LABEL[from]}" (อาจมีคนทำไปแล้ว ลองโหลดหน้าใหม่)`);
  }

  private async enrolledIds(tx: Tx, sectionId: string) {
    const rs = await tx.registrationSubject.findMany({ where: { sectionId, withdrawn: false }, select: { registration: { select: { studentId: true } } } });
    return rs.map((r) => r.registration.studentId);
  }

  /** ครูบันทึกคะแนน (บันทึกร่าง) — เซิร์ฟเวอร์ตัดเกรดเองเสมอ ไม่เชื่อเกรดจากหน้าเว็บ */
  async save(user: AuthUser, id: string, rows: EntryRow[], ip: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const from = await this.lock(tx, id, user.id);
      const to = this.step(from, 'save');
      const enrolled = new Set(await this.enrolledIds(tx, id));
      const seen = new Set<string>();
      for (const r of rows) {
        if (!enrolled.has(r.studentId)) throw new BadRequestException('มีนักเรียนที่ไม่ได้ลงทะเบียนวิชานี้ — โหลดหน้าใหม่แล้วลองอีกครั้ง');
        if (seen.has(r.studentId)) throw new BadRequestException('มีนักเรียนซ้ำในรายการ');
        seen.add(r.studentId);
      }
      let saved = 0;
      let cleared = 0;
      const status = recordStatusFor(to);
      for (const r of rows) {
        const grade = entryGrade(r);
        if (!grade) {
          cleared += (await tx.gradeRecord.deleteMany({ where: { studentId: r.studentId, sectionId: id } })).count;
          continue;
        }
        const score = r.special ? null : r.score;
        await tx.gradeRecord.upsert({
          where: { studentId_sectionId: { studentId: r.studentId, sectionId: id } },
          update: { grade, score, status, publishedAt: null },
          create: { studentId: r.studentId, sectionId: id, grade, score, status },
        });
        saved += 1;
      }
      await tx.courseSection.update({ where: { id }, data: { gradeStatus: to } });
      await this.audit.log({ actorUserId: user.id, action: 'grade.save', entity: 'section', entityId: id, after: { saved, cleared, status: to }, ip }, tx);
      return { saved, cleared, status: to };
    });
    return result;
  }

  /** ครูยืนยันส่งผล — ต้องมีผลครบทุกคน */
  async submit(user: AuthUser, id: string, ip: string) {
    await this.prisma.$transaction(async (tx) => {
      const from = await this.lock(tx, id, user.id);
      const to = this.step(from, 'submit');
      const enrolled = await this.enrolledIds(tx, id);
      const grades = new Map((await tx.gradeRecord.findMany({ where: { sectionId: id, studentId: { in: enrolled } }, select: { studentId: true, grade: true } })).map((g) => [g.studentId, g.grade]));
      if (!isComplete(enrolled, grades)) throw new BadRequestException(`ยังกรอกไม่ครบ (กรอกแล้ว ${grades.size} จาก ${enrolled.length} คน) — ใส่คะแนนหรือเลือกผลพิเศษให้ครบทุกคนก่อนส่ง`);
      await tx.courseSection.update({ where: { id }, data: { gradeStatus: to, submittedAt: new Date(), submittedById: user.id } });
      await tx.gradeRecord.updateMany({ where: { sectionId: id }, data: { status: recordStatusFor(to) } });
      await this.audit.log({ actorUserId: user.id, action: 'grade.submit', entity: 'section', entityId: id, after: { students: enrolled.length, from }, ip }, tx);
    });
    return { status: 'submitted' as const };
  }

  // ---------------- งานวัดผล ----------------

  async board(termId?: string): Promise<BoardView> {
    const terms = sortTerms(await this.prisma.academicTerm.findMany({ where: { sections: { some: {} } } }));
    const term = await this.pickTerm(termId, terms);
    if (!term) return { terms: [], term: null, window: { gradeOpenAt: null, gradeDueAt: null }, rows: [] };
    const sections = await this.prisma.courseSection.findMany({ where: { termId: term.id }, include: SECTION_INCLUDE, orderBy: { subject: { code: 'asc' } } });
    return {
      terms: terms.map(toTerm), term: toTerm(term), window: windowOf(term),
      rows: sections.map((s) => ({
        ...this.card(s),
        teacher: s.teacher?.displayName || s.teacherName || '',
        teacherUserId: s.teacherUserId,
        submittedAt: s.submittedAt?.toISOString() ?? null,
        approvalDate: isoDate(s.approvalDate),
        publishDocDate: isoDate(s.publishDocDate),
      })),
    };
  }

  async setWindow(actor: AuthUser, termId: string, w: { gradeOpenAt: string | null; gradeDueAt: string | null }, ip: string) {
    if (w.gradeOpenAt && w.gradeDueAt && w.gradeOpenAt > w.gradeDueAt) throw new BadRequestException('วันเริ่มต้องไม่หลังวันสุดท้าย');
    const before = await this.prisma.academicTerm.findUnique({ where: { id: termId } });
    if (!before) throw new NotFoundException('ไม่พบภาคเรียน');
    const t = await this.prisma.academicTerm.update({ where: { id: termId }, data: { gradeOpenAt: w.gradeOpenAt ? new Date(w.gradeOpenAt) : null, gradeDueAt: w.gradeDueAt ? new Date(w.gradeDueAt) : null } });
    await this.audit.log({ actorUserId: actor.id, action: 'grade.window', entity: 'term', entityId: termId, before: windowOf(before), after: windowOf(t), ip });
    return windowOf(t);
  }

  async teachers() {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, status: 'ACTIVE', roles: { some: { role: { in: ['TEACHER', 'ADVISOR'] } } } },
      orderBy: { displayName: 'asc' }, select: { id: true, displayName: true },
    });
    return rows.map((r) => ({ id: r.id, name: r.displayName }));
  }

  /** กำหนดครูผู้สอน — เปลี่ยนได้เฉพาะก่อนส่งผล (หลังส่งแล้วถือว่าครูคนเดิมรับผิดชอบ) */
  async assignTeacher(actor: AuthUser, id: string, teacherUserId: string | null, ip: string) {
    await this.prisma.$transaction(async (tx) => {
      const status = await this.lock(tx, id);
      if (!['none', 'draft', 'returned'].includes(status)) throw new ConflictException('วิชานี้ส่งผลแล้ว เปลี่ยนครูผู้สอนไม่ได้ — ส่งคืนก่อน');
      if (teacherUserId) {
        const ok = await tx.user.count({ where: { id: teacherUserId, deletedAt: null, status: 'ACTIVE' } });
        if (!ok) throw new BadRequestException('ไม่พบบัญชีครูนี้ หรือบัญชีถูกระงับ');
      }
      const before = await tx.courseSection.findUniqueOrThrow({ where: { id }, select: { teacherUserId: true } });
      await tx.courseSection.update({ where: { id }, data: { teacherUserId } });
      await this.audit.log({ actorUserId: actor.id, action: 'grade.assign_teacher', entity: 'section', entityId: id, before, after: { teacherUserId }, ip }, tx);
    });
    return { ok: true };
  }

  /** ส่งคืน/อนุมัติ/ยกเลิกอนุมัติ/ประกาศ/ยกเลิกประกาศ ทีละวิชา */
  async transition(actor: AuthUser, id: string, action: Exclude<SectionAction, 'save' | 'submit'>, opts: { note?: string; date?: string }, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const from = await this.lock(tx, id);
      const to = this.step(from, action);
      const now = new Date();
      const data =
        action === 'return' ? { gradeStatus: to, returnNote: opts.note ?? '' }
        : action === 'approve' ? { gradeStatus: to, approvedAt: now, approvedById: actor.id, approvalDate: new Date(opts.date!), returnNote: '' }
        : action === 'unapprove' ? { gradeStatus: to, approvedAt: null, approvedById: null, approvalDate: null }
        : action === 'publish' ? { gradeStatus: to, publishedAt: now, publishedById: actor.id, publishDocDate: new Date(opts.date!) }
        : { gradeStatus: to, publishedAt: null, publishedById: null, publishDocDate: null };
      await tx.courseSection.update({ where: { id }, data });
      const recordStatus = recordStatusFor(to);
      await tx.gradeRecord.updateMany({ where: { sectionId: id }, data: { status: recordStatus, publishedAt: recordStatus === 'published' ? now : null } });
      await this.audit.log({ actorUserId: actor.id, action: `grade.${action}`, entity: 'section', entityId: id, before: { status: from }, after: { status: to, ...opts }, ip }, tx);
      return { id, status: to };
    });
  }

  /** ทำหลายวิชาพร้อมกัน — แต่ละวิชาแยก transaction รายงานผลรายวิชา (วิชาที่ไม่อยู่ในสถานะที่ทำได้จะข้าม) */
  async transitionMany(actor: AuthUser, ids: string[], action: 'approve' | 'publish', date: string, ip: string) {
    const results: { id: string; ok: boolean; message?: string }[] = [];
    for (const id of ids) {
      try {
        await this.transition(actor, id, action, { date }, ip);
        results.push({ id, ok: true });
      } catch (e) {
        results.push({ id, ok: false, message: e instanceof Error ? e.message : 'ทำไม่สำเร็จ' });
      }
    }
    return { done: results.filter((r) => r.ok).length, skipped: results.filter((r) => !r.ok).length, results };
  }

  /** แก้ไขผลการเรียนหลังอนุมัติ/ประกาศ (งานวัดผล) — ต้องมีเหตุผล เก็บประวัติทุกครั้ง */
  async correct(actor: AuthUser, recordId: string, input: { score: number | null; special: SpecialGrade | null; reason: string; requestNo?: string }, ip: string) {
    return this.prisma.$transaction(async (tx) => {
      const rec = await tx.gradeRecord.findUnique({ where: { id: recordId } });
      if (!rec) throw new NotFoundException('ไม่พบผลการเรียนนี้');
      const status = await this.lock(tx, rec.sectionId);
      if (status !== 'approved' && status !== 'published') throw new ConflictException('แก้ที่นี่ได้เฉพาะผลที่อนุมัติหรือประกาศแล้ว — ก่อนหน้านั้นให้ส่งคืนครูแก้');
      const grade = entryGrade(input);
      if (!grade) throw new BadRequestException('ใส่คะแนนหรือเลือกผลพิเศษ');
      const score = input.special ? null : input.score;
      if (grade === rec.grade && Number(rec.score ?? -1) === Number(score ?? -1)) throw new BadRequestException('ผลการเรียนเท่าเดิม ไม่มีอะไรเปลี่ยน');
      // ผลที่ประกาศแล้ว (นักเรียนเห็นแล้ว) แก้ได้เฉพาะเมื่อมีคำร้องขอแก้ไขผลการเรียนของนักเรียนคนนี้ที่อนุมัติแล้ว
      let requestId: string | null = null;
      if (status === 'published') {
        if (!input.requestNo) throw new BadRequestException('ผลที่ประกาศแล้วต้องแก้ผ่านคำร้องขอแก้ไขผลการเรียน — ใส่เลขที่คำร้อง');
        const req = await tx.request.findUnique({ where: { requestNo: input.requestNo }, select: { id: true, studentId: true, status: true } });
        if (!req) throw new BadRequestException(`ไม่พบคำร้องเลขที่ ${input.requestNo}`);
        if (req.studentId !== rec.studentId) throw new BadRequestException(`คำร้องเลขที่ ${input.requestNo} เป็นของนักเรียนคนอื่น`);
        if (req.status !== 'approved') throw new BadRequestException(`คำร้องเลขที่ ${input.requestNo} ยังไม่ได้รับอนุมัติ — แก้ผลได้หลังคำร้องอนุมัติแล้ว`);
        requestId = req.id;
      }
      await tx.gradeChange.create({ data: { gradeRecordId: rec.id, fromGrade: rec.grade, toGrade: grade, fromScore: rec.score, toScore: score, reason: input.reason, requestId, changedById: actor.id } });
      await tx.gradeRecord.update({ where: { id: rec.id }, data: { grade, score } });
      await this.audit.log({ actorUserId: actor.id, action: 'grade.correct', entity: 'grade', entityId: rec.id, before: { grade: rec.grade }, after: { grade, reason: input.reason, requestNo: input.requestNo ?? null }, ip }, tx);
      return { grade };
    });
  }

  async changes(sectionId: string) {
    const rows = await this.prisma.gradeChange.findMany({
      where: { record: { sectionId } }, orderBy: { at: 'desc' },
      include: { record: { select: { student: { select: { studentCode: true, prefix: true, firstName: true, lastName: true } } } }, request: { select: { requestNo: true } } },
    });
    const names = new Map((await this.prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.changedById))] } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
    return rows.map((r) => ({
      id: r.id, at: r.at.toISOString(), studentCode: r.record.student.studentCode,
      name: `${r.record.student.prefix}${r.record.student.firstName} ${r.record.student.lastName}`,
      fromGrade: r.fromGrade, toGrade: r.toGrade, reason: r.reason, requestNo: r.request?.requestNo ?? null, by: names.get(r.changedById) ?? '',
    }));
  }

  /** id ของเกรดรายคน (ใช้ตอนงานวัดผลแก้ไขผล) */
  async recordIds(sectionId: string) {
    const rows = await this.prisma.gradeRecord.findMany({ where: { sectionId }, select: { id: true, studentId: true } });
    return Object.fromEntries(rows.map((r) => [r.studentId, r.id]));
  }

}
