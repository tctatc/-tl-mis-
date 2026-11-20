# CSIS — ระบบทะเบียนและบริการนักเรียน–นักศึกษาออนไลน์

วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์ · พัฒนาเอง ไม่เชื่อมต่อ ศธ.02

## โครงสร้าง

| โฟลเดอร์ | หน้าที่ |
|---|---|
| `packages/shared` | แค็ตตาล็อกคำร้อง (A01–D05), ลำดับผู้พิจารณา, ตรวจข้อมูล (zod), วันที่ไทย — ใช้ร่วมกันทั้งหน้าเว็บและ API มีเทสต์ |
| `apps/api` | NestJS + Prisma 7 + PostgreSQL · ล็อกอิน, สิทธิ์, คำร้อง, audit log |
| `apps/web` | Next.js 16 + Tailwind 4 · `/api/*` ส่งต่อไป API (คุกกี้ first-party ไม่เปิด CORS) |
| `docs/forms` | สแกนแบบคำร้องต้นฉบับของวิทยาลัย (15 หน้า) ที่ใช้วัดตำแหน่งแบบฟอร์มพิมพ์ |

## รันบนเครื่อง

```bash
npm install
npm run db:up                         # Postgres ที่ 127.0.0.1:5434
cp apps/api/.env.example apps/api/.env
npm run build:shared
cd apps/api && npx prisma migrate dev && npm run build && SEED_DEMO=true npm run db:seed && npm start
cd apps/web && npm run dev            # http://localhost:3010
```

บัญชีทดลอง (เฉพาะ `SEED_DEMO=true`): นักศึกษา `67201010001` / `01/11/2008` (ใช้วันเกิดต่อได้ ตั้งค่า `STUDENT_FORCE_PASSWORD_CHANGE` ใน apps/api/.env) ·
เจ้าหน้าที่ `registrar`, `deputy`, `director`, `teacher`, `admin` รหัส `Demo-2569`

## เมนูนักศึกษา

หน้าหลัก · แผนการเรียน · บัตรลงทะเบียน (พิมพ์ A4) · ตารางเรียน/ตารางสอบ · ผลการเรียน (GPA/GPAX) · ข้อมูลประวัติ · คำร้อง
ข้อมูลรายวิชา/ตาราง/เกรดใน seed เป็นตัวอย่าง — ของจริงจะนำเข้าผ่าน Import Center

## สถานะแบบฟอร์ม

- ✅ แบบคำร้องทั่วไป (p15) — ใช้กับ A01–A05, B01, B04, C01–C05, D01–D04
- ⏳ ลาออก, ลาพัก, กลับเข้าเรียน, ขอจบ, Transcript ชุด 2, ใบรับรองความประพฤติ, เปลี่ยนแปลงรายวิชา, คำอธิบายรายวิชา, ผ่อนผันค่าหน่วยกิต, ชุดเทียบโอน ทอ.02–05

## เพิ่มแบบฟอร์มใหม่

1. `packages/shared/src/catalog.ts` — ใส่ลำดับผู้พิจารณาใน `WORKFLOWS[template]` ตามช่องความเห็นในกระดาษ แล้วตั้ง `ready: true`
2. schema ช่องที่นักศึกษากรอก (แบบ `general.ts`) + เพิ่ม case ใน `parseFormData` ของ API
3. `apps/web/src/sheets/<Form>Sheet.tsx` — วางบรรทัดตามสแกน (หน่วย mm) + หน้ากรอกฟอร์ม
