import { describe, expect, it } from 'vitest';
import { canTeacherEdit, cutGrade, entryGrade, isComplete, nextSectionStatus, parseScore, recordStatusFor, SECTION_STATUSES } from '../grading';

describe('cutGrade (เกณฑ์ 80/75/70/65/60/55/50)', () => {
  it.each([
    [100, '4'], [80, '4'], [79.99, '3.5'], [75, '3.5'], [70, '3'], [65, '2.5'],
    [60, '2'], [55, '1.5'], [50, '1'], [49.99, '0'], [0, '0'],
  ])('%s → %s', (score, grade) => expect(cutGrade(score)).toBe(grade));
});

describe('entryGrade: ผลพิเศษชนะคะแนน', () => {
  it('ใช้ผลพิเศษเมื่อเลือก', () => expect(entryGrade({ score: 90, special: 'มส' })).toBe('มส'));
  it('ตัดจากคะแนน', () => expect(entryGrade({ score: 72 })).toBe('3'));
  it('ไม่มีทั้งคู่ = ยังไม่กรอก', () => expect(entryGrade({})).toBeNull());
});

describe('parseScore', () => {
  it('รับ 0–100 ทศนิยม 2 ตำแหน่ง', () => {
    expect(parseScore('85.5')).toBe(85.5);
    expect(parseScore(' 70 ')).toBe(70);
    expect(parseScore('0')).toBe(0);
  });
  it('ว่าง = null', () => expect(parseScore('')).toBeNull());
  it.each(['101', '-1', 'abc', '85.555', 'NaN', 'Infinity'])('ปฏิเสธ %s', (v) => expect(parseScore(v)).toBeUndefined());
});

describe('สถานะการส่งผล (ตาม ศธ.02)', () => {
  it('ครูบันทึกได้เฉพาะ ยังไม่กรอก/กำลังกรอก/ส่งคืน', () => {
    expect(SECTION_STATUSES.filter(canTeacherEdit)).toEqual(['none', 'draft', 'returned']);
  });
  it.each([
    ['none', 'save', 'draft'], ['draft', 'save', 'draft'], ['returned', 'save', 'returned'],
    ['draft', 'submit', 'submitted'], ['returned', 'submit', 'submitted'],
    ['submitted', 'return', 'returned'], ['submitted', 'approve', 'approved'],
    ['approved', 'unapprove', 'submitted'], ['approved', 'publish', 'published'],
    ['published', 'unpublish', 'approved'],
  ] as const)('%s + %s → %s', (from, action, to) => expect(nextSectionStatus(from, action)).toBe(to));
  it.each([
    ['none', 'submit'], ['submitted', 'save'], ['draft', 'approve'], ['submitted', 'publish'],
    ['published', 'save'], ['published', 'return'], ['approved', 'save'],
  ] as const)('%s + %s ไม่ได้', (from, action) => expect(nextSectionStatus(from, action)).toBeNull());
});

describe('recordStatusFor: เกรดรายคนตามสถานะวิชาเสมอ', () => {
  it('นักเรียนเห็นเฉพาะเมื่อประกาศ', () => {
    expect(SECTION_STATUSES.filter((s) => recordStatusFor(s) === 'published')).toEqual(['published']);
  });
  it('ส่งคืน = ร่าง', () => expect(recordStatusFor('returned')).toBe('draft'));
});

describe('isComplete', () => {
  it('ทุกคนที่ลงทะเบียนต้องมีผล', () => {
    expect(isComplete(['a', 'b'], new Map([['a', '4'], ['b', 'ร']]))).toBe(true);
    expect(isComplete(['a', 'b'], new Map([['a', '4']]))).toBe(false);
    expect(isComplete([], new Map())).toBe(false);
  });
});
