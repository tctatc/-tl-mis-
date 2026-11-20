import { describe, expect, it } from 'vitest';
import { SIGNATURE_MAX_CHARS, isValidSignature } from '../signature';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('isValidSignature: รับเฉพาะรูป PNG ขนาดไม่ใหญ่', () => {
  it('PNG ถูกต้อง', () => expect(isValidSignature(png)).toBe(true));
  it.each([
    ['ไม่ใช่ data URL', 'https://evil.example/sig.png'],
    ['ชนิดอื่น (SVG สคริปต์ได้)', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='],
    ['บอกว่า PNG แต่ไส้ไม่ใช่', 'data:image/png;base64,R0lGODlhAQABAAAAACw='],
    ['base64 มีตัวแปลก', 'data:image/png;base64,iVBORw0KGgo<script>'],
    ['ว่าง', ''],
  ])('ปฏิเสธ: %s', (_, v) => expect(isValidSignature(v)).toBe(false));
  it('ใหญ่เกินกำหนด', () => expect(isValidSignature(`data:image/png;base64,iVBORw0KGgo${'A'.repeat(SIGNATURE_MAX_CHARS)}`)).toBe(false));
});
