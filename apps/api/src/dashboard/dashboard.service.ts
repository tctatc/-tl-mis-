import { Injectable } from '@nestjs/common';
import { REQUEST_TYPES, type RequestStatus } from '@csis/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../common/prisma.service.js';

const typeName = new Map(REQUEST_TYPES.map((t) => [t.code, t.name]));
const typeCategory = new Map(REQUEST_TYPES.map((t) => [t.code, t.category]));

/** ขั้นของคำร้องที่ผู้บริหารอยากเห็น (แยก "รอเริ่ม" กับ "กำลังพิจารณา" ออกจาก pending) */
export type RequestStage = 'waiting' | 'in_progress' | 'returned' | 'approved' | 'rejected' | 'cancelled';
const stageWhere = (s: RequestStage): Prisma.RequestWhereInput =>
  s === 'waiting' ? { status: 'pending', currentStep: 0 }
  : s === 'in_progress' ? { status: 'pending', currentStep: { gt: 0 } }
  : { status: s as RequestStatus };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** ภาพรวมนักเรียน: สถานภาพทั้งหมด + การกระจายของคนที่กำลังศึกษา */
  async students() {
    const alive = { deletedAt: null } as const;
    const [byStatus, byProgramYear, programs] = await Promise.all([
      this.prisma.student.groupBy({ by: ['status'], _count: true, where: alive }),
      this.prisma.student.groupBy({ by: ['programId', 'yearLevel'], _count: true, where: { ...alive, status: 'studying' } }),
      this.prisma.program.findMany({ include: { department: true }, orderBy: [{ department: { name: 'asc' } }, { level: 'asc' }, { name: 'asc' }] }),
    ]);
    const prog = new Map(programs.map((p) => [p.id, p]));
    const levelYear = new Map<string, number>();
    const dept = new Map<string, { id: string; name: string; pvc: number; pvs: number }>();
    const program = new Map<string, number>();
    for (const r of byProgramYear) {
      const p = prog.get(r.programId);
      if (!p) continue;
      const ly = `${p.level}:${r.yearLevel}`;
      levelYear.set(ly, (levelYear.get(ly) ?? 0) + r._count);
      const d = dept.get(p.departmentId) ?? { id: p.departmentId, name: p.department.name, pvc: 0, pvs: 0 };
      d[p.level] += r._count;
      dept.set(p.departmentId, d);
      program.set(p.id, (program.get(p.id) ?? 0) + r._count);
    }
    const status = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>;
    return {
      total: byStatus.reduce((a, s) => a + s._count, 0),
      status,
      byLevelYear: [...levelYear].map(([k, count]) => { const [level, y] = k.split(':'); return { level: level as 'pvc' | 'pvs', yearLevel: Number(y), count }; })
        .sort((a, b) => a.level.localeCompare(b.level) || a.yearLevel - b.yearLevel),
      byDepartment: [...dept.values()].sort((a, b) => b.pvc + b.pvs - (a.pvc + a.pvs)),
      byProgram: programs.filter((p) => program.has(p.id)).map((p) => ({ id: p.id, name: p.name, level: p.level, department: p.department.name, departmentId: p.departmentId, count: program.get(p.id)! }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /** สถิติคำร้อง: ขั้นตอน, ประเภท, แนวโน้ม 12 เดือน, เวลาที่ใช้ */
  async requests() {
    const since = new Date(); since.setUTCMonth(since.getUTCMonth() - 11, 1); since.setUTCHours(0, 0, 0, 0);
    const [byStatus, inProgress, byType, monthly, closed] = await Promise.all([
      this.prisma.request.groupBy({ by: ['status'], _count: true }),
      this.prisma.request.count({ where: stageWhere('in_progress') }),
      this.prisma.request.groupBy({ by: ['typeCode', 'status'], _count: true }),
      this.prisma.$queryRaw<{ month: string; n: bigint }[]>`
        SELECT to_char(date_trunc('month', "submittedAt" AT TIME ZONE 'Asia/Bangkok'), 'YYYY-MM') AS month, count(*) AS n
          FROM requests WHERE "submittedAt" >= ${since} GROUP BY 1 ORDER BY 1`,
      this.prisma.request.findMany({ where: { status: { in: ['approved', 'rejected'] }, closedAt: { not: null } }, select: { submittedAt: true, closedAt: true }, orderBy: { closedAt: 'desc' }, take: 500 }),
    ]);
    const s = Object.fromEntries(byStatus.map((r) => [r.status, r._count])) as Partial<Record<RequestStatus, number>>;
    const pending = s.pending ?? 0;
    const types = new Map<string, { code: string; name: string; category: string; total: number; open: number; approved: number; rejected: number }>();
    for (const r of byType) {
      const t = types.get(r.typeCode) ?? { code: r.typeCode, name: typeName.get(r.typeCode) ?? r.typeCode, category: typeCategory.get(r.typeCode) ?? 'D', total: 0, open: 0, approved: 0, rejected: 0 };
      t.total += r._count;
      if (r.status === 'pending' || r.status === 'returned') t.open += r._count;
      if (r.status === 'approved') t.approved += r._count;
      if (r.status === 'rejected') t.rejected += r._count;
      types.set(r.typeCode, t);
    }
    // 12 เดือนย้อนหลัง เติมเดือนที่ไม่มีคำร้องเป็น 0
    const counts = new Map(monthly.map((m) => [m.month, Number(m.n)]));
    const months: { month: string; count: number }[] = [];
    const bkk = new Date(Date.now() + 7 * 3_600_000);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth() - i, 1));
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      months.push({ month: key, count: counts.get(key) ?? 0 });
    }
    const days = closed.map((c) => (c.closedAt!.getTime() - c.submittedAt.getTime()) / 86_400_000);
    return {
      total: byStatus.reduce((a, r) => a + r._count, 0),
      stages: { waiting: pending - inProgress, in_progress: inProgress, returned: s.returned ?? 0, approved: s.approved ?? 0, rejected: s.rejected ?? 0, cancelled: s.cancelled ?? 0 } satisfies Record<RequestStage, number>,
      byType: [...types.values()].sort((a, b) => b.total - a.total),
      monthly: months,
      avgDays: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : null,
    };
  }

  /** ตารางคำร้อง: ค้นหาด้วยชื่อ/รหัสนักศึกษา/เลขที่ + กรองประเภท/ขั้น */
  async requestList(q: { q?: string; type?: string; stage?: RequestStage; page: number }) {
    const PAGE = 20;
    const term = q.q?.trim();
    const where: Prisma.RequestWhereInput = {
      ...(q.type ? { typeCode: q.type } : {}),
      ...(q.stage ? stageWhere(q.stage) : {}),
      ...(term ? { OR: [
        { requestNo: { contains: term } },
        { student: { studentCode: { contains: term } } },
        { student: { firstName: { contains: term } } },
        { student: { lastName: { contains: term } } },
      ] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.request.findMany({ where, orderBy: { submittedAt: 'desc' }, skip: q.page * PAGE, take: PAGE,
        select: { id: true, requestNo: true, typeCode: true, status: true, currentStep: true, submittedAt: true, updatedAt: true,
          student: { select: { studentCode: true, prefix: true, firstName: true, lastName: true } } } }),
      this.prisma.request.count({ where }),
    ]);
    return {
      total, pageSize: PAGE,
      items: rows.map((r) => ({
        id: r.id, requestNo: r.requestNo, typeCode: r.typeCode, typeName: typeName.get(r.typeCode) ?? r.typeCode,
        status: r.status, stage: (r.status === 'pending' ? (r.currentStep > 0 ? 'in_progress' : 'waiting') : r.status) as RequestStage,
        studentCode: r.student.studentCode, studentName: `${r.student.prefix}${r.student.firstName} ${r.student.lastName}`,
        submittedAt: r.submittedAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }
}
