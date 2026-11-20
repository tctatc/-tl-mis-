import { describe, expect, it } from 'vitest';
import { creditsEarned, gpa, gpax, gradeOutcome, maskNationalId, termLabel, truncate2 } from '../index.js';

describe('grades', () => {
  it('classifies outcomes', () => {
    expect(gradeOutcome('1')).toBe('passed');
    expect(gradeOutcome('ผ')).toBe('passed');
    expect(gradeOutcome('0')).toBe('failed');
    expect(gradeOutcome('มส')).toBe('failed');
    expect(gradeOutcome('ร')).toBe('pending');
  });
  it('weights GPA by credits and ignores non-numeric grades', () => {
    expect(gpa([{ credits: 3, grade: '4' }, { credits: 1, grade: '2' }, { credits: 2, grade: 'ผ' }, { credits: 2, grade: 'ร' }])).toBe(3.5);
    expect(gpa([{ credits: 2, grade: 'ผ' }])).toBeNull();
  });
  it('truncates instead of rounding', () => {
    expect(truncate2(2.999)).toBe(2.99);
    expect(gpa([{ credits: 3, grade: '4' }, { credits: 3, grade: '3.5' }, { credits: 3, grade: '3.5' }])).toBe(3.66);
  });
  it('uses the latest attempt for repeated subjects', () => {
    const courses = [
      { code: 'A', credits: 2, grade: '0', termOrder: 25681 },
      { code: 'A', credits: 2, grade: '3', termOrder: 25691 },
      { code: 'B', credits: 2, grade: '2', termOrder: 25681 },
    ];
    expect(gpax(courses)).toBe(2.5);
    expect(creditsEarned(courses)).toBe(4);
  });
  it('masks national ID and labels terms', () => {
    expect(maskNationalId('1-1037-01234-56-7')).toBe('x-xxxx-xxxxx-56-7');
    expect(maskNationalId('123')).toBe('');
    expect(termLabel(2569, 2)).toBe('2/2569');
    expect(termLabel(2569, 3)).toBe('ฤดูร้อน/2569');
  });
});
