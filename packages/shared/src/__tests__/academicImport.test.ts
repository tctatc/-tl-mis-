import { describe, expect, it } from 'vitest';
import { groupMatches, guessAcademicMapping, normalizeGrade, parseDay, parseTerm, parseTime, parseTimeRange, parseTpn, parseYearLevel } from '../index.js';

describe('academic import parsing', () => {
  it('guesses schedule and grade headers', () => {
    expect(guessAcademicMapping('schedule', ['สาขาวิชา', 'ชั้นปี', 'ห้อง', 'วัน', 'เวลา', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'ครูผู้สอน']))
      .toMatchObject({ program: 0, yearLevel: 1, groupNo: 2, day: 3, time: 4, subjectCode: 5, subjectName: 6, room: 7, teacher: 8 });
    expect(guessAcademicMapping('grade', ['ลำดับ', 'รหัสประจำตัว', 'ชื่อ-สกุล', 'รหัสวิชา', 'เกรด'])).toMatchObject({ studentCode: 1, studentName: 2, subjectCode: 3, grade: 4 });
    expect(guessAcademicMapping('plan', ['สาขา', 'ปีที่', 'ภาคเรียน', 'รหัสวิชา', 'ชื่อวิชา', 'ท-ป-น', 'หมวดวิชา'])).toMatchObject({ program: 0, yearLevel: 1, term: 2, subjectCode: 3, subjectName: 4, tpn: 5, category: 6 });
  });
  it('parses days, times and ranges', () => {
    expect(parseDay('จันทร์')).toBe(1); expect(parseDay('วันพฤหัสบดี')).toBe(4); expect(parseDay('Fri')).toBe(5); expect(parseDay('x')).toBeNull();
    expect(parseTime('8.30')).toBe('08:30'); expect(parseTime('13')).toBe('13:00');
    expect(parseTimeRange('08.00-10.00')).toEqual(['08:00', '10:00']);
    expect(parseTimeRange('13:00 – 16:00 น.')).toEqual(['13:00', '16:00']);
    expect(parseTimeRange('10.00-08.00')).toBeNull();
  });
  it('parses t-p-n, grades, year, term', () => {
    expect(parseTpn('2-2-3')).toEqual({ theory: 2, practice: 2, credits: 3 });
    expect(normalizeGrade('3.50')).toBe('3.5'); expect(normalizeGrade('มส.')).toBe('มส'); expect(normalizeGrade('5')).toBeNull();
    expect(parseYearLevel('ปวช.2')).toBe(2); expect(parseYearLevel('ปี 3')).toBe(3);
    expect(parseTerm('ภาคเรียนที่ 2')).toBe(2); expect(parseTerm('ฤดูร้อน')).toBe(3);
  });
  it('matches room numbers to registry group codes', () => {
    expect(groupMatches('1', 'สทค.68.1')).toBe(true);
    expect(groupMatches('สทค.68.1', 'สทค. 68.1')).toBe(true);
    expect(groupMatches('2', 'สทค.68.1')).toBe(false);
    expect(groupMatches('1', '1')).toBe(true);
  });
});
