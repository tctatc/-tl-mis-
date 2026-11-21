import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.setGlobalPrefix('api');
  // หน้าเว็บ (Next.js) เป็น reverse proxy ชั้นเดียว — เชื่อ X-Forwarded-For แค่ชั้นเดียว ปลอม IP เพื่อหลบ rate limit ไม่ได้
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '200kb' });
  app.enableShutdownHooks();
  // ไม่เปิด CORS: เบราว์เซอร์เรียกผ่าน /api ของเว็บเดียวกันเท่านั้น
  const port = Number(process.env.PORT ?? 4010);
  // เครื่องพัฒนา/เซิร์ฟเวอร์เอง: ฟังเฉพาะเครื่องนี้ (มีเว็บเป็น proxy ข้างหน้า) · บน Vercel แพลตฟอร์มจัดการเครือข่ายเอง
  const host = process.env.VERCEL ? undefined : (process.env.HOST ?? '127.0.0.1');
  await (host ? app.listen(port, host) : app.listen(port));
  console.log(`CSIS API :${port}/api`);
}

void bootstrap();
