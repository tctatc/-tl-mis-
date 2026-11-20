import { describe, expect, it } from 'vitest';
import { canPromote, defaultGroupCode, finalYear, graduationCheck, roomNumber } from '../groups';

describe('defaultGroupCode: รหัสนักศึกษา 7 หลักแรก + ห้อง 2 หลัก (แบบ ศธ.02)', () => {
  it('ตรงกับตัวอย่างจริง 68319090003 ห้อง สทค.68.1 → 683190901', () => {
    expect(defaultGroupCode(['68319090003'], 'สทค.68.1')).toBe('683190901');
  });
  it('ห้อง "1" กับ "01" ได้รหัสเดียวกัน', () => {
    expect(defaultGroupCode(['67201010001'], '1')).toBe(defaultGroupCode(['67201010001'], '01'));
    expect(defaultGroupCode(['67201010001'], '1')).toBe('672010101');
  });
  it('ใช้ prefix ที่นักเรียนส่วนใหญ่ใช้', () => {
    expect(defaultGroupCode(['6820101001', '6820101002', '6730101003'], '2')).toBe('682010102');
  });
  it('ไม่มีรหัสที่ใช้ได้ → null', () => expect(defaultGroupCode(['12'], '1')).toBeNull());
});

describe('roomNumber', () => {
  it.each([['1', '01'], ['01', '01'], ['สทค.68.12', '12'], ['ห้อง 3', '03'], ['', '01']])('%s → %s', (g, r) => expect(roomNumber(g)).toBe(r));
});

describe('เลื่อนชั้น', () => {
  it('ปวช. 3 ปี ปวส. 2 ปี', () => {
    expect(finalYear('pvc')).toBe(3);
    expect(finalYear('pvs')).toBe(2);
  });
  it('เลื่อนได้ถ้ายังไม่ถึงปีสุดท้าย', () => {
    expect(canPromote('pvc', 2)).toBe(true);
    expect(canPromote('pvc', 3)).toBe(false);
    expect(canPromote('pvs', 1)).toBe(true);
    expect(canPromote('pvs', 2)).toBe(false);
  });
});

describe('graduationCheck (ตรวจเบื้องต้น)', () => {
  const plan = [{ code: 'A', credits: 3 }, { code: 'B', credits: 2 }];
  const c = (code: string, grade: string, termOrder = 1, credits = 3) => ({ code, credits, grade, termOrder });
  it('ครบ: ผ่านทุกวิชาในแผน หน่วยกิตถึง GPAX ≥ 2.00', () => {
    const r = graduationCheck({ plan, courses: [c('A', '3'), c('B', '2', 1, 2)], minCredits: 5 });
    expect(r.ready).toBe(true);
    expect(r.reasons).toEqual([]);
  });
  it('วิชาในแผนยังไม่ผ่าน', () => {
    const r = graduationCheck({ plan, courses: [c('A', '3'), c('B', '0', 1, 2)], minCredits: 3 });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(['B']);
  });
  it('เรียนซ้ำผ่านแล้วนับครั้งล่าสุด', () => {
    const r = graduationCheck({ plan, courses: [c('A', '3'), c('B', '0', 1, 2), c('B', '2', 2, 2)], minCredits: 5 });
    expect(r.ready).toBe(true);
  });
  it('หน่วยกิตไม่ถึงและ GPAX ต่ำ', () => {
    const r = graduationCheck({ plan: [], courses: [c('A', '1')], minCredits: 80 });
    expect(r.ready).toBe(false);
    expect(r.reasons.length).toBe(2);
  });
  it('ยังมีผล ร ค้าง = ยังไม่ครบ', () => {
    const r = graduationCheck({ plan, courses: [c('A', '3'), c('B', 'ร', 1, 2)], minCredits: 3 });
    expect(r.missing).toEqual(['B']);
  });
});
