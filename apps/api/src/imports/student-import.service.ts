import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  IMPORT_FIELDS, academicYearOf, defaultStudentPassword, entryYearFromCode, guessMapping, mapRow, normalizeOrgName, orgKey,
  type ImportField, type ImportMapping, type ImportedStudent, type Level, type RowIssue,
} from '@csis/shared';
import { hashPassword } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { RegistryService } from '../registry/registry.service.js';
import { readSheet, type Cell } from './file-reader.js';
import { previousImport } from './history.js';

export type ImportMode = 'upsert' | 'insert' | 'update';
interface RowResult { rowNo: number; action: 'create' | 'update' | 'error'; data: ImportedStudent & { programKey: string; advisorUserId: string | null }; issues: RowIssue[] }

const LEVEL_TH: Record<Level, string> = { pvc: 'ปวช.', pvs: 'ปวส.' };
const programKeyOf = (level: Level, program: string) => `${level}:${orgKey(program)}`;
const stripPrefix = (s: string) => s.replace(/^(นางสาว|นาง|นาย|ดร\.|ครู|อ\.)\s*/, '').replace(/\s+/g, '');

/** ทำงานทีละ n ชิ้นพร้อมกัน (แฮชรหัสผ่านหลายพันคนไม่ให้กิน CPU จนเครื่องค้าง) */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]!); }
  }));
  return out;
}

@Injectable()
export class StudentImportService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly registry: RegistryService) {}

  private async currentYear() {
    const term = await this.prisma.academicTerm.findFirst({ where: { isCurrent: true } });
    return term?.year ?? academicYearOf(new Date());
  }

  async upload(actor: AuthUser, file: { buffer: Buffer; originalname: string }) {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8'); // multer อ่านชื่อไฟล์ไทยเป็น latin1
    const sheet = await readSheet(file.buffer, name);
    const job = await this.prisma.importJob.create({
      data: { kind: 'student', fileName: name.slice(0, 200), createdById: actor.id, headers: sheet.headers, rawRows: sheet.rows as Prisma.InputJsonValue, total: sheet.rows.length, summary: { headerRowNo: sheet.headerRowNo, sheetName: sheet.sheetName, encoding: sheet.encoding ?? null } },
    });
    return {
      jobId: job.id, fileName: job.fileName, headers: sheet.headers, rowCount: sheet.rows.length, headerRowNo: sheet.headerRowNo,
      encoding: sheet.encoding ?? null, sample: sheet.rows.slice(0, 5), mapping: guessMapping(sheet.headers), currentYear: await this.currentYear(),
      previous: await previousImport(this.prisma, 'student', job.fileName, sheet.rows.length),
    };
  }

  private async loadJob(id: string, actor: AuthUser) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job || job.kind !== 'student') throw new NotFoundException('ไม่พบงานนำเข้า');
    if (job.createdById !== actor.id && !actor.roles.includes('SUPER_ADMIN')) throw new NotFoundException('ไม่พบงานนำเข้า');
    return job;
  }

  /** ตรวจทุกแถว (ยังไม่บันทึก): จับคู่สาขา, หารุ่นจากรหัส, เช็คซ้ำ, ตัดสินว่าเพิ่มใหม่/อัปเดต/ผิดพลาด */
  async preview(actor: AuthUser, id: string, input: { mapping: ImportMapping; mode: ImportMode; createMissing: boolean }) {
    const job = await this.loadJob(id, actor);
    if (job.status === 'committed' || job.status === 'committing') throw new ConflictException('นำเข้าไฟล์นี้ไปแล้ว');
    const headers = job.headers as string[];
    for (const [f, i] of Object.entries(input.mapping)) if (i !== undefined && (i < 0 || i >= headers.length)) throw new BadRequestException(`คอลัมน์ของ ${f} ไม่ถูกต้อง`);
    if (input.mapping.studentCode === undefined) throw new BadRequestException('ต้องเลือกคอลัมน์รหัสนักศึกษา');
    if (input.mapping.program === undefined) throw new BadRequestException('ต้องเลือกคอลัมน์สาขาวิชา');
    if (input.mapping.fullName === undefined && (input.mapping.firstName === undefined || input.mapping.lastName === undefined)) throw new BadRequestException('ต้องเลือกคอลัมน์ชื่อ-นามสกุล (รวม หรือ แยก ชื่อ/นามสกุล)');

    const currentYear = await this.currentYear();
    const raw = job.rawRows as Cell[][];
    const headerRowNo = ((job.summary as { headerRowNo?: number } | null)?.headerRowNo) ?? 1;
    const mapped = raw.map((r, i) => ({ rowNo: headerRowNo + 1 + i, ...mapRow(r, input.mapping, currentYear) }));

    const programs = await this.prisma.program.findMany({ include: { department: true } });
    const byKey = new Map(programs.map((p) => [programKeyOf(p.level, p.name), p]));
    const byName = new Map<string, typeof programs>();
    for (const p of programs) byName.set(orgKey(p.name), [...(byName.get(orgKey(p.name)) ?? []), p]);
    const staff = await this.prisma.user.findMany({ where: { deletedAt: null, roles: { some: { role: { not: 'STUDENT' } } } }, select: { id: true, displayName: true } });
    const codes = mapped.map((m) => m.student.studentCode).filter(Boolean);
    const existing = new Set((await this.prisma.student.findMany({ where: { studentCode: { in: codes } }, select: { studentCode: true } })).map((s) => s.studentCode));
    const seen = new Map<string, number>();
    const newPrograms = new Map<string, { level: Level; program: string; department: string; count: number }>();

    const results: RowResult[] = mapped.map(({ rowNo, student: s, issues }) => {
      const err = (column: RowIssue['column'], message: string) => issues.push({ column, message, level: 'error' });
      // ระดับ: จากไฟล์ → ถ้าไม่มีและชื่อสาขามีระดับเดียวในระบบใช้อันนั้น → สุดท้ายเดาจากหลักที่ 3 ของรหัส (2=ปวช. 3=ปวส.)
      let level = s.level;
      if (!level && s.program) {
        const same = byName.get(orgKey(s.program)) ?? [];
        if (same.length === 1) level = same[0]!.level;
        else if (/^\d{2}[23]/.test(s.studentCode)) {
          level = s.studentCode[2] === '2' ? 'pvc' : 'pvs';
          issues.push({ column: 'level', message: `ไม่มีระดับในไฟล์ เดาจากรหัส (หลักที่ 3 = ${s.studentCode[2]}) เป็น ${LEVEL_TH[level]}`, level: 'warning' });
        } else err('level', 'ไม่รู้ระดับ ปวช./ปวส. — เพิ่มคอลัมน์ระดับในไฟล์');
      }
      let programKey = '';
      if (level && s.program) {
        programKey = programKeyOf(level, s.program);
        if (!byKey.has(programKey)) {
          if (input.createMissing) {
            const np = newPrograms.get(programKey) ?? { level, program: normalizeOrgName(s.program), department: `แผนกวิชา${normalizeOrgName(s.department || s.program)}`, count: 0 };
            np.count += 1;
            newPrograms.set(programKey, np);
          } else err('program', `ไม่พบสาขา "${LEVEL_TH[level]} ${s.program}" ในระบบ (ติ๊ก “สร้างสาขาที่ยังไม่มี” หรือแก้ชื่อในไฟล์)`);
        }
      }
      if (s.studentCode) {
        const first = seen.get(s.studentCode);
        if (first) err('studentCode', `รหัสซ้ำกับแถวที่ ${first}`);
        else seen.set(s.studentCode, rowNo);
      }
      let advisorUserId: string | null = null;
      if (s.advisor) {
        const key = stripPrefix(s.advisor);
        const hit = staff.filter((u) => stripPrefix(u.displayName) === key);
        if (hit.length === 1) advisorUserId = hit[0]!.id;
        else issues.push({ column: 'advisor', message: `ไม่พบครูที่ปรึกษา "${s.advisor}" ในระบบ — ข้ามช่องนี้`, level: 'warning' });
      }
      const exists = existing.has(s.studentCode);
      if (input.mode === 'insert' && exists) err('studentCode', 'มีรหัสนี้ในระบบแล้ว (โหมดเพิ่มใหม่อย่างเดียว)');
      if (input.mode === 'update' && !exists && s.studentCode) err('studentCode', 'ไม่พบรหัสนี้ในระบบ (โหมดอัปเดตอย่างเดียว)');
      if (!exists && !s.birthDate && !issues.some((i) => i.column === 'birthDate')) err('birthDate', 'นักเรียนใหม่ต้องมีวันเกิด (ใช้เป็นรหัสผ่านเริ่มต้น)');
      const action: RowResult['action'] = issues.some((i) => i.level === 'error') ? 'error' : exists ? 'update' : 'create';
      return { rowNo, action, data: { ...s, level, programKey, advisorUserId }, issues };
    });

    // สรุปแยกแผนก/สาขา × รุ่น (ปีที่เข้า) — ให้เห็นว่าไฟล์แบ่งข้อมูลอย่างไรก่อนยืนยัน
    const groups = new Map<string, { department: string; level: Level | null; program: string; byEntry: Record<string, number>; total: number; isNew: boolean }>();
    for (const r of results) {
      if (r.action === 'error') continue;
      const existingProgram = byKey.get(r.data.programKey);
      const key = r.data.programKey;
      const g = groups.get(key) ?? {
        department: existingProgram?.department.name ?? `แผนกวิชา${normalizeOrgName(r.data.department || r.data.program)}`,
        level: r.data.level, program: existingProgram?.name ?? r.data.program, byEntry: {}, total: 0, isNew: !existingProgram,
      };
      const entry = r.data.entryYear ? String(r.data.entryYear) : 'ไม่ทราบ';
      g.byEntry[entry] = (g.byEntry[entry] ?? 0) + 1;
      g.total += 1;
      groups.set(key, g);
    }
    const counts = { create: results.filter((r) => r.action === 'create').length, update: results.filter((r) => r.action === 'update').length, error: results.filter((r) => r.action === 'error').length };
    const warnings = results.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.importJobRow.deleteMany({ where: { jobId: id } });
      for (let i = 0; i < results.length; i += 500) {
        await tx.importJobRow.createMany({ data: results.slice(i, i + 500).map((r) => ({ jobId: id, rowNo: r.rowNo, action: r.action, data: r.data as unknown as Prisma.InputJsonValue, issues: r.issues as unknown as Prisma.InputJsonValue })) });
      }
      await tx.importJob.update({
        where: { id },
        data: { status: 'previewed', mapping: input.mapping as Prisma.InputJsonValue, options: { mode: input.mode, createMissing: input.createMissing }, created: counts.create, updated: counts.update, errors: counts.error },
      });
    }, { timeout: 60_000 });

    const entries = [...new Set(results.filter((r) => r.action !== 'error').map((r) => (r.data.entryYear ? String(r.data.entryYear) : 'ไม่ทราบ')))].sort();
    return {
      counts, warnings, currentYear, entries,
      groups: [...groups.values()].sort((a, b) => a.department.localeCompare(b.department, 'th') || (a.level ?? '').localeCompare(b.level ?? '') || a.program.localeCompare(b.program, 'th')),
      newPrograms: [...newPrograms.values()],
      issues: results.flatMap((r) => r.issues.map((i) => ({ rowNo: r.rowNo, studentCode: r.data.studentCode, column: i.column, columnLabel: i.column === '_' ? '' : IMPORT_FIELDS[i.column as ImportField].label, message: i.message, level: i.level }))).slice(0, 2000),
      sample: results.filter((r) => r.action !== 'error').slice(0, 8).map((r) => ({ rowNo: r.rowNo, action: r.action, ...r.data })),
    };
  }

  /** บันทึกจริง — ทำได้ครั้งเดียวต่องาน (กันกดซ้ำ/สองแท็บ) */
  async commit(actor: AuthUser, id: string, ip: string) {
    const job = await this.loadJob(id, actor);
    const lock = await this.prisma.importJob.updateMany({ where: { id, status: 'previewed' }, data: { status: 'committing' } });
    if (lock.count === 0) throw new ConflictException(job.status === 'committed' ? 'นำเข้าไฟล์นี้ไปแล้ว' : 'ต้องตรวจข้อมูลก่อนยืนยัน');
    const options = job.options as { createMissing: boolean };
    try {
      const rows = await this.prisma.importJobRow.findMany({ where: { jobId: id, action: { in: ['create', 'update'] } }, orderBy: { rowNo: 'asc' } });
      const data = rows.map((r) => ({ action: r.action, s: r.data as unknown as RowResult['data'] }));

      // 1) สร้างแผนก/สาขาที่ยังไม่มี (ถ้าเลือกไว้)
      const programs = await this.prisma.program.findMany();
      const byKey = new Map(programs.map((p) => [programKeyOf(p.level, p.name), p.id]));
      const createdPrograms: string[] = [];
      for (const { s } of data) {
        if (byKey.has(s.programKey) || !options.createMissing || !s.level) continue;
        const deptName = `แผนกวิชา${normalizeOrgName(s.department || s.program)}`;
        const dept = await this.prisma.department.upsert({ where: { name: deptName }, update: {}, create: { name: deptName } });
        const prog = await this.prisma.program.upsert({
          where: { departmentId_name_level: { departmentId: dept.id, name: normalizeOrgName(s.program), level: s.level } },
          update: {}, create: { departmentId: dept.id, name: normalizeOrgName(s.program), level: s.level },
        });
        byKey.set(s.programKey, prog.id);
        createdPrograms.push(`${LEVEL_TH[s.level]} ${prog.name}`);
      }
      const curricula = new Map((await this.prisma.curriculum.findMany({ orderBy: { year: 'desc' } })).reverse().map((c) => [c.programId, c.id]));

      // 2) แฮชรหัสผ่านวันเกิดของนักเรียนใหม่ (ทำนอก transaction)
      const creates = data.filter((d) => d.action === 'create');
      const hashes = await pool(creates, 8, (d) => hashPassword(defaultStudentPassword(d.s.birthDate!)));
      const hashByCode = new Map(creates.map((d, i) => [d.s.studentCode, hashes[i]!]));

      // 3) บันทึกทีละชุด 200 แถว
      let created = 0;
      let updated = 0;
      for (let i = 0; i < data.length; i += 200) {
        await this.prisma.$transaction(async (tx) => {
          for (const { action, s } of data.slice(i, i + 200)) {
            const programId = byKey.get(s.programKey)!;
            const displayName = `${s.prefix}${s.firstName} ${s.lastName}`.trim();
            const fields = {
              prefix: s.prefix, firstName: s.firstName, lastName: s.lastName, programId, yearLevel: s.yearLevel!, entryYear: s.entryYear, entryTerm: s.entryYear ? 1 : null,
              ...(s.birthDate ? { birthDate: new Date(`${s.birthDate}T00:00:00Z`) } : {}),
              ...(s.groupNo ? { groupNo: s.groupNo } : {}), ...(s.phone ? { phone: s.phone } : {}), ...(s.nationalId ? { nationalId: s.nationalId } : {}),
              ...(s.fatherName ? { fatherName: s.fatherName } : {}), ...(s.motherName ? { motherName: s.motherName } : {}),
              ...(s.advisorUserId ? { advisorUserId: s.advisorUserId } : {}),
            };
            const entry = s.entryYear ?? entryYearFromCode(s.studentCode);
            if (action === 'create') {
              const user = await tx.user.create({ data: { username: s.studentCode, displayName, passwordHash: hashByCode.get(s.studentCode)!, mustChangePassword: true, roles: { create: [{ role: 'STUDENT' }] } } });
              const group = entry ? await this.registry.ensureGroup(tx, { programId, entryYear: entry, groupNo: s.groupNo || '1', yearLevel: s.yearLevel!, studentCodes: [s.studentCode] }) : null;
              await tx.student.create({ data: { ...fields, ...(group ? { yearLevel: group.yearLevel, groupNo: group.groupNo, classGroupId: group.id } : {}), studentCode: s.studentCode, userId: user.id, curriculumId: curricula.get(programId) ?? null } });
              created += 1;
            } else {
              // อยู่ในกลุ่มเรียนแล้ว: ชั้นปี/ห้อง/สาขามาจากกลุ่ม (เลื่อนชั้นแล้ว นำเข้าซ้ำต้องไม่ย้อนกลับ)
              const current = await tx.student.findUniqueOrThrow({ where: { studentCode: s.studentCode }, select: { classGroupId: true } });
              const { yearLevel: _y, groupNo: _g, programId: _p, ...keep } = fields as typeof fields & { groupNo?: string };
              const st = await tx.student.update({ where: { studentCode: s.studentCode }, data: current.classGroupId ? keep : fields });
              await tx.user.update({ where: { id: st.userId }, data: { displayName } });
              updated += 1;
            }
          }
        }, { timeout: 120_000 });
      }
      const summary = { ...(job.summary as object), createdPrograms };
      await this.prisma.importJob.update({ where: { id }, data: { status: 'committed', committedAt: new Date(), created, updated, summary } });
      await this.audit.log({ actorUserId: actor.id, action: 'import.students', entity: 'import', entityId: id, after: { fileName: job.fileName, created, updated, errorsSkipped: job.errors, createdPrograms }, ip });
      return { created, updated, skipped: job.errors, createdPrograms };
    } catch (e) {
      await this.prisma.importJob.update({ where: { id }, data: { status: 'failed', summary: { ...(job.summary as object), error: (e as Error).message.slice(0, 500) } } });
      throw e instanceof ConflictException || e instanceof BadRequestException ? e : new BadRequestException(`นำเข้าไม่สำเร็จ ไม่มีข้อมูลถูกบันทึกในชุดที่ผิดพลาด: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  async history() {
    const jobs = await this.prisma.importJob.findMany({ where: { kind: 'student' }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, fileName: true, status: true, createdAt: true, committedAt: true, total: true, created: true, updated: true, errors: true, createdById: true } });
    const users = await this.prisma.user.findMany({ where: { id: { in: [...new Set(jobs.map((j) => j.createdById))] } }, select: { id: true, displayName: true } });
    const names = new Map(users.map((u) => [u.id, u.displayName]));
    return jobs.map((j) => ({ ...j, by: names.get(j.createdById) ?? '', createdAt: j.createdAt.toISOString(), committedAt: j.committedAt?.toISOString() ?? null }));
  }
}
