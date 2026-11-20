import { defineConfig, env } from 'prisma/config';

process.loadEnvFile?.('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // migrate/generate ใช้บัญชีเจ้าของ schema; แอปตอนรันใช้ DATABASE_URL (สิทธิ์อ่าน/เขียนข้อมูลเท่านั้น)
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL') },
});
