import { z } from 'zod';
import type { GeneralWant, RequestTypeDef } from './catalog.js';

/** ช่องที่นักศึกษากรอกเองในแบบคำร้องทั่วไป (ข้อมูลส่วนตัวระบบเติมให้จากทะเบียน) */

export const GENERAL_WANT_LABEL: Record<GeneralWant, string> = {
  student_cert: 'ใบรับรองการเป็นนักเรียน',
  transcript: 'ระเบียนแสดงผลการเรียน',
  other: 'อื่น ๆ',
};

/** ความยาวที่ยังพิมพ์ลงบรรทัดเดียวของฟอร์มได้อ่านออก */
export const GENERAL_LIMITS = { other: 60, purpose: 110, copies: 20 } as const;

export const generalFormSchema = z
  .object({
    wants: z.array(z.enum(['student_cert', 'transcript', 'other'])).min(1, 'เลือกอย่างน้อย 1 ข้อ').max(3),
    other: z.string().trim().max(GENERAL_LIMITS.other, `ไม่เกิน ${GENERAL_LIMITS.other} ตัวอักษร`).default(''),
    purpose: z.string().trim().min(3, 'บอกเหตุผลที่ขอสั้น ๆ').max(GENERAL_LIMITS.purpose, `ไม่เกิน ${GENERAL_LIMITS.purpose} ตัวอักษร`),
    copies: z.number().int().min(1).max(GENERAL_LIMITS.copies).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.wants.includes('other') && value.other.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['other'], message: 'ระบุเรื่องที่ขอ' });
    }
  })
  .transform((value) => ({
    ...value,
    wants: [...new Set(value.wants)].sort(),
    other: value.wants.includes('other') ? value.other : '',
  }));

export type GeneralFormData = z.output<typeof generalFormSchema>;
export type GeneralFormInput = z.input<typeof generalFormSchema>;

/** ค่าเริ่มต้นตามปุ่มที่กด เช่น กด A01 = ติ๊ก "ใบรับรองการเป็นนักเรียน" ไว้ให้ */
export function generalDefaults(type: RequestTypeDef): GeneralFormData {
  const want = type.preset?.want ?? 'other';
  return { wants: [want], other: want === 'other' ? (type.preset?.other ?? '') : '', purpose: '', copies: 1 };
}
