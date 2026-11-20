import type { StudentSnapshot } from '@csis/shared';
import type { PrismaService, Tx } from './prisma.service.js';

/** ข้อมูลนักศึกษาจากทะเบียน — ใช้เติมแบบฟอร์มอัตโนมัติและเก็บแนบคำร้อง ณ วันยื่น */
export async function loadStudentSnapshot(db: PrismaService | Tx, studentId: string): Promise<StudentSnapshot> {
  const s = await db.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      program: { include: { department: true, head: { select: { displayName: true } } } },
      advisor: { select: { displayName: true } },
      curriculum: { select: { name: true } },
      classGroup: { select: { code: true } },
      guardians: { orderBy: { isPrimary: 'desc' }, take: 1 },
      addresses: { where: { kind: 'home' }, take: 1 },
    },
  });
  const guardian = s.guardians[0];
  return {
    studentCode: s.studentCode,
    prefix: s.prefix,
    firstName: s.firstName,
    lastName: s.lastName,
    birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : null,
    level: s.program.level,
    department: s.program.department.name,
    program: s.program.name,
    yearLevel: s.yearLevel,
    groupNo: s.groupNo,
    fatherName: s.fatherName,
    motherName: s.motherName,
    phone: s.phone,
    guardianName: guardian?.name ?? '',
    guardianPhone: guardian?.phone ?? '',
    guardianRelation: guardian?.relation ?? '',
    advisorName: s.advisor?.displayName ?? '',
    programHeadName: s.program.head?.displayName ?? '',
    curriculumName: s.curriculum?.name ?? '',
    entryYear: s.entryYear,
    prevSchool: s.prevSchool,
    prevProvince: s.addresses[0]?.province ?? '',
    prevLevel: s.prevLevel,
    homeProvince: s.addresses[0]?.province ?? '',
    classGroupCode: s.classGroup?.code ?? '',
  };
}
