/**
 * ข้อมูลตั้งต้น: ตำแหน่งผู้ลงนาม (ชื่อตามที่พิมพ์ในแบบคำร้องของวิทยาลัย) + สาขาวิชาตามประกาศรับสมัคร 2570
 * SEED_DEMO=true เพิ่มบัญชีทดลอง (นักศึกษา 2 คน เจ้าหน้าที่ 5 คน) — ห้ามใช้บนเครื่องจริง
 * รันซ้ำได้ (upsert ทุกแถว)
 */
import { POSITIONS, defaultStudentPassword, type PositionKey, type Role } from '@csis/shared';
import { hashPassword } from './auth/auth.service.js';
import { PrismaService } from './common/prisma.service.js';
import { seedAcademic } from './seed-academic.js';

const prisma = new PrismaService();

const HOLDERS: Record<PositionKey, string> = {
  director: 'นายเฉลิมชนม์ เวทสรากุล',
  deputy_resources: 'นายวิศาล เพ็ชรมุณี',
  deputy_academic: 'นายโรมรัน ลาดเหลา',
  registrar_head: 'นายพรหม สอนมาลี',
  finance_head: 'นางวทันยา พลายละหาร',
  library_head: '',
  curriculum_head: 'นายสุรพัฒน์ คำจันทร์',
  discipline_head: '',
};

/**
 * สาขาวิชาตามประกาศรับสมัครโควตา ปีการศึกษา 2570 จัดกลุ่มตามประเภทวิชา
 * ทวิภาคีแยกเป็นสาขาของตัวเอง (เรียนคนละห้อง ฝึกงานในสถานประกอบการ)
 */
const PROGRAMS_2570: Record<string, { pvc: string[]; pvs: string[] }> = {
  'ประเภทวิชาอุตสาหกรรม': {
    pvc: ['ช่างยนต์', 'ยานยนต์ไฟฟ้า (ทวิภาคี)', 'ช่างกลโรงงาน', 'ช่างกลโรงงาน (ทวิภาคี)', 'ช่างซ่อมบำรุง', 'ช่างเชื่อมโลหะ (ทวิภาคี)', 'ช่างไฟฟ้า', 'อิเล็กทรอนิกส์', 'เมคคาทรอนิกส์และหุ่นยนต์ (ทวิภาคี)'],
    pvs: ['เทคนิคเครื่องกล (ทวิภาคี)', 'เทคนิคยานยนต์ไฟฟ้า (ทวิภาคี)', 'เทคนิคการผลิต', 'เทคนิคการผลิต (ทวิภาคี)', 'เทคนิคโลหะ (ทวิภาคี)', 'ไฟฟ้า', 'ไฟฟ้า (ทวิภาคี)', 'เทคโนโลยีอิเล็กทรอนิกส์', 'เทคนิคอุตสาหกรรม', 'เทคนิคอุตสาหกรรม (ทวิภาคี)', 'เมคคาทรอนิกส์และหุ่นยนต์ (ทวิภาคี)'],
  },
  'ประเภทวิชาอุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ': {
    pvc: ['ช่างเทคนิคคอมพิวเตอร์', 'เทคโนโลยีธุรกิจดิจิทัล'],
    pvs: ['เทคโนโลยีคอมพิวเตอร์', 'เทคโนโลยีธุรกิจดิจิทัล', 'เทคโนโลยีธุรกิจดิจิทัล (ทวิภาคี)', 'เทคโนโลยีสารสนเทศ'],
  },
  'ประเภทวิชาพาณิชยกรรม': {
    pvc: ['การบัญชี', 'การตลาด'],
    pvs: ['การบัญชี', 'การตลาด'],
  },
};

/**
 * ใส่สาขาตามประกาศ — สาขาที่มีอยู่แล้ว (ชื่อ+ระดับตรงกัน) ย้ายเข้ากลุ่มใหม่ ไม่สร้างซ้ำ นักเรียนที่ผูกไว้ไม่หลุด
 * สาขาเก่าที่ไม่อยู่ในประกาศ: ลบเฉพาะที่ไม่มีนักเรียน/แผนการเรียน/ตารางเรียนผูกอยู่ ที่เหลือเก็บไว้
 */
async function seedPrograms() {
  const listed = new Set<string>();
  for (const [deptName, byLevel] of Object.entries(PROGRAMS_2570)) {
    const dept = await prisma.department.upsert({ where: { name: deptName }, update: {}, create: { name: deptName } });
    for (const level of ['pvc', 'pvs'] as const) {
      for (const name of byLevel[level]) {
        listed.add(`${level}:${name}`);
        const existing = await prisma.program.findFirst({ where: { name, level } });
        if (existing) await prisma.program.update({ where: { id: existing.id }, data: { departmentId: dept.id } });
        else await prisma.program.create({ data: { departmentId: dept.id, name, level } });
      }
    }
  }
  const others = await prisma.program.findMany({
    include: { _count: { select: { students: true, curriculums: true, sections: true } } },
  });
  for (const p of others) {
    if (listed.has(`${p.level}:${p.name}`)) continue;
    if (p._count.students + p._count.curriculums + p._count.sections === 0) await prisma.program.delete({ where: { id: p.id } });
  }
  await prisma.department.deleteMany({ where: { programs: { none: {} } } });
}

async function upsertUser(username: string, displayName: string, password: string, roles: Role[], mustChangePassword: boolean) {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { username },
    update: { displayName, roles: { deleteMany: {}, create: roles.map((role) => ({ role })) } },
    create: { username, displayName, passwordHash, mustChangePassword, roles: { create: roles.map((role) => ({ role })) } },
  });
  return user;
}

async function main() {
  for (const [key, title] of Object.entries(POSITIONS)) {
    await prisma.position.upsert({ where: { key }, update: { title }, create: { key, title, holderName: HOLDERS[key as PositionKey] } });
  }
  await seedPrograms();
  console.log('✓ ตำแหน่งผู้ลงนาม และสาขาวิชาตามประกาศ 2570');

  if (process.env.SEED_DEMO !== 'true') return;
  if (process.env.NODE_ENV === 'production') throw new Error('ห้ามสร้างบัญชีทดลองบน production');

  const staffPassword = process.env.DEMO_STAFF_PASSWORD ?? 'Demo-2569';
  const staff: [string, string, Role[], PositionKey | null][] = [
    ['admin', 'ผู้ดูแลระบบ', ['SUPER_ADMIN'], null],
    ['registrar', HOLDERS.registrar_head, ['REGISTRAR'], 'registrar_head'],
    ['deputy', HOLDERS.deputy_resources, ['ADMIN'], 'deputy_resources'],
    ['director', HOLDERS.director, ['ADMIN'], 'director'],
    ['teacher', 'นางสาวสมใจ ใฝ่สอน', ['TEACHER', 'ADVISOR'], null],
    ['teacher2', 'นายวิชัย ช่างคิด', ['TEACHER'], null],
    ['teacher3', 'นางสุดา ตั้งใจสอน', ['TEACHER'], null],
  ];
  const ids: Record<string, string> = {};
  for (const [username, name, roles, position] of staff) {
    const user = await upsertUser(username, name, staffPassword, roles, false);
    ids[username] = user.id;
    if (position) await prisma.position.update({ where: { key: position }, data: { userId: user.id } });
  }

  const it = await prisma.program.findFirstOrThrow({ where: { name: 'เทคโนโลยีธุรกิจดิจิทัล', level: 'pvc' } });
  const power = await prisma.program.findFirstOrThrow({ where: { name: 'ไฟฟ้า', level: 'pvs' } });
  const students = [
    { studentCode: '67201010001', prefix: 'นาย', firstName: 'ทดลอง', lastName: 'ระบบดี', birthDate: '2008-11-01', programId: it.id, yearLevel: 2, groupNo: '1', fatherName: 'นายสมชาย ระบบดี', motherName: 'นางสมศรี ระบบดี', phone: '0812345678' },
    { studentCode: '68302020002', prefix: 'นางสาว', firstName: 'ตัวอย่าง', lastName: 'เรียนเก่ง', birthDate: '2006-03-15', programId: power.id, yearLevel: 1, groupNo: '2', fatherName: 'นายมานะ เรียนเก่ง', motherName: 'นางมานี เรียนเก่ง', phone: '0898765432' },
  ];
  for (const s of students) {
    const user = await upsertUser(s.studentCode, `${s.prefix}${s.firstName} ${s.lastName}`, defaultStudentPassword(s.birthDate), ['STUDENT'], true);
    const data = { ...s, birthDate: new Date(`${s.birthDate}T00:00:00Z`), advisorUserId: ids.teacher };
    await prisma.student.upsert({ where: { studentCode: s.studentCode }, update: data, create: { ...data, userId: user.id } });
  }
  // หัวหน้าสาขา (ลงความเห็นในคำร้องลาออก/กลับเข้าเรียน/ขอจบ)
  await prisma.program.updateMany({ where: { name: { in: ['เทคโนโลยีสารสนเทศ', 'เทคโนโลยีธุรกิจดิจิทัล'] } }, data: { headUserId: ids.teacher2 } });
  await prisma.program.updateMany({ where: { name: { in: ['ไฟฟ้า', 'ช่างไฟฟ้า'] } }, data: { headUserId: ids.teacher3 } });
  // ผู้ดำรงตำแหน่งที่เหลือ (บัญชีทดลอง): การเงิน ห้องสมุด หลักสูตร ปกครอง รองฝ่ายวิชาการ
  for (const [username, name, position] of [
    ['finance', HOLDERS.finance_head, 'finance_head'], ['library', 'นางสาวหนังสือ รักอ่าน', 'library_head'],
    ['curriculum', HOLDERS.curriculum_head, 'curriculum_head'], ['discipline', 'นายวินัย เคร่งครัด', 'discipline_head'],
    ['deputy2', HOLDERS.deputy_academic, 'deputy_academic'],
  ] as const) {
    const u = await upsertUser(username, name, staffPassword, ['TEACHER'], false);
    await prisma.position.update({ where: { key: position }, data: { userId: u.id, holderName: name } });
  }
  await seedAcademic(prisma, [ids.teacher!, ids.teacher2!, ids.teacher3!]);
  console.log('✓ หลักสูตร แผนการเรียน ตารางเรียน/สอบ ผลการเรียน และประวัติ (ตัวอย่าง)');
  console.log(`✓ บัญชีทดลอง — เจ้าหน้าที่: admin, registrar, deputy, director, teacher (รหัส ${staffPassword})`);
  console.log(`  นักศึกษา: ${students.map((s) => `${s.studentCode} / ${defaultStudentPassword(s.birthDate)}`).join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
