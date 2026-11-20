import { describe, expect, it } from 'vitest';
import { entryYearFromCode, guessMapping, mapRow, normalizeOrgName, parseLevel, parseThaiDate, splitThaiName, validNationalId } from '../index.js';

describe('student import', () => {
  it('guesses Thai and English headers without confusing ชื่อ with ชื่อบิดา', () => {
    const m = guessMapping(['ลำดับ', 'รหัสประจำตัว', 'ชื่อ - สกุล', 'วัน/เดือน/ปีเกิด', 'แผนกวิชา', 'สาขาวิชา', 'ระดับชั้น', 'ชื่อบิดา', 'ชื่อมารดา', 'เบอร์โทร']);
    expect(m).toMatchObject({ studentCode: 1, fullName: 2, birthDate: 3, department: 4, program: 5, level: 6, fatherName: 7, motherName: 8, phone: 9 });
    expect(guessMapping(['student_id', 'first name', 'last name', 'DOB', 'Program'])).toMatchObject({ studentCode: 0, firstName: 1, lastName: 2, birthDate: 3, program: 4 });
  });
  it('splits names and normalizes prefixes', () => {
    expect(splitThaiName('น.ส. สมหญิง  ใจดี')).toEqual({ prefix: 'นางสาว', firstName: 'สมหญิง', lastName: 'ใจดี' });
    expect(splitThaiName('นายสมชาย ณ อยุธยา')).toEqual({ prefix: 'นาย', firstName: 'สมชาย', lastName: 'ณ อยุธยา' });
    expect(splitThaiName('นางมาลี ดีงาม').prefix).toBe('นาง');
  });
  it('reads many Thai date formats', () => {
    expect(parseThaiDate('01/11/2551')).toBe('2008-11-01');
    expect(parseThaiDate('1/11/51')).toBe('2008-11-01');
    expect(parseThaiDate('01-11-2008')).toBe('2008-11-01');
    expect(parseThaiDate('2551-11-01')).toBe('2008-11-01');
    expect(parseThaiDate('1 พ.ย. 2551')).toBe('2008-11-01');
    expect(parseThaiDate('1 พฤศจิกายน 51')).toBe('2008-11-01');
    expect(parseThaiDate(39753)).toBe('2008-11-01'); // เลขวันที่ Excel
    expect(parseThaiDate(new Date(Date.UTC(2008, 10, 1)))).toBe('2008-11-01');
    expect(parseThaiDate('31/02/2551')).toBeNull();
    expect(parseThaiDate('ไม่ทราบ')).toBeNull();
  });
  it('derives entry year from the code prefix (68 → 2568)', () => {
    expect(entryYearFromCode('6820101001')).toBe(2568);
    expect(entryYearFromCode('69301')).toBe(2569);
    expect(entryYearFromCode('12')).toBeNull();
  });
  it('parses level and org names', () => {
    expect(parseLevel('ปวช.2')).toEqual({ level: 'pvc', year: 2 });
    expect(parseLevel('ปวส')).toEqual({ level: 'pvs', year: null });
    expect(normalizeOrgName('แผนกวิชา ช่างยนต์')).toBe('ช่างยนต์');
    expect(normalizeOrgName('สาขาวิชาเทคโนโลยีสารสนเทศ')).toBe('เทคโนโลยีสารสนเทศ');
  });
  it('checks national ID checksum', () => {
    expect(validNationalId('1101700203450')).toBe(true);
    expect(validNationalId('1101700203452')).toBe(false);
  });
  it('maps a row: year level from code wins over file, warns on mismatch', () => {
    const m = { studentCode: 0, fullName: 1, birthDate: 2, program: 3, yearLevel: 4 };
    const { student, issues } = mapRow(['6820101001', 'นายสมชาย ใจดี', '01/11/2551', 'สาขาวิชาช่างยนต์', '3'], m, 2569);
    expect(student).toMatchObject({ studentCode: '6820101001', prefix: 'นาย', firstName: 'สมชาย', lastName: 'ใจดี', birthDate: '2008-11-01', program: 'ช่างยนต์', entryYear: 2568, yearLevel: 2 });
    expect(issues.some((i) => i.column === 'yearLevel' && i.level === 'warning')).toBe(true);
  });
  it('reports errors per column', () => {
    const { issues } = mapRow(['12ab', '', 'วันไหน', ''], { studentCode: 0, fullName: 1, birthDate: 2, program: 3 }, 2569);
    const cols = issues.filter((i) => i.level === 'error').map((i) => i.column);
    expect(cols).toEqual(expect.arrayContaining(['studentCode', 'firstName', 'birthDate', 'program']));
  });
});
