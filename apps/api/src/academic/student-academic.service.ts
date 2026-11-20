import { Injectable, NotFoundException } from '@nestjs/common';
import {
  STUDENT_STATUS_LABEL, creditsEarned, gpa, gpax, gradeOutcome, maskNationalId, termLabel, termOrder,
  type GradedCourse, type GradesView, type PlanStatus, type ProfileView, type RegistrationCardView, type ScheduleView,
  type StudyPlanView, type SubjectRef, type TermRef,
} from '@csis/shared';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';

type TermRow = { id: string; year: number; term: number; isCurrent: boolean };
const toTerm = (t: TermRow): TermRef => ({ id: t.id, year: t.year, term: t.term, label: termLabel(t.year, t.term), isCurrent: t.isCurrent });
const toSubject = (s: SubjectRef): SubjectRef => ({ code: s.code, name: s.name, theory: s.theory, practice: s.practice, credits: s.credits });
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** ข้อมูลการเรียนของนักศึกษาที่ล็อกอินอยู่ — ทุกเมธอดรับ studentId จากเซสชันเท่านั้น ไม่รับจาก query */
@Injectable()
export class StudentAcademicService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** ภาคเรียนที่นักศึกษาคนนี้ลงทะเบียน (ใหม่ → เก่า) */
  private async myTerms(studentId: string): Promise<TermRef[]> {
    const regs = await this.prisma.registration.findMany({
      where: { studentId, status: 'registered' },
      include: { term: true },
    });
    return regs.map((r) => toTerm(r.term)).sort((a, b) => termOrder(b.year, b.term) - termOrder(a.year, a.term));
  }

  /** เลือกภาคตามที่ขอ ถ้าไม่ระบุ: ภาคปัจจุบัน หรือภาคล่าสุดที่ลงทะเบียน */
  private pickTerm(terms: TermRef[], termId?: string) {
    if (termId) return terms.find((t) => t.id === termId) ?? null;
    return terms.find((t) => t.isCurrent) ?? terms[0] ?? null;
  }

  private async publishedCourses(studentId: string) {
    const rows = await this.prisma.gradeRecord.findMany({
      where: { studentId, status: 'published' },
      include: { section: { include: { subject: true, term: true } } },
    });
    return rows.map((g) => ({
      code: g.section.subject.code,
      credits: g.section.subject.credits,
      grade: g.grade,
      termOrder: termOrder(g.section.term.year, g.section.term.term),
      subject: g.section.subject,
      term: g.section.term,
      sectionId: g.sectionId,
    }));
  }

  /** ค่าตั้งต้นของฟอร์มคำร้อง: ภาคเรียนปัจจุบัน + คาบ/สัปดาห์ที่ลงทะเบียนอยู่ */
  async formContext(studentId: string) {
    const term = await this.prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    const now = new Date();
    const current = term ? { year: term.year, term: term.term } : { year: now.getUTCFullYear() + 543 - (now.getUTCMonth() < 4 ? 1 : 0), term: 1 };
    const rows = term
      ? await this.prisma.registrationSubject.findMany({
          where: { withdrawn: false, registration: { studentId, termId: term.id, status: 'registered' } },
          include: { section: { include: { subject: true } } },
        })
      : [];
    return { current, registeredPeriods: rows.reduce((s, r) => s + r.section.subject.theory + r.section.subject.practice, 0) };
  }

  /** ค้นรายวิชา (รหัสหรือชื่อ) สำหรับตารางรายวิชาในคำร้อง */
  async searchSubjects(q: string): Promise<SubjectRef[]> {
    const term = q.trim();
    if (!term) return [];
    const rows = await this.prisma.subject.findMany({
      where: { OR: [{ code: { startsWith: term } }, { name: { contains: term } }] },
      orderBy: { code: 'asc' },
      take: 10,
    });
    return rows.map(toSubject);
  }

  async studyPlan(studentId: string): Promise<StudyPlanView> {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { curriculum: { include: { items: { include: { subject: true }, orderBy: [{ yearLevel: 'asc' }, { term: 'asc' }] } } } },
    });
    const empty = { creditsEarned: 0, creditsPlanned: 0, minCredits: 0, passed: 0, failed: 0, enrolled: 0, remaining: 0, total: 0 };
    if (!student.curriculum) return { curriculum: null, groups: [], summary: empty };

    const courses = await this.publishedCourses(studentId);
    const latest = new Map<string, string>();
    for (const c of [...courses].sort((a, b) => a.termOrder - b.termOrder)) latest.set(c.code, c.grade);

    // วิชาที่ลงทะเบียนอยู่แต่ยังไม่มีเกรดประกาศ
    const enrolledCodes = new Set(
      (await this.prisma.registrationSubject.findMany({
        where: { withdrawn: false, registration: { studentId, status: 'registered' } },
        include: { section: { include: { subject: true } } },
      })).map((r) => r.section.subject.code),
    );

    const summary = { ...empty, minCredits: student.curriculum.minCredits };
    const groups = new Map<string, StudyPlanView['groups'][number]>();
    for (const item of student.curriculum.items) {
      const grade = latest.get(item.subject.code) ?? null;
      const status: PlanStatus = grade !== null ? gradeOutcome(grade) : enrolledCodes.has(item.subject.code) ? 'enrolled' : 'remaining';
      const key = `${item.yearLevel}-${item.term}`;
      if (!groups.has(key)) groups.set(key, { yearLevel: item.yearLevel, term: item.term, items: [] });
      groups.get(key)!.items.push({ subject: toSubject(item.subject), category: item.category, status, grade });
      summary.total += 1;
      summary.creditsPlanned += item.subject.credits;
      if (status === 'passed') summary.passed += 1;
      else if (status === 'failed') summary.failed += 1;
      else if (status === 'enrolled' || status === 'pending') summary.enrolled += 1;
      else summary.remaining += 1;
    }
    summary.creditsEarned = creditsEarned(courses);
    return {
      curriculum: { name: student.curriculum.name, year: student.curriculum.year, minCredits: student.curriculum.minCredits },
      groups: [...groups.values()],
      summary,
    };
  }

  async registrationCard(studentId: string, termId?: string): Promise<RegistrationCardView> {
    const terms = await this.myTerms(studentId);
    const term = this.pickTerm(terms, termId);
    if (termId && !term) throw new NotFoundException('ไม่พบการลงทะเบียนภาคเรียนนี้');
    const advisor = (await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: { advisor: true } })).advisor?.displayName ?? '';
    if (!term) return { terms, term: null, registeredAt: null, advisor, subjects: [], totalCredits: 0 };
    const reg = await this.prisma.registration.findUniqueOrThrow({
      where: { studentId_termId: { studentId, termId: term.id } },
      include: { subjects: { where: { withdrawn: false }, include: { section: { include: { subject: true, teacher: true } } } } },
    });
    const subjects = reg.subjects
      .map((r) => ({ subject: toSubject(r.section.subject), groupCode: r.section.groupCode, teacher: r.section.teacher?.displayName || r.section.teacherName, kind: r.kind }))
      .sort((a, b) => a.subject.code.localeCompare(b.subject.code));
    return { terms, term, registeredAt: reg.registeredAt.toISOString(), advisor, subjects, totalCredits: subjects.reduce((s, x) => s + x.subject.credits, 0) };
  }

  async schedule(studentId: string, termId?: string): Promise<ScheduleView> {
    const terms = await this.myTerms(studentId);
    const term = this.pickTerm(terms, termId);
    if (termId && !term) throw new NotFoundException('ไม่พบการลงทะเบียนภาคเรียนนี้');
    if (!term) return { terms, term: null, sessions: [], exams: [] };
    const rows = await this.prisma.registrationSubject.findMany({
      where: { withdrawn: false, registration: { studentId, termId: term.id, status: 'registered' } },
      include: { section: { include: { subject: true, teacher: true, sessions: true, exams: true } } },
    });
    const sessions: ScheduleView['sessions'] = [];
    const exams: ScheduleView['exams'] = [];
    for (const { section } of rows) {
      const subject = toSubject(section.subject);
      const teacher = section.teacher?.displayName || section.teacherName;
      for (const s of section.sessions) sessions.push({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, room: s.room, subject, groupCode: section.groupCode, teacher });
      for (const e of section.exams) exams.push({ kind: e.kind, date: isoDate(e.date), startTime: e.startTime, endTime: e.endTime, room: e.room, subject });
    }
    sessions.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));
    exams.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    return { terms, term, sessions, exams };
  }

  async grades(studentId: string): Promise<GradesView> {
    const courses = await this.publishedCourses(studentId);
    const kinds = new Map(
      (await this.prisma.registrationSubject.findMany({ where: { registration: { studentId } }, select: { sectionId: true, kind: true } })).map((r) => [r.sectionId, r.kind]),
    );
    const byTerm = new Map<string, typeof courses>();
    for (const c of courses) byTerm.set(c.term.id, [...(byTerm.get(c.term.id) ?? []), c]);
    const ordered = [...byTerm.values()].sort((a, b) => a[0]!.termOrder - b[0]!.termOrder);

    const seen: GradedCourse[] = [];
    const terms: GradesView['terms'] = ordered.map((list) => {
      seen.push(...list);
      return {
        term: toTerm(list[0]!.term),
        rows: list.sort((a, b) => a.code.localeCompare(b.code)).map((c) => ({ subject: toSubject(c.subject), grade: c.grade, outcome: gradeOutcome(c.grade), kind: kinds.get(c.sectionId) ?? 'regular' })),
        credits: list.reduce((s, c) => s + c.credits, 0),
        gpa: gpa(list),
        gpax: gpax(seen),
        creditsEarned: creditsEarned(seen),
      };
    });

    // วิชาที่ยังค้าง (ผลครั้งล่าสุดไม่ผ่าน) — ต้องลงเรียนซ้ำ/แก้
    const latest = new Map<string, (typeof courses)[number]>();
    for (const c of [...courses].sort((a, b) => a.termOrder - b.termOrder)) latest.set(c.code, c);
    const failedOutstanding = [...latest.values()]
      .filter((c) => gradeOutcome(c.grade) !== 'passed')
      .map((c) => ({ subject: toSubject(c.subject), grade: c.grade, term: termLabel(c.term.year, c.term.term) }));

    return { terms: terms.reverse(), gpax: gpax(courses), creditsEarned: creditsEarned(courses), failedOutstanding };
  }

  async profile(studentId: string): Promise<ProfileView> {
    const s = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: { addresses: true, guardians: { orderBy: { isPrimary: 'desc' } }, advisor: true, curriculum: true },
    });
    const addr = (a: (typeof s.addresses)[number]) =>
      [a.houseNo && `เลขที่ ${a.houseNo}`, a.moo && `หมู่ ${a.moo}`, a.road && `ถนน${a.road}`, a.subdistrict && `ตำบล${a.subdistrict}`, a.district && `อำเภอ${a.district}`, a.province && `จังหวัด${a.province}`, a.postcode]
        .filter(Boolean).join(' ');
    return {
      status: STUDENT_STATUS_LABEL[s.status] ?? s.status,
      nickname: s.nickname,
      email: s.email,
      nationalIdMasked: maskNationalId(s.nationalId),
      nationality: s.nationality,
      religion: s.religion,
      bloodType: s.bloodType,
      entry: s.entryYear ? termLabel(s.entryYear, s.entryTerm ?? 1) : '',
      curriculum: s.curriculum?.name ?? '',
      advisor: s.advisor?.displayName ?? '',
      previous: { school: s.prevSchool, level: s.prevLevel, gpa: s.prevGpa ? Number(s.prevGpa).toFixed(2) : '' },
      addresses: s.addresses.sort((a) => (a.kind === 'home' ? -1 : 1)).map((a) => ({ kind: a.kind, text: addr(a) })),
      guardians: s.guardians.map((g) => ({ relation: g.relation, name: g.name, occupation: g.occupation, phone: g.phone, isPrimary: g.isPrimary })),
    };
  }

  async signature(studentId: string) {
    const s = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { signature: true, signatureUpdatedAt: true } });
    return { signature: s.signature, updatedAt: s.signatureUpdatedAt?.toISOString() ?? null };
  }

  /** บันทึก/ลบลายเซ็น — คำร้องที่ยื่นไปแล้วใช้สำเนาของตัวเอง ไม่เปลี่ยนตาม */
  async saveSignature(user: AuthUser, studentId: string, signature: string | null, ip: string) {
    await this.prisma.student.update({ where: { id: studentId }, data: { signature, signatureUpdatedAt: signature ? new Date() : null } });
    await this.audit.log({ actorUserId: user.id, action: signature ? 'signature.save' : 'signature.delete', entity: 'student', entityId: studentId, ip });
    return { ok: true };
  }
}
