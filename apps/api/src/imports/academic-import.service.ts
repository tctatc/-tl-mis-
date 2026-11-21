import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  ACADEMIC_FIELDS, KIND_NEEDS_TERM, STAFF_KIND_LABEL, WORK_STATUS_LABEL, groupMatches, guessAcademicMapping, normalizeGrade, normalizeGroup, normalizeOrgName, normalizePrefix, orgKey,
  parseDay, parseLevel, parseStaffKind, parseTerm, parseTime, parseTimeRange, parseTpn, parseWorkStatus, parseYearLevel, splitThaiName, staffUsername, termLabel,
  type AcademicKind, type AcademicMapping, type Level,
} from '@csis/shared';
import { hashPassword } from '../auth/auth.service.js';
import type { AuthUser } from '../auth/decorators.js';
import { AuditService } from '../common/audit.service.js';
import { PrismaService, type Tx } from '../common/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { readSheet, type Cell } from './file-reader.js';

const LV: Record<Level, string> = { pvc: 'ปวช.', pvs: 'ปวส.' };
type Issue = { column: string; message: string; level: 'error' | 'warning' };
interface Row { rowNo: number; action: 'create' | 'update' | 'error'; key: string; data: Record<string, unknown>; issues: Issue[]; cells: string[] }
interface Program { id: string; name: string; level: Level; department: { name: string } }

const txt = (v: Cell | undefined) => (v === null || v === undefined ? '' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? v.slice(0, 10) : String(v).replace(/\s+/g, ' ').trim());
const code = (v: string) => v.replace(/\s+/g, '').replace(/\.0+$/, '');
const stripPrefix = (s: string) => s.replace(/^(นางสาว|นาง|นาย|ดร\.|ครู|อ\.|อาจารย์)\s*/, '').replace(/\s+/g, '');
export const classCode = (programId: string, year: number, group: string) => `${programId}:${year}:${group}`;
const classLabel = (p: { name: string; level: Level }, year: number, group: string) => `${LV[p.level]} ${p.name} ปี ${year}${group ? ` ห้อง ${group}` : ''}`;

/** ชื่อคอลัมน์ตัวอย่างที่แสดงหลังแปลง */
const SAMPLE_COLUMNS: Record<AcademicKind, string[]> = {
  plan: ['สาขา', 'ปี/ภาค', 'รหัสวิชา', 'ชื่อวิชา', 'ท-ป-น', 'หมวด'],
  schedule: ['ห้อง', 'วัน', 'เวลา', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'ครู'],
  grade: ['รหัสนักศึกษา', 'ชื่อ', 'ห้อง', 'รหัสวิชา', 'หน่วยกิต', 'เกรด'],
  staff: ['รหัส', 'ชื่อ-นามสกุล', 'ครู/บุคลากร', 'ตำแหน่ง', 'แผนก / สาขา', 'สถานะ'],
};
const DAY_TH = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

@Injectable()
export class AcademicImportService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async upload(actor: AuthUser, kind: AcademicKind, file: { buffer: Buffer; originalname: string }) {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const sheet = await readSheet(file.buffer, name);
    const job = await this.prisma.importJob.create({
      data: { kind, fileName: name.slice(0, 200), createdById: actor.id, headers: sheet.headers, rawRows: sheet.rows as Prisma.InputJsonValue, total: sheet.rows.length, summary: { headerRowNo: sheet.headerRowNo, encoding: sheet.encoding ?? null } },
    });
    return { jobId: job.id, fileName: job.fileName, headers: sheet.headers, rowCount: sheet.rows.length, headerRowNo: sheet.headerRowNo, encoding: sheet.encoding ?? null, sample: sheet.rows.slice(0, 5), mapping: guessAcademicMapping(kind, sheet.headers) };
  }

  private async job(id: string, kind: AcademicKind, actor: AuthUser) {
    const job = await this.prisma.importJob.findUnique({ where: { id } });
    if (!job || job.kind !== kind || (job.createdById !== actor.id && !actor.roles.includes('SUPER_ADMIN'))) throw new NotFoundException('ไม่พบงานนำเข้า');
    return job;
  }

  // ---------------- ตัวช่วยร่วม ----------------
  private async programs() {
    const list = await this.prisma.program.findMany({ include: { department: true } }) as Program[];
    const byName = new Map<string, Program[]>();
    for (const p of list) byName.set(orgKey(p.name), [...(byName.get(orgKey(p.name)) ?? []), p]);
    return {
      list,
      /** สาขา + ระดับจากไฟล์ → สาขาในระบบ (ระดับไม่มี = ใช้ได้ถ้าชื่อนี้มีระดับเดียว) */
      resolve(programText: string, levelText: string): { program?: Program; error?: string } {
        const name = normalizeOrgName(programText);
        if (!name) return { error: 'ไม่มีสาขาวิชา' };
        const same = byName.get(orgKey(name)) ?? [];
        const lv = parseLevel(levelText).level;
        const hit = lv ? same.find((p) => p.level === lv) : same.length === 1 ? same[0] : undefined;
        if (hit) return { program: hit };
        if (!same.length) return { error: `ไม่พบสาขา "${name}" ในระบบ (เพิ่มสาขาจากการนำเข้านักเรียนก่อน)` };
        return { error: lv ? `ไม่พบสาขา "${LV[lv]} ${name}"` : `สาขา "${name}" มีทั้ง ปวช./ปวส. — เพิ่มคอลัมน์ระดับ` };
      },
    };
  }

  /** ห้องเรียนจริงจากทะเบียนนักเรียน: (สาขา, ชั้นปี) → รายชื่อห้องและจำนวนนักเรียน */
  private async classes() {
    const rows = await this.prisma.student.groupBy({ by: ['programId', 'yearLevel', 'groupNo'], where: { deletedAt: null, status: { in: ['studying', 'on_leave'] } }, _count: true });
    return {
      match(programId: string, year: number, fileGroup: string) {
        const inYear = rows.filter((r) => r.programId === programId && r.yearLevel === year);
        const hit = inYear.find((r) => groupMatches(fileGroup, r.groupNo));
        return { group: hit?.groupNo ?? normalizeGroup(fileGroup), students: hit?._count ?? 0, known: inYear.map((r) => r.groupNo) };
      },
    };
  }

  private async subjectMap(codes: string[]) {
    const subjects = await this.prisma.subject.findMany({ where: { code: { in: [...new Set(codes)] } } });
    return new Map(subjects.map((s) => [s.code, s]));
  }

  /** หน่วยกิตจากคอลัมน์ ท-ป-น หรือแยก 3 ช่อง */
  private numbers(row: Cell[], m: AcademicMapping) {
    const tpn = m.tpn !== undefined ? parseTpn(txt(row[m.tpn])) : null;
    if (tpn) return tpn;
    const n = (k: string) => (m[k] !== undefined && txt(row[m[k]!]) !== '' ? Number(txt(row[m[k]!])) : NaN);
    const t = n('theory'); const p = n('practice'); const c = n('credits');
    return Number.isFinite(c) ? { theory: Number.isFinite(t) ? t : 0, practice: Number.isFinite(p) ? p : 0, credits: c } : null;
  }

  // ---------------- ตรวจข้อมูล ----------------
  async preview(actor: AuthUser, kind: AcademicKind, id: string, input: { mapping: AcademicMapping; termId?: string }) {
    const job = await this.job(id, kind, actor);
    if (job.status === 'committed' || job.status === 'committing') throw new ConflictException('นำเข้าไฟล์นี้ไปแล้ว');
    const headers = job.headers as string[];
    for (const [f, info] of Object.entries(ACADEMIC_FIELDS[kind])) {
      if (info.required && input.mapping[f] === undefined) {
        if (kind === 'plan' && f === 'subjectName') continue; // ชื่อวิชาไม่ต้องมีถ้าวิชามีในระบบแล้ว (ตรวจรายแถว)
        throw new BadRequestException(`ต้องเลือกคอลัมน์ “${info.label}”`);
      }
    }
    for (const i of Object.values(input.mapping)) if (i < 0 || i >= headers.length) throw new BadRequestException('คอลัมน์ไม่ถูกต้อง');
    if (kind === 'staff' && input.mapping.name === undefined && input.mapping.firstName === undefined) {
      throw new BadRequestException('ต้องเลือกคอลัมน์ “ชื่อ-นามสกุล” หรือ “ชื่อ”');
    }
    if (kind === 'schedule' && input.mapping.time === undefined && (input.mapping.startTime === undefined || input.mapping.endTime === undefined)) {
      throw new BadRequestException('ต้องเลือกคอลัมน์ “เวลา (ช่วง)” หรือ “เวลาเริ่ม” + “เวลาเลิก”');
    }
    let term: { id: string; year: number; term: number } | null = null;
    if (KIND_NEEDS_TERM[kind]) {
      if (!input.termId) throw new BadRequestException('เลือกภาคเรียน');
      const found = await this.prisma.academicTerm.findUnique({ where: { id: input.termId } });
      if (!found) throw new BadRequestException('ไม่พบภาคเรียน');
      // ภาคปัจจุบันครูกรอกเกรดเองในเมนู "กรอกเกรด" — นำเข้าที่นี่ได้เฉพาะผลการเรียนย้อนหลัง (ยกมาจาก ศธ.02)
      if (kind === 'grade' && found.isCurrent) throw new BadRequestException('ภาคเรียนปัจจุบันให้ครูผู้สอนกรอกเกรดเองในเมนู "กรอกเกรด" — ที่นี่นำเข้าได้เฉพาะผลการเรียนของภาคที่ผ่านมาแล้ว');
      term = found;
    }

    const raw = job.rawRows as Cell[][];
    const headerRowNo = ((job.summary as { headerRowNo?: number } | null)?.headerRowNo) ?? 1;
    const rows = kind === 'plan' ? await this.previewPlan(raw, input.mapping, headerRowNo)
      : kind === 'staff' ? await this.previewStaff(raw, input.mapping, headerRowNo)
      : kind === 'schedule' ? await this.previewSchedule(raw, input.mapping, headerRowNo, term!)
      : await this.previewGrade(raw, input.mapping, headerRowNo, term!);

    const groups = new Map<string, { label: string; count: number; note: string; warn: boolean }>();
    for (const r of rows) {
      if (r.action === 'error') continue;
      const label = String(r.data.groupLabel ?? '');
      const g = groups.get(label) ?? { label, count: 0, note: String(r.data.groupNote ?? ''), warn: !!r.data.groupWarn };
      g.count += 1;
      groups.set(label, g);
    }
    const counts = { create: rows.filter((r) => r.action === 'create').length, update: rows.filter((r) => r.action === 'update').length, error: rows.filter((r) => r.action === 'error').length };

    await this.prisma.$transaction(async (tx) => {
      await tx.importJobRow.deleteMany({ where: { jobId: id } });
      for (let i = 0; i < rows.length; i += 500) {
        await tx.importJobRow.createMany({ data: rows.slice(i, i + 500).map((r) => ({ jobId: id, rowNo: r.rowNo, action: r.action, data: r.data as Prisma.InputJsonValue, issues: r.issues as unknown as Prisma.InputJsonValue })) });
      }
      await tx.importJob.update({ where: { id }, data: { status: 'previewed', mapping: input.mapping, options: { termId: input.termId ?? null }, created: counts.create, updated: counts.update, errors: counts.error } });
    }, { timeout: 60_000 });

    const labels = ACADEMIC_FIELDS[kind] as Record<string, { label: string }>;
    return {
      counts, warnings: rows.reduce((n, r) => n + r.issues.filter((i) => i.level === 'warning').length, 0),
      term: term ? termLabel(term.year, term.term) : null,
      groups: [...groups.values()].sort((a, b) => a.label.localeCompare(b.label, 'th')),
      issues: rows.flatMap((r) => r.issues.map((i) => ({ rowNo: r.rowNo, key: r.key, columnLabel: labels[i.column]?.label ?? '', message: i.message, level: i.level }))).slice(0, 2000),
      sample: { columns: SAMPLE_COLUMNS[kind], rows: rows.filter((r) => r.action !== 'error').slice(0, 10).map((r) => ({ rowNo: r.rowNo, action: r.action, cells: r.cells })) },
    };
  }

  private async previewPlan(raw: Cell[][], m: AcademicMapping, headerRowNo: number): Promise<Row[]> {
    const programs = await this.programs();
    const subjects = await this.subjectMap(raw.map((r) => code(txt(r[m.subjectCode!]))));
    const curricula = await this.prisma.curriculum.findMany({ include: { items: { include: { subject: true } } }, orderBy: { year: 'desc' } });
    const seen = new Map<string, number>();
    return raw.map((r, i): Row => {
      const rowNo = headerRowNo + 1 + i;
      const issues: Issue[] = [];
      const err = (column: string, message: string) => issues.push({ column, message, level: 'error' });
      const { program, error } = programs.resolve(txt(r[m.program!]), m.level !== undefined ? txt(r[m.level]) : '');
      if (error) err('program', error);
      const year = parseYearLevel(txt(r[m.yearLevel!]));
      if (!year) err('yearLevel', `ชั้นปี "${txt(r[m.yearLevel!])}" ไม่ถูกต้อง`);
      const term = parseTerm(txt(r[m.term!]));
      if (!term) err('term', `ภาคเรียน "${txt(r[m.term!])}" ไม่ถูกต้อง`);
      const subjectCode = code(txt(r[m.subjectCode!]));
      if (!subjectCode) err('subjectCode', 'ไม่มีรหัสวิชา');
      const existing = subjects.get(subjectCode);
      const name = m.subjectName !== undefined ? txt(r[m.subjectName]) : '';
      if (!name && !existing) err('subjectName', 'วิชาใหม่ต้องมีชื่อวิชา');
      const nums = this.numbers(r, m) ?? (existing ? { theory: existing.theory, practice: existing.practice, credits: existing.credits } : null);
      if (!nums) err('tpn', 'ไม่รู้หน่วยกิต (ใส่ ท-ป-น หรือ หน่วยกิต)');
      const category = m.category !== undefined ? txt(r[m.category]) : '';
      const key = `${program?.id}:${subjectCode}`;
      if (program && subjectCode) { const d = seen.get(key); if (d) err('subjectCode', `วิชาซ้ำในสาขาเดียวกับแถวที่ ${d}`); else seen.set(key, rowNo); }
      const cur = program ? curricula.find((c) => c.programId === program.id) : undefined;
      const inPlan = cur?.items.some((it) => it.subject.code === subjectCode);
      const action = issues.some((x) => x.level === 'error') ? 'error' : inPlan ? 'update' : 'create';
      return {
        rowNo, action, key: subjectCode, issues,
        data: { programId: program?.id, year, term, subjectCode, name: name || existing?.name, ...nums, category, groupLabel: program ? `${LV[program.level]} ${program.name}` : '', groupNote: cur ? cur.name : 'จะสร้างหลักสูตรใหม่ให้สาขานี้', groupWarn: !cur },
        cells: [program ? `${LV[program.level]} ${program.name}` : '', `${year ?? '?'}/${term ?? '?'}`, subjectCode, name || existing?.name || '', nums ? `${nums.theory}-${nums.practice}-${nums.credits}` : '', category],
      };
    });
  }

  private async previewSchedule(raw: Cell[][], m: AcademicMapping, headerRowNo: number, term: { id: string }): Promise<Row[]> {
    const programs = await this.programs();
    const classes = await this.classes();
    const subjects = await this.subjectMap(raw.map((r) => code(txt(r[m.subjectCode!]))));
    const staff = await this.prisma.user.findMany({ where: { deletedAt: null, roles: { some: { role: { not: 'STUDENT' } } } }, select: { id: true, displayName: true } });
    const sections = await this.prisma.courseSection.findMany({ where: { termId: term.id }, select: { groupCode: true, subject: { select: { code: true } } } });
    const existingSec = new Set(sections.map((s) => `${s.groupCode}|${s.subject.code}`));
    const slots = new Map<string, number>();
    return raw.map((r, i): Row => {
      const rowNo = headerRowNo + 1 + i;
      const issues: Issue[] = [];
      const err = (column: string, message: string) => issues.push({ column, message, level: 'error' });
      const warn = (column: string, message: string) => issues.push({ column, message, level: 'warning' });
      const { program, error } = programs.resolve(txt(r[m.program!]), m.level !== undefined ? txt(r[m.level]) : '');
      if (error) err('program', error);
      const year = parseYearLevel(txt(r[m.yearLevel!]));
      if (!year) err('yearLevel', `ชั้นปี "${txt(r[m.yearLevel!])}" ไม่ถูกต้อง`);
      const fileGroup = txt(r[m.groupNo!]);
      let group = normalizeGroup(fileGroup);
      let students = 0;
      if (program && year) {
        const cls = classes.match(program.id, year, fileGroup);
        group = cls.group; students = cls.students;
        if (!students) warn('groupNo', `ไม่มีนักเรียนในห้อง "${fileGroup}" ของ ${LV[program.level]} ${program.name} ปี ${year}${cls.known.length ? ` (ห้องที่มี: ${cls.known.join(', ')})` : ''}`);
      }
      const day = parseDay(txt(r[m.day!]));
      if (!day) err('day', `อ่านวัน "${txt(r[m.day!])}" ไม่ได้`);
      const range = m.time !== undefined ? parseTimeRange(txt(r[m.time])) : (() => {
        const a = parseTime(txt(r[m.startTime!])); const b = parseTime(txt(r[m.endTime!]));
        return a && b && a < b ? [a, b] as [string, string] : null;
      })();
      if (!range) err('time', 'อ่านเวลาไม่ได้ (เช่น 08.00-10.00)');
      const subjectCode = code(txt(r[m.subjectCode!]));
      const existing = subjects.get(subjectCode);
      const name = m.subjectName !== undefined ? txt(r[m.subjectName]) : '';
      if (!subjectCode) err('subjectCode', 'ไม่มีรหัสวิชา');
      else if (!existing && !name) err('subjectName', `วิชา ${subjectCode} ยังไม่มีในระบบ — ใส่ชื่อวิชา หรือนำเข้าแผนการเรียนก่อน`);
      const nums = existing ? null : this.numbers(r, m);
      const teacherText = m.teacher !== undefined ? txt(r[m.teacher]) : '';
      const teacher = teacherText ? staff.filter((s) => stripPrefix(s.displayName) === stripPrefix(teacherText)) : [];
      if (teacherText && teacher.length !== 1) warn('teacher', `ไม่พบบัญชีครู "${teacherText}" — แสดงเป็นชื่อตามไฟล์`);
      const cc = program && year ? classCode(program.id, year, group) : '';
      if (cc && day && range) {
        const slot = `${cc}|${day}|${range[0]}`;
        const d = slots.get(slot);
        if (d) err('time', `ห้องนี้มีคาบเวลาเดียวกันแล้วที่แถว ${d}`); else slots.set(slot, rowNo);
      }
      const action = issues.some((x) => x.level === 'error') ? 'error' : existingSec.has(`${cc}|${subjectCode}`) ? 'update' : 'create';
      const label = program && year ? classLabel(program, year, group) : '';
      return {
        rowNo, action, key: subjectCode, issues,
        data: { programId: program?.id, year, group, classCode: cc, day, start: range?.[0], end: range?.[1], subjectCode, name: name || existing?.name, nums, room: m.room !== undefined ? txt(r[m.room]) : '', teacherUserId: teacher.length === 1 ? teacher[0]!.id : null, teacherName: teacherText, groupLabel: label, groupNote: `นักเรียน ${students} คน`, groupWarn: !students },
        cells: [label, day ? DAY_TH[day]! : '', range ? `${range[0]}–${range[1]}` : '', subjectCode, name || existing?.name || '', m.room !== undefined ? txt(r[m.room]) : '', teacherText],
      };
    });
  }

  /** ครู/บุคลากร: จับคู่ด้วยรหัสบุคลากร (มีแล้ว = อัปเดต) · แผนก/สาขาไม่พบ = เตือน แต่ยังนำเข้าได้ */
  private async previewStaff(raw: Cell[][], m: AcademicMapping, headerRowNo: number): Promise<Row[]> {
    const t = (r: Cell[], f: string) => (m[f] !== undefined ? txt(r[m[f]!]) : '');
    const [departments, programs, profiles, users] = await Promise.all([
      this.prisma.department.findMany(),
      this.prisma.program.findMany({ include: { department: true } }),
      this.prisma.staffProfile.findMany({ select: { staffCode: true, userId: true } }),
      this.prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, username: true, staffProfile: { select: { staffCode: true } }, roles: { select: { role: true } } } }),
    ]);
    const deptByKey = new Map(departments.map((d) => [orgKey(d.name), d]));
    const progByKey = new Map<string, typeof programs>();
    for (const p of programs) progByKey.set(orgKey(p.name), [...(progByKey.get(orgKey(p.name)) ?? []), p]);
    const profileByCode = new Map(profiles.filter((p) => p.staffCode).map((p) => [p.staffCode!.toLowerCase(), p.userId]));
    const userByName = new Map(users.map((u) => [u.username, u]));
    const seen = new Map<string, number>();
    return raw.map((r, i): Row => {
      const rowNo = headerRowNo + 1 + i;
      const issues: Issue[] = [];
      const err = (column: string, message: string) => issues.push({ column, message, level: 'error' });
      const warn = (column: string, message: string) => issues.push({ column, message, level: 'warning' });
      const staffCode = txt(r[m.staffCode!]).replace(/\s+/g, '');
      if (!staffCode) err('staffCode', 'ไม่มีรหัสบุคลากร');
      else if (staffCode.length > 40) err('staffCode', 'รหัสยาวเกิน 40 ตัว');
      const k = staffCode.toLowerCase();
      const dup = seen.get(k); if (k && dup) err('staffCode', `รหัสซ้ำกับแถวที่ ${dup}`); else if (k) seen.set(k, rowNo);

      const split = m.name !== undefined ? splitThaiName(t(r, 'name')) : { prefix: '', firstName: '', lastName: '' };
      const prefix = (t(r, 'prefix') ? normalizePrefix(t(r, 'prefix')) : split.prefix).slice(0, 20);
      const firstName = (t(r, 'firstName') || split.firstName).slice(0, 80);
      const lastName = (t(r, 'lastName') || split.lastName).slice(0, 80);
      if (!firstName) err(m.name !== undefined ? 'name' : 'firstName', 'ไม่มีชื่อ');

      const position = t(r, 'position').slice(0, 100);
      const kind = parseStaffKind(t(r, 'kind'), position);
      const statusText = t(r, 'status');
      const workStatus = parseWorkStatus(statusText);
      if (!workStatus) err('status', `ไม่รู้จักสถานะ "${statusText}" (ใช้ ปฏิบัติงาน / ลา / ย้าย / เกษียณ / ลาออก)`);
      const email = t(r, 'email');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err('email', `อีเมล "${email}" ไม่ถูกต้อง`);
      const phone = t(r, 'phone').replace(/[^\d-]/g, '').slice(0, 15);

      // แผนก: ชื่อตรงกับแผนก/ประเภทวิชาในระบบ หรือชื่อตรงกับสาขา (ใช้แผนกของสาขานั้น)
      const deptText = t(r, 'department'); const progText = t(r, 'program');
      let departmentId: string | null = null; let programId: string | null = null; let orgLabel = '';
      const progHit = progText ? progByKey.get(orgKey(progText))?.[0] : undefined;
      if (progText && !progHit) warn('program', `ไม่พบสาขา "${normalizeOrgName(progText)}" ในระบบ — บันทึกโดยไม่ระบุสาขา`);
      if (progHit) { programId = progHit.id; departmentId = progHit.departmentId; orgLabel = `${progHit.department.name} / ${progHit.name}`; }
      if (deptText) {
        const d = deptByKey.get(orgKey(deptText));
        const viaProgram = d ? undefined : progByKey.get(orgKey(deptText))?.[0];
        if (d) { departmentId = d.id; orgLabel = progHit ? `${d.name} / ${progHit.name}` : d.name; }
        else if (viaProgram) { departmentId = viaProgram.departmentId; programId ??= viaProgram.id; orgLabel = `${viaProgram.department.name} / ${viaProgram.name}`; }
        else warn('department', `ไม่พบแผนก "${normalizeOrgName(deptText)}" ในระบบ — บันทึกโดยไม่ระบุแผนก`);
      }

      // มีโปรไฟล์รหัสนี้แล้ว = อัปเดต · ชื่อผู้ใช้ตรงกับบัญชีเดิมที่ยังไม่มีโปรไฟล์ = ผูกกับบัญชีนั้น
      const existingUserId = profileByCode.get(k);
      const username = staffUsername(staffCode);
      const sameUser = username ? userByName.get(username) : undefined;
      if (!existingUserId && sameUser) {
        if (sameUser.roles.some((x) => x.role === 'STUDENT')) err('staffCode', `ชื่อผู้ใช้ "${username}" เป็นบัญชีนักเรียน — ใช้รหัสอื่น`);
        else if (sameUser.staffProfile) err('staffCode', `ชื่อผู้ใช้ "${username}" ผูกกับบุคลากรรหัส ${sameUser.staffProfile.staffCode ?? '-'} แล้ว`);
        else warn('staffCode', `ผูกกับบัญชีผู้ใช้ "${username}" ที่มีอยู่แล้ว`);
      }
      const action = issues.some((x) => x.level === 'error') ? 'error' : existingUserId || sameUser ? 'update' : 'create';
      return {
        rowNo, action, key: staffCode, issues,
        data: { staffCode, username, linkUserId: existingUserId ?? sameUser?.id ?? null, prefix, firstName, lastName, kind, positionTitle: position, employment: t(r, 'employment').slice(0, 100),
          departmentId, programId, workStatus, phone, email: email.slice(0, 120), groupLabel: orgLabel || 'ไม่ระบุแผนก', groupNote: '', groupWarn: !orgLabel },
        cells: [staffCode, `${prefix}${firstName} ${lastName}`.trim(), STAFF_KIND_LABEL[kind], position, orgLabel || '–', workStatus ? WORK_STATUS_LABEL[workStatus] : statusText],
      };
    });
  }

  private async previewGrade(raw: Cell[][], m: AcademicMapping, headerRowNo: number, term: { id: string }): Promise<Row[]> {
    const codes = raw.map((r) => code(txt(r[m.studentCode!])));
    const students = new Map((await this.prisma.student.findMany({ where: { studentCode: { in: codes } }, include: { program: true } })).map((s) => [s.studentCode, s]));
    const subjects = await this.subjectMap(raw.map((r) => code(txt(r[m.subjectCode!]))));
    const existingGrades = await this.prisma.gradeRecord.findMany({
      where: { student: { studentCode: { in: codes } }, section: { termId: term.id } },
      select: { grade: true, status: true, student: { select: { studentCode: true } }, section: { select: { subject: { select: { code: true } } } } },
    });
    const gradeOf = new Map(existingGrades.map((g) => [`${g.student.studentCode}|${g.section.subject.code}`, g]));
    const seen = new Map<string, number>();
    return raw.map((r, i): Row => {
      const rowNo = headerRowNo + 1 + i;
      const issues: Issue[] = [];
      const err = (column: string, message: string) => issues.push({ column, message, level: 'error' });
      const warn = (column: string, message: string) => issues.push({ column, message, level: 'warning' });
      const studentCode = code(txt(r[m.studentCode!]));
      const st = students.get(studentCode);
      if (!studentCode) err('studentCode', 'ไม่มีรหัสนักศึกษา');
      else if (!st) err('studentCode', `ไม่พบนักเรียนรหัส ${studentCode} ในระบบ`);
      const nameText = m.studentName !== undefined ? txt(r[m.studentName]) : '';
      if (st && nameText && !stripPrefix(nameText).includes(st.firstName.replace(/\s+/g, ''))) warn('studentName', `ชื่อในไฟล์ "${nameText}" ไม่ตรงกับทะเบียน (${st.prefix}${st.firstName} ${st.lastName}) — ตรวจรหัส`);
      const subjectCode = code(txt(r[m.subjectCode!]));
      const subject = subjects.get(subjectCode);
      const name = m.subjectName !== undefined ? txt(r[m.subjectName]) : '';
      const nums = subject ? null : this.numbers(r, m);
      if (!subjectCode) err('subjectCode', 'ไม่มีรหัสวิชา');
      else if (!subject && (!name || !nums)) err('subjectCode', `วิชา ${subjectCode} ยังไม่มีในระบบ — ใส่ชื่อวิชาและหน่วยกิต หรือนำเข้าแผนการเรียนก่อน`);
      const grade = normalizeGrade(txt(r[m.grade!]));
      if (!grade) err('grade', `เกรด "${txt(r[m.grade!])}" ไม่ถูกต้อง (ใช้ 4 3.5 3 2.5 2 1.5 1 0 ร มส ขร ผ มผ)`);
      const k = `${studentCode}|${subjectCode}`;
      const d = seen.get(k); if (d) err('subjectCode', `ซ้ำกับแถวที่ ${d}`); else seen.set(k, rowNo);
      const prev = gradeOf.get(k);
      if (prev?.status === 'published' && grade && prev.grade !== grade) err('grade', `ประกาศผลไปแล้ว (${prev.grade}) — แก้เกรดที่ประกาศแล้วต้องผ่านคำร้องขอแก้ไขผลการเรียน`);
      const action = issues.some((x) => x.level === 'error') ? 'error' : prev ? 'update' : 'create';
      const label = st ? classLabel(st.program, st.yearLevel, st.groupNo) : '';
      return {
        rowNo, action, key: studentCode, issues,
        data: { studentId: st?.id, subjectCode, name, nums, grade, unchanged: prev?.status === 'published' && prev.grade === grade, groupLabel: label, groupNote: '', groupWarn: false },
        cells: [studentCode, st ? `${st.prefix}${st.firstName} ${st.lastName}` : nameText, st ? `ปี ${st.yearLevel} ห้อง ${st.groupNo}` : '', subjectCode, String(subject?.credits ?? nums?.credits ?? ''), grade ?? ''],
      };
    });
  }

  // ---------------- บันทึก ----------------
  async commit(actor: AuthUser, kind: AcademicKind, id: string, ip: string) {
    const job = await this.job(id, kind, actor);
    const lock = await this.prisma.importJob.updateMany({ where: { id, status: 'previewed' }, data: { status: 'committing' } });
    if (lock.count === 0) throw new ConflictException(job.status === 'committed' ? 'นำเข้าไฟล์นี้ไปแล้ว' : 'ต้องตรวจข้อมูลก่อนยืนยัน');
    try {
      const rows = (await this.prisma.importJobRow.findMany({ where: { jobId: id, action: { in: ['create', 'update'] } }, orderBy: { rowNo: 'asc' } })).map((r) => r.data as Record<string, unknown>);
      const termId = (job.options as { termId?: string } | null)?.termId ?? null;
      const result = kind === 'plan' ? await this.commitPlan(rows) : kind === 'staff' ? await this.commitStaff(rows) : kind === 'schedule' ? await this.commitSchedule(rows, termId!) : await this.commitGrade(rows, termId!);
      await this.prisma.importJob.update({ where: { id }, data: { status: 'committed', committedAt: new Date(), summary: { ...(job.summary as object), result } } });
      await this.audit.log({ actorUserId: actor.id, action: `import.${kind}`, entity: 'import', entityId: id, after: { fileName: job.fileName, ...result }, ip });
      return result;
    } catch (e) {
      await this.prisma.importJob.update({ where: { id }, data: { status: 'failed', summary: { ...(job.summary as object), error: (e as Error).message.slice(0, 500) } } });
      throw e instanceof ConflictException ? e : new BadRequestException(`นำเข้าไม่สำเร็จ ไม่มีข้อมูลถูกบันทึก: ${(e as Error).message.slice(0, 200)}`);
    }
  }

  /** บัญชีใหม่ของบุคลากรเริ่มเป็น "ระงับ" — ผู้ดูแลเปิดใช้และตั้งรหัสชั่วคราวให้ทีละคนจากหน้าผู้ใช้งาน */
  private async commitStaff(rows: Record<string, unknown>[]) {
    const lockedHash = await hashPassword(randomBytes(24).toString('base64url'));
    return this.prisma.$transaction(async (tx) => {
      let created = 0; let updated = 0;
      const taken = new Set((await tx.user.findMany({ select: { username: true } })).map((u) => u.username));
      for (const r of rows) {
        const profile = {
          staffCode: String(r.staffCode), prefix: String(r.prefix ?? ''), firstName: String(r.firstName), lastName: String(r.lastName ?? ''),
          kind: r.kind as 'teacher' | 'support', positionTitle: String(r.positionTitle ?? ''), employment: String(r.employment ?? ''),
          departmentId: (r.departmentId as string | null) ?? null, programId: (r.programId as string | null) ?? null,
          workStatus: r.workStatus as 'active', phone: String(r.phone ?? ''), email: String(r.email ?? ''),
        };
        const displayName = `${profile.prefix}${profile.firstName} ${profile.lastName}`.trim();
        let userId = (r.linkUserId as string | null) ?? null;
        if (userId) {
          await tx.staffProfile.upsert({ where: { userId }, create: { userId, ...profile }, update: profile });
          await tx.user.update({ where: { id: userId }, data: { displayName } });
          updated++;
          continue;
        }
        let username = (r.username as string | null) ?? `staff-${profile.staffCode.toLowerCase().replace(/[^a-z0-9]/g, '') || randomBytes(3).toString('hex')}`;
        for (let n = 2; taken.has(username); n++) username = `${(r.username as string | null) ?? 'staff'}-${n}`;
        taken.add(username);
        const user = await tx.user.create({
          data: { username, displayName, passwordHash: lockedHash, status: 'SUSPENDED', mustChangePassword: true,
            ...(profile.kind === 'teacher' ? { roles: { create: [{ role: 'TEACHER' }] } } : {}) },
        });
        await tx.staffProfile.create({ data: { userId: user.id, ...profile } });
        created++;
      }
      return { created, updated };
    }, { timeout: 120_000 });
  }

  private async upsertSubject(tx: Tx, codeStr: string, name: unknown, nums: unknown) {
    const n = nums as { theory: number; practice: number; credits: number } | null;
    const existing = await tx.subject.findUnique({ where: { code: codeStr } });
    if (existing) {
      if (n || name) await tx.subject.update({ where: { id: existing.id }, data: { ...(name ? { name: String(name) } : {}), ...(n ?? {}) } });
      return existing.id;
    }
    const created = await tx.subject.create({ data: { code: codeStr, name: String(name ?? codeStr), theory: n?.theory ?? 0, practice: n?.practice ?? 0, credits: n?.credits ?? 0 } });
    return created.id;
  }

  private async commitPlan(rows: Record<string, unknown>[]) {
    return this.prisma.$transaction(async (tx) => {
      const curByProgram = new Map<string, string>();
      const currentYear = (await tx.academicTerm.findFirst({ where: { isCurrent: true } }))?.year ?? 2569;
      for (const r of rows) {
        const programId = String(r.programId);
        if (!curByProgram.has(programId)) {
          let cur = await tx.curriculum.findFirst({ where: { programId }, orderBy: { year: 'desc' } });
          if (!cur) {
            const p = await tx.program.findUniqueOrThrow({ where: { id: programId } });
            cur = await tx.curriculum.create({ data: { programId, year: currentYear, minCredits: 0, name: `หลักสูตร${p.level === 'pvc' ? 'ประกาศนียบัตรวิชาชีพ' : 'ประกาศนียบัตรวิชาชีพชั้นสูง'} สาขาวิชา${p.name}` } });
          }
          curByProgram.set(programId, cur.id);
        }
        const subjectId = await this.upsertSubject(tx, String(r.subjectCode), r.name, { theory: r.theory, practice: r.practice, credits: r.credits });
        const curriculumId = curByProgram.get(programId)!;
        await tx.studyPlanSubject.upsert({
          where: { curriculumId_subjectId: { curriculumId, subjectId } },
          update: { yearLevel: Number(r.year), term: Number(r.term), ...(r.category ? { category: String(r.category) } : {}) },
          create: { curriculumId, subjectId, yearLevel: Number(r.year), term: Number(r.term), category: String(r.category || 'ไม่ระบุหมวด') },
        });
      }
      let linked = 0;
      for (const [programId, curriculumId] of curByProgram) {
        const items = await tx.studyPlanSubject.findMany({ where: { curriculumId }, include: { subject: true } });
        await tx.curriculum.update({ where: { id: curriculumId }, data: { minCredits: items.reduce((s, it) => s + it.subject.credits, 0) } });
        linked += (await tx.student.updateMany({ where: { programId, curriculumId: null }, data: { curriculumId } })).count;
      }
      return { saved: rows.length, programs: curByProgram.size, studentsLinked: linked };
    }, { timeout: 120_000 });
  }

  private async commitSchedule(rows: Record<string, unknown>[], termId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sectionIds = new Map<string, string>(); // classCode|subject → section
      const touched = new Set<string>();
      let sessions = 0;
      for (const r of rows) {
        const subjectId = await this.upsertSubject(tx, String(r.subjectCode), r.name, r.nums);
        const key = `${r.classCode}|${r.subjectCode}`;
        let sectionId = sectionIds.get(key);
        if (!sectionId) {
          const sec = await tx.courseSection.upsert({
            where: { termId_subjectId_groupCode: { termId, subjectId, groupCode: String(r.classCode) } },
            update: { teacherUserId: (r.teacherUserId as string | null) ?? null, teacherName: String(r.teacherName ?? '') },
            create: { termId, subjectId, groupCode: String(r.classCode), programId: String(r.programId), yearLevel: Number(r.year), groupNo: String(r.group), teacherUserId: (r.teacherUserId as string | null) ?? null, teacherName: String(r.teacherName ?? '') },
          });
          sectionId = sec.id;
          sectionIds.set(key, sectionId);
          // ตารางของกลุ่มเรียนนี้แทนที่ด้วยไฟล์ใหม่ทั้งหมด
          await tx.classSchedule.deleteMany({ where: { sectionId } });
        }
        await tx.classSchedule.create({ data: { sectionId, dayOfWeek: Number(r.day), startTime: String(r.start), endTime: String(r.end), room: String(r.room ?? '') } });
        sessions += 1;
        touched.add(String(r.classCode));
      }
      // ลงทะเบียนให้นักเรียนทุกคนในห้องเรียนตามวิชาในตาราง
      let enrolled = 0;
      const studentsTouched = new Set<string>();
      for (const [key, sectionId] of sectionIds) {
        const [programId, year, group] = key.split('|')[0]!.split(':');
        const subjectId = (await tx.courseSection.findUniqueOrThrow({ where: { id: sectionId }, select: { subjectId: true } })).subjectId;
        const students = await tx.student.findMany({ where: { programId, yearLevel: Number(year), groupNo: group, deletedAt: null, status: { in: ['studying', 'on_leave'] } }, select: { id: true } });
        for (const s of students) {
          const reg = await tx.registration.upsert({ where: { studentId_termId: { studentId: s.id, termId } }, update: {}, create: { studentId: s.id, termId } });
          // ลงวิชาเดียวกันไว้คนละกลุ่มเรียน (ยังไม่มีเกรด) → ย้ายมากลุ่มตามตารางใหม่ ไม่ให้วิชาซ้ำ
          const other = await tx.registrationSubject.findFirst({ where: { registrationId: reg.id, sectionId: { not: sectionId }, section: { subjectId } } });
          if (other) {
            const graded = await tx.gradeRecord.count({ where: { studentId: s.id, sectionId: other.sectionId } });
            if (!graded) await tx.registrationSubject.delete({ where: { id: other.id } });
          }
          await tx.registrationSubject.upsert({ where: { registrationId_sectionId: { registrationId: reg.id, sectionId } }, update: { withdrawn: false }, create: { registrationId: reg.id, sectionId } });
          enrolled += 1;
          studentsTouched.add(s.id);
        }
      }
      return { sessions, sections: sectionIds.size, classes: touched.size, students: studentsTouched.size, enrolments: enrolled };
    }, { timeout: 180_000 });
  }

  private async commitGrade(rows: Record<string, unknown>[], termId: string) {
    return this.prisma.$transaction(async (tx) => {
      let saved = 0;
      let unchanged = 0;
      for (const r of rows) {
        if (r.unchanged) { unchanged += 1; continue; }
        const subjectId = await this.upsertSubject(tx, String(r.subjectCode), r.name || null, r.nums);
        const student = await tx.student.findUniqueOrThrow({ where: { id: String(r.studentId) } });
        // หากลุ่มเรียนที่นักเรียนลงไว้ในภาคนี้ ไม่มีก็สร้างตามห้องของนักเรียน
        let rs = await tx.registrationSubject.findFirst({ where: { registration: { studentId: student.id, termId }, section: { subjectId } } });
        if (!rs) {
          const cc = classCode(student.programId, student.yearLevel, student.groupNo);
          const sec = await tx.courseSection.upsert({
            where: { termId_subjectId_groupCode: { termId, subjectId, groupCode: cc } }, update: {},
            create: { termId, subjectId, groupCode: cc, programId: student.programId, yearLevel: student.yearLevel, groupNo: student.groupNo },
          });
          const reg = await tx.registration.upsert({ where: { studentId_termId: { studentId: student.id, termId } }, update: {}, create: { studentId: student.id, termId } });
          rs = await tx.registrationSubject.upsert({ where: { registrationId_sectionId: { registrationId: reg.id, sectionId: sec.id } }, update: {}, create: { registrationId: reg.id, sectionId: sec.id } });
        }
        // ผลย้อนหลังเข้าเป็น "อนุมัติแล้ว" แล้วไปประกาศที่กระดานส่งผล — ห้ามทับวิชาที่ครูกำลังกรอก/ส่ง
        const sec = await tx.courseSection.findUniqueOrThrow({ where: { id: rs.sectionId }, select: { gradeStatus: true, subject: { select: { code: true } } } });
        if (sec.gradeStatus === 'draft' || sec.gradeStatus === 'submitted' || sec.gradeStatus === 'returned') {
          throw new ConflictException(`วิชา ${sec.subject.code} ครูผู้สอนกำลังกรอกหรือส่งผลอยู่ — นำเข้าทับไม่ได้`);
        }
        const status = sec.gradeStatus === 'published' ? 'published' : 'approved';
        await tx.gradeRecord.upsert({
          where: { studentId_sectionId: { studentId: student.id, sectionId: rs.sectionId } },
          update: { grade: String(r.grade), status, publishedAt: status === 'published' ? new Date() : null },
          create: { studentId: student.id, sectionId: rs.sectionId, grade: String(r.grade), status, publishedAt: status === 'published' ? new Date() : null },
        });
        if (sec.gradeStatus === 'none') await tx.courseSection.update({ where: { id: rs.sectionId }, data: { gradeStatus: 'approved' } });
        saved += 1;
      }
      return { saved, unchanged };
    }, { timeout: 180_000 });
  }
}
