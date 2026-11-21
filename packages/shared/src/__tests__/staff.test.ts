import { describe, expect, it } from 'vitest';
import { guessAcademicMapping, parseStaffKind, parseWorkStatus, staffUsername } from '../index.js';

describe('staff import', () => {
  it('guesses the template headers', () => {
    const m = guessAcademicMapping('staff', ['รหัสบุคลากร', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ตำแหน่ง', 'ประเภทบุคลากร', 'แผนกวิชา', 'สาขาวิชา', 'สถานะ', 'เบอร์โทรศัพท์', 'อีเมล']);
    expect(m).toEqual({ staffCode: 0, prefix: 1, firstName: 2, lastName: 3, position: 4, employment: 5, department: 6, program: 7, status: 8, phone: 9, email: 10 });
  });
  it('maps a single full-name column', () => {
    expect(guessAcademicMapping('staff', ['รหัส', 'ชื่อ-นามสกุล'])).toEqual({ staffCode: 0, name: 1 });
  });
  it('decides teacher vs support', () => {
    expect(parseStaffKind('', 'ครู คศ.2')).toBe('teacher');
    expect(parseStaffKind('', 'เจ้าหน้าที่ธุรการ')).toBe('support');
    expect(parseStaffKind('บุคลากรสนับสนุน', 'ครูอัตราจ้าง')).toBe('support');
    expect(parseStaffKind('', '')).toBe('teacher');
  });
  it('reads work status', () => {
    expect(parseWorkStatus('')).toBe('active');
    expect(parseWorkStatus('ปฏิบัติงาน')).toBe('active');
    expect(parseWorkStatus('ลาศึกษาต่อ')).toBe('on_leave');
    expect(parseWorkStatus('ย้ายออก')).toBe('transferred');
    expect(parseWorkStatus('เกษียณอายุราชการ')).toBe('retired');
    expect(parseWorkStatus('ลาออก')).toBe('resigned');
    expect(parseWorkStatus('ไม่รู้')).toBeNull();
  });
  it('turns staff codes into usernames', () => {
    expect(staffUsername(' T001 ')).toBe('t001');
    expect(staffUsername('ครู01')).toBeNull();
    expect(staffUsername('ab')).toBeNull();
  });
});
