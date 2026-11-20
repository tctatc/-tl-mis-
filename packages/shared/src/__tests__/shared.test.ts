import { describe, expect, it } from 'vitest';
import {
  GENERAL_LIMITS, REQUEST_TYPES, VISIBLE_REQUEST_TYPES, WORKFLOWS, academicYearOf, applyDecision, bangkokDateParts, canCancel, defaultStudentPassword,
  formatRequestNo, generalDefaults, generalFormSchema, getRequestType, isAssignee, parseIsoDate, resubmit, workflowOf,
} from '../index.js';

describe('thai dates', () => {
  it('uses Bangkok time, not the machine time zone', () => {
    // 17:30 UTC = 00:30 วันถัดไปที่ไทย
    expect(bangkokDateParts('2026-11-17T17:30:00Z')).toEqual({ day: 18, month: 11, year: 2026 });
  });
  it('rejects malformed ISO dates', () => {
    expect(parseIsoDate('2003-13-01')).toBeNull();
    expect(parseIsoDate('01/11/2003')).toBeNull();
    expect(parseIsoDate('2003-11-01')).toEqual({ day: 1, month: 11, year: 2003 });
  });
  it('builds the DD/MM/YYYY default password from the spec example', () => {
    expect(defaultStudentPassword('2003-11-01')).toBe('01/11/2003');
  });
  it('rolls the academic year over in May', () => {
    expect(academicYearOf('2026-04-30T05:00:00Z')).toBe(2568);
    expect(academicYearOf('2026-05-01T05:00:00Z')).toBe(2569);
  });
});

describe('catalog', () => {
  it('has unique codes and every ready type has a workflow', () => {
    const codes = REQUEST_TYPES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const type of REQUEST_TYPES.filter((t) => t.ready)) {
      expect(WORKFLOWS[type.template].length, type.code).toBeGreaterThan(0);
    }
  });
  it('covers every request code in the spec', () => {
    const spec = ['A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'B01', 'B02', 'B03', 'B04', 'B05', 'C01', 'C02', 'C03', 'C04', 'C05', 'D01', 'D02', 'D03', 'D04'];
    for (const code of spec) expect(getRequestType(code), code).toBeDefined();
  });
  it('gives each ready type its own short quick reasons', () => {
    for (const type of REQUEST_TYPES.filter((t) => t.ready)) {
      expect(type.purposes.length, type.code).toBeGreaterThanOrEqual(2);
      for (const p of type.purposes) expect(p.length, p).toBeLessThanOrEqual(GENERAL_LIMITS.purpose);
    }
    expect(getRequestType('C03')!.purposes).toContain('เจ็บป่วยในวันสอบ');
    expect(getRequestType('A01')!.purposes).toContain('ยื่นขอทุนการศึกษา');
  });
  it('shows only types that have a college paper form', () => {
    const shown = VISIBLE_REQUEST_TYPES.map((t) => t.code);
    expect(shown).toEqual(['A01', 'A02', 'A06', 'A07', 'A08', 'A09', 'A10', 'A11', 'B02', 'B05', 'B06', 'D01', 'D05']);
    expect(getRequestType('C02')?.hidden).toBe(true); // คำร้องเก่ายังเปิดดูได้
  });
  it('presets the right box per button', () => {
    expect(generalDefaults(getRequestType('A01')!).wants).toEqual(['student_cert']);
    expect(generalDefaults(getRequestType('C03')!)).toMatchObject({ wants: ['other'], other: 'ขอสอบกรณีพิเศษ' });
  });
});

describe('general form validation', () => {
  it('requires the "other" text only when other is ticked', () => {
    expect(generalFormSchema.safeParse({ wants: ['other'], other: '', purpose: 'ยื่นทุน' }).success).toBe(false);
    expect(generalFormSchema.safeParse({ wants: ['transcript'], other: '', purpose: 'ยื่นทุน' }).success).toBe(true);
  });
  it('drops stale other text and duplicate ticks', () => {
    const parsed = generalFormSchema.parse({ wants: ['transcript', 'transcript'], other: 'ค้างไว้', purpose: 'สมัครงาน' });
    expect(parsed).toEqual({ wants: ['transcript'], other: '', purpose: 'สมัครงาน', copies: 1 });
  });
  it('caps lengths so text still fits one printed line', () => {
    expect(generalFormSchema.safeParse({ wants: ['transcript'], purpose: 'ก'.repeat(111) }).success).toBe(false);
  });
  it('rejects unknown keys of want and empty list', () => {
    expect(generalFormSchema.safeParse({ wants: [], purpose: 'xxx' }).success).toBe(false);
    expect(generalFormSchema.safeParse({ wants: ['hack'], purpose: 'xxx' }).success).toBe(false);
  });
});

describe('workflow', () => {
  const steps = workflowOf('A01');
  const start = { status: 'pending' as const, currentStep: 0, round: 1 };

  it('walks step by step to approved', () => {
    let state = applyDecision(start, steps, 'approve');
    expect(state).toEqual({ status: 'pending', currentStep: 1, round: 1 });
    state = applyDecision(state, steps, 'approve');
    state = applyDecision(state, steps, 'approve');
    expect(state.status).toBe('approved');
    expect(() => applyDecision(state, steps, 'approve')).toThrow();
  });
  it('return then resubmit starts a new round at the first step', () => {
    const mid = applyDecision(start, steps, 'approve');
    const returned = applyDecision(mid, steps, 'return');
    expect(returned.status).toBe('returned');
    expect(resubmit(returned)).toEqual({ status: 'pending', currentStep: 0, round: 2 });
    expect(() => resubmit(start)).toThrow();
  });
  it('owner can cancel only before anyone acted this round', () => {
    expect(canCancel(start, 0)).toBe(true);
    expect(canCancel(start, 1)).toBe(false);
    expect(canCancel({ ...start, status: 'approved' }, 0)).toBe(false);
  });
  it('submitter can never act on their own request', () => {
    const subject = { submitterUserId: 'u1', advisorUserId: 'u1' };
    expect(isAssignee({ userId: 'u1', positions: ['registrar_head'] }, { kind: 'position', position: 'registrar_head' }, subject)).toBe(false);
    expect(isAssignee({ userId: 'u2', positions: ['registrar_head'] }, { kind: 'position', position: 'registrar_head' }, subject)).toBe(true);
    expect(isAssignee({ userId: 'u2', positions: [] }, { kind: 'advisor' }, { submitterUserId: 'u1', advisorUserId: 'u2' })).toBe(true);
    // หัวหน้าสาขา: ต้องเป็นหัวหน้าของสาขาของนักศึกษาคนนั้นเท่านั้น และไม่มีหัวหน้า = ไม่มีใครกดแทนได้
    expect(isAssignee({ userId: 'h1', positions: [] }, { kind: 'programHead' }, { submitterUserId: 'u1', advisorUserId: null, programHeadUserId: 'h1' })).toBe(true);
    expect(isAssignee({ userId: 'h2', positions: [] }, { kind: 'programHead' }, { submitterUserId: 'u1', advisorUserId: null, programHeadUserId: 'h1' })).toBe(false);
    expect(isAssignee({ userId: 'h1', positions: [] }, { kind: 'programHead' }, { submitterUserId: 'u1', advisorUserId: null, programHeadUserId: null })).toBe(false);
  });
  it('formats request numbers', () => {
    expect(formatRequestNo(2569, 7)).toBe('R69-00007');
  });
});
