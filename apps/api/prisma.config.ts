import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// เครื่องพัฒนาอ่านจาก .env · บน Vercel ไม่มีไฟล์นี้ (ใช้ Environment Variables ของโปรเจกต์)
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // migrate/generate ใช้บัญชีเจ้าของ schema; แอปตอนรันใช้ DATABASE_URL (สิทธิ์อ่าน/เขียนข้อมูลเท่านั้น)
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL') },
});
