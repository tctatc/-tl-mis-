import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** ตรวจข้อมูลด้วย zod แล้วโยน 400 พร้อมข้อความรายช่อง (หน้าเว็บเอาไปแสดงใต้ช่องนั้นได้) */
export function parseOr400<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  throw new BadRequestException({ message: 'ข้อมูลไม่ถูกต้อง', fields });
}
