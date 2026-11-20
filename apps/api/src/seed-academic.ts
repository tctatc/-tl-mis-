/**
 * ข้อมูลตัวอย่างฝั่งการเรียน (เฉพาะ SEED_DEMO) — หลักสูตร แผนการเรียน กลุ่มเรียน ตารางเรียน/สอบ เกรด ประวัติ
 * รหัส/ชื่อวิชาเป็นตัวอย่างใกล้เคียงหลักสูตร สอศ. 2567 ไม่ใช่ข้อมูลจริงของวิทยาลัย — ของจริงนำเข้าผ่าน Import Center
 */
import type { PrismaService } from './common/prisma.service.js';

type Row = [yearLevel: number, term: number, code: string, name: string, t: number, p: number, c: number, category: string];
const CORE = 'หมวดสมรรถนะแกนกลาง';
const PRO = 'หมวดสมรรถนะวิชาชีพ';
const FREE = 'หมวดวิชาเลือกเสรี';
const ACT = 'กิจกรรมเสริมหลักสูตร';

const IT_PVC: Row[] = [
  [1, 1, '20000-1101', 'ภาษาไทยพื้นฐาน', 1, 0, 1, CORE], [1, 1, '20000-1201', 'ภาษาอังกฤษในชีวิตจริง', 0, 2, 1, CORE],
  [1, 1, '20000-1401', 'คณิตศาสตร์พื้นฐานอาชีพ', 2, 0, 2, CORE], [1, 1, '20204-2001', 'คอมพิวเตอร์และการบำรุงรักษา', 1, 3, 2, PRO],
  [1, 1, '20204-2002', 'ระบบปฏิบัติการเบื้องต้น', 1, 2, 2, PRO], [1, 1, '20204-2003', 'การเขียนโปรแกรมเบื้องต้น', 2, 2, 3, PRO],
  [1, 1, '20000-2001', 'กิจกรรมลูกเสือวิสามัญ 1', 0, 2, 0, ACT],
  [1, 2, '20000-1102', 'ภาษาไทยเพื่ออาชีพ', 1, 0, 1, CORE], [1, 2, '20000-1202', 'ภาษาอังกฤษสื่อสาร', 0, 2, 1, CORE],
  [1, 2, '20000-1301', 'วิทยาศาสตร์เพื่อพัฒนาทักษะชีวิต', 1, 2, 2, CORE], [1, 2, '20204-2004', 'คอมพิวเตอร์กราฟิก', 1, 2, 2, PRO],
  [1, 2, '20204-2005', 'เครือข่ายคอมพิวเตอร์เบื้องต้น', 1, 2, 2, PRO], [1, 2, '20204-2006', 'การเขียนโปรแกรมเชิงวัตถุ', 2, 2, 3, PRO],
  [1, 2, '20000-2002', 'กิจกรรมลูกเสือวิสามัญ 2', 0, 2, 0, ACT],
  [2, 1, '20000-1501', 'หน้าที่พลเมืองและศีลธรรม', 1, 0, 1, CORE], [2, 1, '20000-1601', 'สุขภาพและการพัฒนาบุคลิกภาพ', 0, 2, 1, CORE],
  [2, 1, '20000-1402', 'คณิตศาสตร์ประยุกต์', 2, 0, 2, CORE], [2, 1, '20204-2007', 'การพัฒนาเว็บไซต์', 1, 4, 3, PRO],
  [2, 1, '20204-2008', 'ระบบฐานข้อมูลเบื้องต้น', 2, 2, 3, PRO], [2, 1, '20204-2101', 'การออกแบบส่วนต่อประสานผู้ใช้', 1, 2, 2, PRO],
  [2, 1, '20000-2003', 'กิจกรรมองค์การวิชาชีพ 1', 0, 2, 0, ACT],
  [2, 2, '20000-1203', 'ภาษาอังกฤษเพื่อการทำงาน', 0, 2, 1, CORE], [2, 2, '20000-1302', 'วิทยาศาสตร์อุตสาหกรรม', 1, 2, 2, CORE],
  [2, 2, '20001-1001', 'การเป็นผู้ประกอบการ', 1, 2, 2, CORE], [2, 2, '20204-2102', 'การพัฒนาโปรแกรมบนอุปกรณ์เคลื่อนที่', 1, 4, 3, PRO],
  [2, 2, '20204-2103', 'การจัดการเครือข่าย', 1, 4, 3, PRO], [2, 2, '20204-2104', 'ความปลอดภัยของระบบสารสนเทศ', 1, 2, 2, PRO],
  [2, 2, '20000-2004', 'กิจกรรมองค์การวิชาชีพ 2', 0, 2, 0, ACT],
  [3, 1, '20001-1002', 'พลังงาน ทรัพยากร และสิ่งแวดล้อม', 1, 0, 1, CORE], [3, 1, '20204-2105', 'การพัฒนาเว็บแอปพลิเคชัน', 1, 4, 3, PRO],
  [3, 1, '20204-2106', 'อินเทอร์เน็ตของสรรพสิ่งเบื้องต้น', 1, 4, 3, PRO], [3, 1, '20204-8001', 'ฝึกงาน', 0, 0, 4, PRO],
  [3, 1, '20000-2005', 'กิจกรรมองค์การวิชาชีพ 3', 0, 2, 0, ACT],
  [3, 2, '20204-8501', 'โครงงาน', 0, 8, 4, PRO], [3, 2, '20204-2107', 'การวิเคราะห์ข้อมูลเบื้องต้น', 1, 2, 2, PRO],
  [3, 2, '20204-2108', 'ปัญญาประดิษฐ์เบื้องต้น', 1, 2, 2, PRO], [3, 2, '20204-2109', 'การจัดการธุรกิจออนไลน์', 1, 2, 2, FREE],
  [3, 2, '20000-2006', 'กิจกรรมองค์การวิชาชีพ 4', 0, 2, 0, ACT],
];

const EL_PVS: Row[] = [
  [1, 1, '30000-1101', 'ทักษะภาษาไทยเพื่อการสื่อสารในงานอาชีพ', 1, 2, 2, CORE], [1, 1, '30000-1201', 'ภาษาอังกฤษเพื่อการสื่อสารในงานอาชีพ', 1, 2, 2, CORE],
  [1, 1, '30000-1401', 'คณิตศาสตร์ไฟฟ้า', 3, 0, 3, CORE], [1, 1, '30104-1001', 'วงจรไฟฟ้า', 2, 3, 3, PRO],
  [1, 1, '30104-1002', 'เครื่องมือวัดไฟฟ้า', 1, 3, 2, PRO], [1, 1, '30000-2001', 'กิจกรรมองค์การวิชาชีพ 1', 0, 2, 0, ACT],
  [1, 2, '30000-1301', 'วิทยาศาสตร์เพื่องานไฟฟ้า', 2, 2, 3, CORE], [1, 2, '30104-2001', 'การออกแบบระบบไฟฟ้า', 2, 3, 3, PRO],
  [1, 2, '30104-2002', 'เครื่องกลไฟฟ้า', 2, 3, 3, PRO], [1, 2, '30104-2003', 'การควบคุมเครื่องกลไฟฟ้า', 1, 3, 2, PRO],
  [1, 2, '30001-1001', 'การบริหารงานคุณภาพในองค์การ', 3, 0, 3, CORE], [1, 2, '30000-2002', 'กิจกรรมองค์การวิชาชีพ 2', 0, 2, 0, ACT],
  [2, 1, '30104-2004', 'ระบบควบคุมในงานอุตสาหกรรม', 2, 3, 3, PRO], [2, 1, '30104-2005', 'โปรแกรมเมเบิลลอจิกคอนโทรล', 1, 3, 2, PRO],
  [2, 1, '30104-2006', 'การส่งและจ่ายไฟฟ้า', 2, 3, 3, PRO], [2, 1, '30104-8001', 'ฝึกงาน', 0, 0, 4, PRO],
  [2, 2, '30104-8501', 'โครงงาน', 0, 8, 4, PRO], [2, 2, '30104-2007', 'พลังงานทดแทน', 1, 3, 2, PRO],
  [2, 2, '30104-2008', 'การประมาณการระบบไฟฟ้า', 1, 3, 2, FREE],
];

const TERMS = [
  { year: 2568, term: 1, start: '2025-05-16', end: '2025-09-30' },
  { year: 2568, term: 2, start: '2025-11-01', end: '2026-03-15' },
  { year: 2569, term: 1, start: '2026-05-16', end: '2026-09-30' },
  { year: 2569, term: 2, start: '2026-11-01', end: '2027-03-15', current: true },
];

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);
const GRADE_POOL = ['4', '3.5', '3', '3', '2.5', '2', '3.5', '4', '2.5', '1.5'];
const pickGrade = (seed: string) => GRADE_POOL[[...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % GRADE_POOL.length]!;

/** วางคาบเรียนต่อกันจันทร์–ศุกร์ 08:00–16:00 เว้นพักเที่ยง (ตัวอย่างเท่านั้น) */
/** วางวิชาลงคาบจริงของวิทยาลัย: คาบละ 1 ชม. เช้า 08:30–12:30 (คาบ 1–4) บ่าย 13:30–17:30 (คาบ 5–8) */
function layoutWeek(subjects: { code: string; hours: number }[]) {
  const slots: Record<string, { day: number; start: number; end: number }[]> = {};
  let day = 1;
  let hour = 8.5;
  for (const s of subjects) {
    let left = Math.max(1, s.hours);
    slots[s.code] = [];
    while (left > 0) {
      if (hour === 12.5) hour = 13.5;
      if (hour >= 17.5) { day += 1; hour = 8.5; }
      if (day > 5) day = 1;
      const limit = hour < 12.5 ? 12.5 : 17.5;
      const len = Math.min(left, limit - hour);
      slots[s.code]!.push({ day, start: hour, end: hour + len });
      hour += len;
      left -= len;
    }
  }
  return slots;
}
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

export async function seedAcademic(prisma: PrismaService, teacherIds: string[]) {
  const terms = new Map<string, { id: string; year: number; term: number }>();
  for (const t of TERMS) {
    const row = await prisma.academicTerm.upsert({
      where: { year_term: { year: t.year, term: t.term } },
      update: { startDate: date(t.start), endDate: date(t.end), isCurrent: !!t.current },
      create: { year: t.year, term: t.term, startDate: date(t.start), endDate: date(t.end), isCurrent: !!t.current },
    });
    terms.set(`${t.year}-${t.term}`, row);
  }

  async function curriculum(programName: string, level: 'pvc' | 'pvs', name: string, rows: Row[]) {
    const program = await prisma.program.findFirstOrThrow({ where: { name: programName, level } });
    const minCredits = rows.reduce((s, r) => s + r[6], 0);
    const cur = await prisma.curriculum.upsert({
      where: { programId_year: { programId: program.id, year: 2567 } },
      update: { name, minCredits },
      create: { programId: program.id, year: 2567, name, minCredits },
    });
    for (const [yearLevel, term, code, subjectName, t, p, c, category] of rows) {
      const subject = await prisma.subject.upsert({ where: { code }, update: { name: subjectName, theory: t, practice: p, credits: c }, create: { code, name: subjectName, theory: t, practice: p, credits: c } });
      await prisma.studyPlanSubject.upsert({
        where: { curriculumId_subjectId: { curriculumId: cur.id, subjectId: subject.id } },
        update: { yearLevel, term, category },
        create: { curriculumId: cur.id, subjectId: subject.id, yearLevel, term, category },
      });
    }
    return cur;
  }

  const itCur = await curriculum('เทคโนโลยีธุรกิจดิจิทัล', 'pvc', 'หลักสูตรประกาศนียบัตรวิชาชีพ พ.ศ. 2567 สาขาวิชาเทคโนโลยีธุรกิจดิจิทัล', IT_PVC);
  const elCur = await curriculum('ไฟฟ้า', 'pvs', 'หลักสูตรประกาศนียบัตรวิชาชีพชั้นสูง พ.ศ. 2567 สาขาวิชาไฟฟ้า', EL_PVS);

  /**
   * plan: [ชั้นปี, ภาค] ของแผน → ภาคเรียนจริง, graded = ประกาศเกรดแล้ว
   * tweaks: เกรดพิเศษ (เช่น ตก 0 แล้วเรียนซ้ำ) เพื่อให้เห็นกรณีจริง
   */
  async function enrol(studentCode: string, rows: Row[], curriculumId: string, room: string, plan: { level: [number, number]; term: string; graded: boolean }[], tweaks: { term: string; code: string; grade: string; kind?: string }[] = []) {
    const student = await prisma.student.findUniqueOrThrow({ where: { studentCode } });
    await prisma.student.update({ where: { id: student.id }, data: { curriculumId } });
    await prisma.gradeRecord.deleteMany({ where: { studentId: student.id } });
    await prisma.registration.deleteMany({ where: { studentId: student.id } });

    let teacherTurn = 0;
    for (const step of plan) {
      const term = terms.get(step.term)!;
      const planned = rows.filter((r) => r[0] === step.level[0] && r[1] === step.level[1]);
      const extra = tweaks.filter((t) => t.term === step.term && t.kind === 'repeat').map((t) => rows.find((r) => r[2] === t.code)!);
      const list = [...planned, ...extra];
      const reg = await prisma.registration.create({ data: { studentId: student.id, termId: term.id, registeredAt: new Date(`${TERMS.find((x) => `${x.year}-${x.term}` === step.term)!.start}T03:00:00Z`) } });
      const week = layoutWeek(list.map((r) => ({ code: r[2], hours: r[4] + r[5] })));
      let examDay = 0;
      for (const r of list) {
        const subject = await prisma.subject.findUniqueOrThrow({ where: { code: r[2] } });
        const section = await prisma.courseSection.upsert({
          where: { termId_subjectId_groupCode: { termId: term.id, subjectId: subject.id, groupCode: student.groupNo } },
          update: {},
          create: { termId: term.id, subjectId: subject.id, groupCode: student.groupNo, teacherUserId: teacherIds[teacherTurn++ % teacherIds.length] ?? null },
        });
        await prisma.classSchedule.deleteMany({ where: { sectionId: section.id } });
        await prisma.classSchedule.createMany({
          data: week[r[2]]!.map((s) => ({ sectionId: section.id, dayOfWeek: s.day, startTime: hhmm(s.start), endTime: hhmm(s.end), room: r[5] >= 3 ? `${room}-ปฏิบัติการ` : room })),
        });
        await prisma.examSchedule.deleteMany({ where: { sectionId: section.id } });
        if (r[6] > 0 && r[2].slice(6, 7) !== '8') {
          const t = TERMS.find((x) => `${x.year}-${x.term}` === step.term)!;
          const base = new Date(`${t.start}T00:00:00Z`);
          const mid = new Date(base.getTime() + (49 + (examDay % 5)) * 86_400_000);
          const fin = new Date(base.getTime() + (112 + (examDay % 5)) * 86_400_000);
          const am = examDay % 2 === 0;
          await prisma.examSchedule.createMany({
            data: [
              { sectionId: section.id, kind: 'midterm', date: mid, startTime: am ? '09:00' : '13:00', endTime: am ? '10:30' : '14:30', room },
              { sectionId: section.id, kind: 'final', date: fin, startTime: am ? '09:00' : '13:00', endTime: am ? '11:00' : '15:00', room },
            ],
          });
          examDay += 1;
        }
        const tweak = tweaks.find((t) => t.term === step.term && t.code === r[2]);
        await prisma.registrationSubject.create({ data: { registrationId: reg.id, sectionId: section.id, kind: tweak?.kind ?? 'regular' } });
        if (step.graded) {
          const grade = tweak?.grade ?? (r[6] === 0 ? 'ผ' : pickGrade(studentCode + r[2]));
          await prisma.gradeRecord.create({ data: { studentId: student.id, sectionId: section.id, grade, status: 'published', publishedAt: new Date() } });
        }
      }
    }
  }

  await enrol('67201010001', IT_PVC, itCur.id, 'IT-201', [
    { level: [1, 1], term: '2568-1', graded: true },
    { level: [1, 2], term: '2568-2', graded: true },
    { level: [2, 1], term: '2569-1', graded: true },
    { level: [2, 2], term: '2569-2', graded: false },
  ], [
    { term: '2568-2', code: '20204-2005', grade: '0' },
    { term: '2569-1', code: '20204-2005', grade: '2.5', kind: 'repeat' },
    { term: '2569-1', code: '20204-2101', grade: 'ร' },
  ]);
  await enrol('68302020002', EL_PVS, elCur.id, 'EL-105', [
    { level: [1, 1], term: '2569-1', graded: true },
    { level: [1, 2], term: '2569-2', graded: false },
  ]);

  // ข้อมูลประวัติ (สมมติ)
  const profiles = [
    { code: '67201010001', nickname: 'ต้น', email: 'ton.demo@example.com', nationalId: '1149900123456', religion: 'พุทธ', bloodType: 'O', entryYear: 2568, prevSchool: 'โรงเรียนท่าเรือ "นิตยานุกูล"', prevLevel: 'มัธยมศึกษาปีที่ 3', prevGpa: 3.12,
      address: { houseNo: '45/2', moo: '3', road: 'ท่าเรือ-ท่าหลวง', subdistrict: 'ท่าหลวง', district: 'ท่าเรือ', province: 'พระนครศรีอยุธยา', postcode: '13130' },
      guardians: [['บิดา', 'นายสมชาย ระบบดี', 'พนักงานบริษัท', '0811111111', true], ['มารดา', 'นางสมศรี ระบบดี', 'ค้าขาย', '0822222222', false]] as const },
    { code: '68302020002', nickname: 'แพร', email: 'prae.demo@example.com', nationalId: '1199900765432', religion: 'พุทธ', bloodType: 'A', entryYear: 2569, prevSchool: 'วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์', prevLevel: 'ปวช. สาขาไฟฟ้ากำลัง', prevGpa: 3.45,
      address: { houseNo: '128', moo: '5', road: '', subdistrict: 'จำปา', district: 'ท่าเรือ', province: 'พระนครศรีอยุธยา', postcode: '13130' },
      guardians: [['มารดา', 'นางมานี เรียนเก่ง', 'รับราชการ', '0833333333', true], ['บิดา', 'นายมานะ เรียนเก่ง', 'เกษตรกร', '0844444444', false]] as const },
  ];
  for (const p of profiles) {
    const s = await prisma.student.update({
      where: { studentCode: p.code },
      data: { nickname: p.nickname, email: p.email, nationalId: p.nationalId, religion: p.religion, bloodType: p.bloodType, entryYear: p.entryYear, entryTerm: 1, prevSchool: p.prevSchool, prevLevel: p.prevLevel, prevGpa: p.prevGpa },
    });
    for (const kind of ['home', 'current'] as const) {
      await prisma.studentAddress.upsert({ where: { studentId_kind: { studentId: s.id, kind } }, update: p.address, create: { studentId: s.id, kind, ...p.address } });
    }
    await prisma.studentGuardian.deleteMany({ where: { studentId: s.id } });
    await prisma.studentGuardian.createMany({ data: p.guardians.map(([relation, name, occupation, phone, isPrimary]) => ({ studentId: s.id, relation, name, occupation, phone, isPrimary })) });
  }
}
