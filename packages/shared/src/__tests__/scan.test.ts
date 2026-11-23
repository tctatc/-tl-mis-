import { describe, expect, it } from 'vitest';
import { parseStudentQr, studentScanPath } from '../scan.js';

describe('parseStudentQr', () => {
  it('อ่านลิงก์บัตรนักศึกษาของระบบ', () => {
    expect(parseStudentQr('https://tl-mis.vercel.app/scan/68302020002')).toBe('68302020002');
    expect(parseStudentQr('  https://tl-mis.vercel.app/scan/68302020002/  ')).toBe('68302020002');
  });
  it('ย้ายโดเมนแล้ว QR เดิมยังอ่านได้', () => {
    expect(parseStudentQr('https://mis.example.ac.th/scan/12345')).toBe('12345');
  });
  it('รับรหัสล้วน', () => {
    expect(parseStudentQr('68302020002')).toBe('68302020002');
  });
  it('ไม่รับ QR อื่น', () => {
    expect(parseStudentQr('https://tl-mis.vercel.app/student/new/R01')).toBeNull();
    expect(parseStudentQr('https://evil.example/scan/../admin')).toBeNull();
    expect(parseStudentQr('https://x.example/scan/123')).toBeNull(); // สั้นเกิน
    expect(parseStudentQr('javascript:alert(1)//scan/12345')).toBeNull();
    expect(parseStudentQr('https://x.example/scan/12345?next=https://evil')).toBe('12345');
    expect(parseStudentQr('สวัสดี')).toBeNull();
    expect(parseStudentQr('')).toBeNull();
  });
  it('สร้างลิงก์กลับได้ตรงกัน', () => {
    expect(parseStudentQr(`https://tl-mis.vercel.app${studentScanPath('68302020002')}`)).toBe('68302020002');
  });
});
