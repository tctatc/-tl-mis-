import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, REQUEST_TYPES, WORKFLOWS, formDefaults, getRequestType, validateForm, type StudentSnapshot } from '../index.js';

const student: StudentSnapshot = {
  studentCode: '67201010001', prefix: 'นาย', firstName: 'ทดลอง', lastName: 'ระบบดี', birthDate: '2008-11-01', level: 'pvc',
  department: 'แผนกวิชาเทคโนโลยีสารสนเทศ', program: 'เทคโนโลยีสารสนเทศ', yearLevel: 2, groupNo: '1', fatherName: '', motherName: '', phone: '0812345678',
  guardianName: 'นายสมชาย ระบบดี', homeProvince: 'พระนครศรีอยุธยา',
};
const ctx = { student, current: { year: 2569, term: 2 }, registeredPeriods: 22 };

describe('form engine', () => {
  it('every ready type has a workflow and (unless general) a field list', () => {
    for (const t of REQUEST_TYPES.filter((x) => x.ready)) {
      expect(WORKFLOWS[t.template].length, t.code).toBeGreaterThan(0);
      if (t.template !== 'general') expect(FORM_FIELDS[t.template], t.code).toBeDefined();
    }
  });
  it('prefills from the registry', () => {
    expect(formDefaults(getRequestType('A06')!, ctx)).toMatchObject({ guardianName: 'นายสมชาย ระบบดี', phone: '0812345678' });
    expect(formDefaults(getRequestType('A07')!, ctx)).toMatchObject({ term: '2', year: 2569, returnTerm: '1', returnYear: 2570 });
    expect(formDefaults(getRequestType('B02')!, ctx)).toMatchObject({ actions: [], regularPeriods: 22 });
  });
  it('requires visible fields only and clears hidden ones', () => {
    const r1 = validateForm('return', { ...formDefaults(getRequestType('A08')!, ctx), cause: 'other', causeOther: '' });
    expect(r1.ok).toBe(false);
    const r2 = validateForm('return', { ...formDefaults(getRequestType('A08')!, ctx), cause: 'leave', causeOther: 'ค้าง' });
    expect(r2.ok && r2.data.causeOther).toBe('');
  });
  it('rejects unknown choices, overlong text, duplicate courses', () => {
    expect(validateForm('graduate', { year: 2569, registeredAll: 'maybe', phone: '1' }).ok).toBe(false);
    expect(validateForm('resign', { reason: 'ก'.repeat(161), guardianName: 'x', phone: '1' }).ok).toBe(false);
    const dup = validateForm('course_desc', { phone: '1', purpose: 'x', courses: [{ code: 'A', name: 'a' }, { code: 'A', name: 'a' }] });
    expect(!dup.ok && dup.errors.courses).toBe('มีรหัสวิชาซ้ำกัน');
  });
  it('drops unknown keys and blank course rows', () => {
    const r = validateForm('course_desc', { phone: '1', purpose: 'x', hacker: '<script>', courses: [{ code: 'A', name: 'a', credits: 3 }, { code: '', name: '' }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.hacker).toBeUndefined();
      expect((r.data.courses as unknown[]).length).toBe(1);
    }
  });
});
