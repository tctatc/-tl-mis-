import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FlowError, POSITIONS, WORKFLOWS, academicYearOf, applyDecision, canCancel, formatRequestNo, fullName, generalFormSchema,
  getRequestType, isAssignee, resubmit, validateForm, type CourseRow,
  type ApprovalRecord, type Assignee, type Decision, type PositionKey, type RequestDetail, type RequestStatus,
  type RequestSummary, type StatusEvent, type StudentSnapshot, type TemplateKey, type WorkflowStep,
} from '@csis/shared';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import { loadStudentSnapshot } from '../common/student-snapshot.js';
import { parseOr400 } from '../common/zod.js';
import type { Prisma } from '../generated/prisma/client.js';
import { seesAllRequests, type AuthUser } from '../auth/decorators.js';

const PAGE_SIZE = 50;

const stepsOf = (template: string): WorkflowStep[] => WORKFLOWS[template as TemplateKey] ?? [];

const assigneeTitle = (assignee: Assignee) =>
  assignee.kind === 'advisor' ? 'ครูที่ปรึกษา' : assignee.kind === 'programHead' ? 'หัวหน้าสาขาวิชา' : POSITIONS[assignee.position];

function waitingFor(status: RequestStatus, template: string, currentStep: number): string {
  if (status === 'returned') return 'นักศึกษาแก้ไขแล้วส่งใหม่';
  if (status !== 'pending') return '';
  const step = stepsOf(template)[currentStep];
  return step ? assigneeTitle(step.assignee) : '';
}

/** ตรวจข้อมูลที่กรอกตามแบบฟอร์มของประเภทนั้น */
function parseFormData(template: string, data: unknown): Record<string, unknown> {
  if (template === 'general') return parseOr400(generalFormSchema, data);
  const result = validateForm(template as TemplateKey, data);
  if (!result.ok) throw new BadRequestException({ message: 'ข้อมูลไม่ถูกต้อง', fields: result.errors });
  return result.data;
}

const STUDENT_SUBJECT = { select: { advisorUserId: true, program: { select: { headUserId: true } } } } as const;
type RequestRow = Prisma.RequestGetPayload<{ include: { student: typeof STUDENT_SUBJECT } }>;
const subjectOf = (row: RequestRow) => ({ submitterUserId: row.submitterUserId, advisorUserId: row.student.advisorUserId, programHeadUserId: row.student.program.headUserId });

@Injectable()
export class RequestsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * ตารางรายวิชา: ชื่อวิชา คาบ หน่วยกิต และหมวดวิชาเอาจากฐานข้อมูลเสมอ (นักศึกษาแก้เองไม่ได้)
   * รหัสที่ไม่มีในระบบ (เช่น วิชาจากสถานศึกษาเดิม) ใช้ตามที่กรอก
   */
  private async enrichCourses(data: Record<string, unknown>, studentId: string) {
    const rows = data.courses as CourseRow[] | undefined;
    if (!Array.isArray(rows) || rows.length === 0) return data;
    const subjects = await this.prisma.subject.findMany({ where: { code: { in: rows.map((r) => r.code) } } });
    const student = await this.prisma.student.findUnique({ where: { id: studentId }, select: { curriculumId: true } });
    const plan = student?.curriculumId
      ? await this.prisma.studyPlanSubject.findMany({ where: { curriculumId: student.curriculumId, subjectId: { in: subjects.map((s) => s.id) } } })
      : [];
    const byCode = new Map(subjects.map((s) => [s.code, s]));
    return {
      ...data,
      courses: rows.map((r) => {
        const s = byCode.get(r.code);
        if (!s) return r;
        const category = plan.find((p) => p.subjectId === s.id)?.category;
        return { ...r, name: s.name, periods: s.theory + s.practice, credits: s.credits, category: r.category || category || '' };
      }),
    };
  }

  // ---------------- นักศึกษา ----------------

  async create(user: AuthUser, input: { typeCode: string; data: unknown; idempotencyKey: string; useSignature?: boolean }, ip: string) {
    if (!user.studentId) throw new ForbiddenException('ยื่นคำร้องได้เฉพาะบัญชีนักศึกษา');
    const type = getRequestType(input.typeCode);
    if (!type) throw new BadRequestException('ไม่พบประเภทคำร้องนี้');
    if (!type.ready || type.hidden) throw new BadRequestException('คำร้องประเภทนี้ไม่เปิดให้ยื่นออนไลน์ ใช้แบบคำร้องทั่วไป (เรื่องอื่น ๆ) แทน');
    const data = await this.enrichCourses(parseFormData(type.template, input.data), user.studentId);

    const existing = await this.prisma.request.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.submitterUserId !== user.id) throw new ConflictException('คีย์คำขอซ้ำ');
      return { id: existing.id, requestNo: existing.requestNo };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.findUniqueOrThrow({ where: { id: user.studentId! } });
        const alumniOk = type.allowAlumni && student.status === 'graduated';
        if (student.status !== 'studying' && student.status !== 'on_leave' && !alumniOk) {
          throw new ForbiddenException('สถานภาพนักศึกษาไม่สามารถยื่นคำร้องออนไลน์ได้ กรุณาติดต่องานทะเบียน');
        }
        const snapshot = await loadStudentSnapshot(tx, student.id);
        const studentSignature = input.useSignature ? this.savedSignature(student.signature) : null;
        const year = academicYearOf(new Date());
        const [{ last }] = await tx.$queryRaw<[{ last: number }]>`
          INSERT INTO request_counters (year, last) VALUES (${year}, 1)
          ON CONFLICT (year) DO UPDATE SET last = request_counters.last + 1
          RETURNING last`;
        const created = await tx.request.create({
          data: {
            requestNo: formatRequestNo(year, last),
            typeCode: type.code,
            template: type.template,
            studentId: student.id,
            submitterUserId: user.id,
            data: data as Prisma.InputJsonValue,
            studentSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            studentSignature,
            idempotencyKey: input.idempotencyKey,
            history: { create: { fromStatus: null, toStatus: 'pending', note: 'ยื่นคำร้อง', actorUserId: user.id, actorName: user.displayName } },
          },
        });
        await this.audit.log({ actorUserId: user.id, action: 'request.create', entity: 'request', entityId: created.id, after: { typeCode: type.code, data, signed: !!studentSignature }, ip }, tx);
        return { id: created.id, requestNo: created.requestNo };
      });
    } catch (error) {
      // กดยื่นพร้อมกันสองแท็บด้วยคีย์เดียวกัน: ตัวที่แพ้ได้ใบเดิมกลับไป
      if ((error as { code?: string }).code === 'P2002') {
        const again = await this.prisma.request.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (again && again.submitterUserId === user.id) return { id: again.id, requestNo: again.requestNo };
      }
      throw error;
    }
  }

  async listMine(user: AuthUser): Promise<RequestSummary[]> {
    if (!user.studentId) return [];
    const rows = await this.prisma.request.findMany({ where: { studentId: user.studentId }, orderBy: { submittedAt: 'desc' }, take: 100 });
    return rows.map((r) => this.toSummary(r));
  }

  async resubmit(user: AuthUser, id: string, dataRaw: unknown, ip: string, useSignature?: boolean) {
    const row = await this.prisma.request.findUnique({ where: { id } });
    if (!row || row.submitterUserId !== user.id) throw new NotFoundException('ไม่พบคำร้อง');
    const data = await this.enrichCourses(parseFormData(row.template, dataRaw), row.studentId);
    let next;
    try {
      next = resubmit({ status: row.status, currentStep: row.currentStep, round: row.round });
    } catch (e) {
      throw this.flowError(e);
    }
    await this.prisma.$transaction(async (tx) => {
      const snapshot = await loadStudentSnapshot(tx, row.studentId);
      // ไม่ส่งตัวเลือกมา = คงลายเซ็นเดิมของใบนี้
      const signature = useSignature === undefined ? undefined
        : useSignature ? this.savedSignature((await tx.student.findUniqueOrThrow({ where: { id: row.studentId }, select: { signature: true } })).signature) : null;
      const updated = await tx.request.updateMany({
        where: { id, status: 'returned', round: row.round },
        data: { ...next, data: data as Prisma.InputJsonValue, studentSnapshot: snapshot as unknown as Prisma.InputJsonValue, ...(signature === undefined ? {} : { studentSignature: signature }) },
      });
      if (updated.count === 0) throw new ConflictException('คำร้องเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า');
      await tx.requestStatusHistory.create({ data: { requestId: id, fromStatus: 'returned', toStatus: 'pending', note: 'แก้ไขแล้วส่งใหม่', actorUserId: user.id, actorName: user.displayName } });
      await this.audit.log({ actorUserId: user.id, action: 'request.resubmit', entity: 'request', entityId: id, before: row.data, after: data, ip }, tx);
    });
  }

  async cancel(user: AuthUser, id: string, ip: string) {
    const row = await this.prisma.request.findUnique({ where: { id } });
    if (!row || row.submitterUserId !== user.id) throw new NotFoundException('ไม่พบคำร้อง');
    const decided = await this.prisma.requestApproval.count({ where: { requestId: id, round: row.round } });
    if (!canCancel(row, decided)) throw new ConflictException('คำร้องนี้มีผู้พิจารณาแล้ว ยกเลิกเองไม่ได้ กรุณาติดต่องานทะเบียน');
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.request.updateMany({ where: { id, status: row.status, round: row.round, currentStep: row.currentStep }, data: { status: 'cancelled', closedAt: new Date() } });
      if (updated.count === 0) throw new ConflictException('คำร้องเปลี่ยนสถานะไปแล้ว กรุณารีเฟรชหน้า');
      await tx.requestStatusHistory.create({ data: { requestId: id, fromStatus: row.status, toStatus: 'cancelled', note: 'ผู้ยื่นยกเลิกคำร้อง', actorUserId: user.id, actorName: user.displayName } });
      await this.audit.log({ actorUserId: user.id, action: 'request.cancel', entity: 'request', entityId: id, ip }, tx);
    });
  }

  // ---------------- ทุกคน (ตามสิทธิ์) ----------------

  async detail(user: AuthUser, id: string): Promise<RequestDetail> {
    const row = await this.prisma.request.findUnique({
      where: { id },
      include: {
        student: STUDENT_SUBJECT,
        approvals: { orderBy: [{ round: 'asc' }, { stepIndex: 'asc' }] },
        history: { orderBy: { at: 'asc' } },
      },
    });
    if (!row || !this.canView(user, row)) throw new NotFoundException('ไม่พบคำร้อง');

    const steps = stepsOf(row.template);
    const step = steps[row.currentStep];
    const subject = subjectOf(row);
    const isOwner = row.submitterUserId === user.id;
    const decidedThisRound = row.approvals.filter((a) => a.round === row.round).length;

    return {
      ...this.toSummary(row),
      data: row.data,
      student: row.studentSnapshot as unknown as StudentSnapshot,
      studentSignature: row.studentSignature,
      approvals: row.approvals.map((a): ApprovalRecord => ({
        id: a.id, round: a.round, stepIndex: a.stepIndex, stepKey: a.stepKey, decision: a.decision as Decision,
        comment: a.comment, actorName: a.actorName, actorTitle: a.actorTitle, decidedAt: a.decidedAt.toISOString(),
      })),
      history: row.history.map((h): StatusEvent => ({
        id: h.id, fromStatus: h.fromStatus, toStatus: h.toStatus, note: h.note, actorName: h.actorName, at: h.at.toISOString(),
      })),
      officials: await this.officials(),
      can: {
        act: row.status === 'pending' && !!step && isAssignee({ userId: user.id, positions: user.positions }, step.assignee, subject),
        edit: isOwner && row.status === 'returned',
        cancel: isOwner && canCancel(row, decidedThisRound),
      },
    };
  }

  /** ชื่อผู้ดำรงตำแหน่ง ใช้พิมพ์ในวงเล็บใต้ช่องลงชื่อ (หน้ากรอกคำร้องแสดงตั้งแต่ก่อนยื่น) */
  async officials(): Promise<Partial<Record<PositionKey, string>>> {
    const positions = await this.prisma.position.findMany({ select: { key: true, holderName: true } });
    return Object.fromEntries(positions.filter((p) => p.holderName).map((p) => [p.key, p.holderName]));
  }

  // ---------------- เจ้าหน้าที่ ----------------

  async decide(user: AuthUser, id: string, input: { decision: Decision; comment: string; expectedStep: number; expectedRound: number }, ip: string) {
    if ((input.decision === 'reject' || input.decision === 'return') && input.comment.trim().length < 3) {
      throw new BadRequestException({ message: 'กรุณาระบุเหตุผล', fields: { comment: 'ระบุเหตุผลให้นักศึกษาทราบ' } });
    }
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.request.findUnique({ where: { id }, include: { student: STUDENT_SUBJECT } });
      if (!row || !this.canView(user, row)) throw new NotFoundException('ไม่พบคำร้อง');
      if (row.status !== 'pending' || row.currentStep !== input.expectedStep || row.round !== input.expectedRound) {
        throw new ConflictException('คำร้องนี้ถูกพิจารณาไปแล้ว กรุณารีเฟรชหน้า');
      }
      const steps = stepsOf(row.template);
      const step = steps[row.currentStep];
      if (!step || !isAssignee({ userId: user.id, positions: user.positions }, step.assignee, subjectOf(row))) {
        throw new ForbiddenException('คุณไม่ใช่ผู้พิจารณาขั้นตอนนี้');
      }
      let next;
      try {
        next = applyDecision({ status: row.status, currentStep: row.currentStep, round: row.round }, steps, input.decision);
      } catch (e) {
        throw this.flowError(e);
      }
      const closed = next.status === 'approved' || next.status === 'rejected';
      const updated = await tx.request.updateMany({
        where: { id, status: 'pending', currentStep: row.currentStep, round: row.round },
        data: { status: next.status, currentStep: next.currentStep, ...(closed ? { closedAt: new Date() } : {}) },
      });
      if (updated.count === 0) throw new ConflictException('คำร้องนี้ถูกพิจารณาไปแล้ว กรุณารีเฟรชหน้า');

      await tx.requestApproval.create({
        data: {
          requestId: id, round: row.round, stepIndex: row.currentStep, stepKey: step.key, decision: input.decision,
          comment: input.comment.trim(), actorUserId: user.id, actorName: user.displayName, actorTitle: assigneeTitle(step.assignee),
        },
      });
      const nextStep = steps[next.currentStep];
      const note =
        next.status === 'pending' ? `${assigneeTitle(step.assignee)}: เห็นควร ส่งต่อ${nextStep ? assigneeTitle(nextStep.assignee) : ''}`
        : next.status === 'approved' ? 'อนุมัติ'
        : next.status === 'rejected' ? `ไม่อนุมัติ: ${input.comment.trim()}`
        : `ส่งกลับให้แก้ไข: ${input.comment.trim()}`;
      await tx.requestStatusHistory.create({
        data: { requestId: id, fromStatus: row.status, toStatus: next.status, note, actorUserId: user.id, actorName: user.displayName },
      });
      await this.audit.log({ actorUserId: user.id, action: `request.${input.decision}`, entity: 'request', entityId: id, before: { status: row.status, step: row.currentStep }, after: { ...next, comment: input.comment }, ip }, tx);
      return next;
    });
  }

  async listStaff(user: AuthUser, query: { box: 'todo' | 'done' | 'all'; status?: RequestStatus; q?: string; page: number }) {
    const base: Prisma.RequestWhereInput[] = [];
    if (query.box === 'todo') base.push(this.todoWhere(user));
    else if (query.box === 'done') base.push({ approvals: { some: { actorUserId: user.id } } });
    else if (!seesAllRequests(user)) throw new ForbiddenException('ดูคำร้องทั้งหมดได้เฉพาะงานทะเบียนและผู้ดูแลระบบ');

    if (query.status) base.push({ status: query.status });
    const q = query.q?.trim();
    if (q) {
      base.push({
        OR: [
          { requestNo: { contains: q, mode: 'insensitive' } },
          { student: { studentCode: { contains: q } } },
          { student: { firstName: { contains: q } } },
          { student: { lastName: { contains: q } } },
        ],
      });
    }
    const where: Prisma.RequestWhereInput = { AND: base };
    const [rows, total, todo] = await Promise.all([
      this.prisma.request.findMany({ where, orderBy: { submittedAt: query.box === 'todo' ? 'asc' : 'desc' }, skip: query.page * PAGE_SIZE, take: PAGE_SIZE }),
      this.prisma.request.count({ where }),
      this.prisma.request.count({ where: this.todoWhere(user) }),
    ]);
    return { items: rows.map((r) => this.toSummary(r)), total, pageSize: PAGE_SIZE, counts: { todo } };
  }

  /** คำร้องที่ขั้นปัจจุบันรอคนนี้พิจารณา — สร้างเงื่อนไขเป็น SQL ไม่ดึงทั้งหมดมากรอง */
  private todoWhere(user: AuthUser): Prisma.RequestWhereInput {
    const or: Prisma.RequestWhereInput[] = [];
    for (const [template, steps] of Object.entries(WORKFLOWS)) {
      const byPosition = steps.flatMap((s, i) => (s.assignee.kind === 'position' && user.positions.includes(s.assignee.position) ? [i] : []));
      const byAdvisor = steps.flatMap((s, i) => (s.assignee.kind === 'advisor' ? [i] : []));
      const byHead = steps.flatMap((s, i) => (s.assignee.kind === 'programHead' ? [i] : []));
      if (byPosition.length) or.push({ template, currentStep: { in: byPosition } });
      if (byAdvisor.length) or.push({ template, currentStep: { in: byAdvisor }, student: { advisorUserId: user.id } });
      if (byHead.length) or.push({ template, currentStep: { in: byHead }, student: { program: { headUserId: user.id } } });
    }
    if (or.length === 0) return { id: { in: [] } };
    return { status: 'pending', submitterUserId: { not: user.id }, OR: or };
  }

  /** ลายเซ็นที่บันทึกไว้ของนักศึกษา — เลือกใช้แต่ยังไม่เคยวาด = แจ้งให้วาดก่อน */
  private savedSignature(signature: string | null): string {
    if (!signature) throw new BadRequestException({ message: 'ยังไม่มีลายเซ็นที่บันทึกไว้ — วาดลายเซ็นก่อน หรือเลือกเว้นว่างไว้เซ็นบนกระดาษ', fields: { signature: 'วาดลายเซ็นก่อน' } });
    return signature;
  }

  private canView(user: AuthUser, row: RequestRow): boolean {
    if (row.submitterUserId === user.id || seesAllRequests(user)) return true;
    if (row.student.advisorUserId === user.id || row.student.program.headUserId === user.id) return true;
    return stepsOf(row.template).some((s) => s.assignee.kind === 'position' && user.positions.includes(s.assignee.position));
  }

  private toSummary(r: { id: string; requestNo: string; typeCode: string; template: string; status: RequestStatus; currentStep: number; round: number; submittedAt: Date; updatedAt: Date; studentSnapshot: unknown }): RequestSummary {
    const s = r.studentSnapshot as StudentSnapshot;
    return {
      id: r.id, requestNo: r.requestNo, typeCode: r.typeCode, status: r.status, currentStep: r.currentStep, round: r.round,
      submittedAt: r.submittedAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      studentCode: s.studentCode, studentName: fullName(s), waitingFor: waitingFor(r.status, r.template, r.currentStep),
    };
  }

  private flowError(e: unknown) {
    return e instanceof FlowError ? new ConflictException(e.message) : (e as Error);
  }
}

