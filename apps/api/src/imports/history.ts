import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { PrismaService } from '../common/prisma.service.js';

/** ไฟล์ชื่อเดียวกัน จำนวนแถวเท่ากัน เคยนำเข้าสำเร็จแล้ว → เตือนก่อนนำเข้าซ้ำ */
export async function previousImport(prisma: PrismaService, kind: string, fileName: string, total: number) {
  const prev = await prisma.importJob.findFirst({ where: { kind, fileName, total, status: 'committed' }, orderBy: { committedAt: 'desc' }, select: { committedAt: true, createdById: true } });
  if (!prev) return null;
  const by = await prisma.user.findUnique({ where: { id: prev.createdById }, select: { displayName: true } });
  return { at: prev.committedAt?.toISOString() ?? null, by: by?.displayName ?? '' };
}

/** ประเภทข้อมูลที่แต่ละบทบาทดูประวัติได้ (ตรงกับสิทธิ์นำเข้า) */
const kindsFor = (u: AuthUser): string[] => {
  const admin = u.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
  const registrar = u.roles.includes('REGISTRAR');
  const assessment = u.roles.includes('ASSESSMENT_STAFF');
  return [
    ...(admin || registrar ? ['student', 'plan', 'schedule'] : []),
    ...(admin || registrar || assessment ? ['grade'] : []),
    ...(admin ? ['staff'] : []),
  ];
};

@Controller('admin/imports')
export class ImportHistoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('history')
  async history(@CurrentUser() u: AuthUser) {
    const kinds = kindsFor(u);
    if (!kinds.length) throw new ForbiddenException('ไม่มีสิทธิ์นำเข้าข้อมูล');
    const jobs = await this.prisma.importJob.findMany({
      where: { kind: { in: kinds }, status: { not: 'uploaded' } }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, kind: true, fileName: true, status: true, createdAt: true, committedAt: true, total: true, created: true, updated: true, errors: true, createdById: true, summary: true },
    });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.createdById))] } }, select: { id: true, displayName: true } });
    const names = new Map(users.map((x) => [x.id, x.displayName]));
    return {
      kinds,
      items: jobs.map(({ createdById, summary, ...j }) => ({
        ...j, by: names.get(createdById) ?? '', createdAt: j.createdAt.toISOString(), committedAt: j.committedAt?.toISOString() ?? null,
        error: j.status === 'failed' ? String((summary as { error?: string } | null)?.error ?? '').slice(0, 200) : null,
      })),
    };
  }
}
