# Deploy บน Vercel (TL MIS ระบบบริการนักเรียน นักศึกษา)

| ส่วน | โปรเจกต์ Vercel | Root Directory | ลิงก์ |
|---|---|---|---|
| หน้าเว็บ (Next.js) | `tl-mis` | `apps/web` | https://tl-mis.vercel.app |
| ระบบหลังบ้าน (NestJS) | `tl-mis-api` | `apps/api` | https://tl-mis-api.vercel.app |
| ฐานข้อมูล | Neon `tl-mis-db` (Free, sin1) ผ่าน Vercel Marketplace | – | – |

ภูมิภาค: sin1 (สิงคโปร์) ทั้ง function และฐานข้อมูล · Node 24.x

## Environment Variables (Production)
- `tl-mis-api`: `DATABASE_URL` (บัญชี `csis_app` อ่าน/เขียนข้อมูลเท่านั้น ผ่าน pooler), `WEB_ORIGIN=https://tl-mis.vercel.app`, `COOKIE_SECURE=true`, `SESSION_DAYS`, `STUDENT_FORCE_PASSWORD_CHANGE`; `NEON_*` มาจากการเชื่อม Neon (บัญชีเจ้าของ — ใช้ตอน migrate เท่านั้น)
- `tl-mis`: `API_ORIGIN=https://tl-mis-api.vercel.app` (หน้าเว็บส่งต่อ `/api/*` ไปหลังบ้าน คุกกี้เป็น first-party)

## Deploy โค้ดใหม่
```bash
vercel login
# จาก root ของ repo (Root Directory ตั้งไว้ในโปรเจกต์แล้ว) — ไฟล์ที่ไม่อัปโหลดดู .vercelignore
VERCEL_ORG_ID=<team> VERCEL_PROJECT_ID=<tl-mis-api id> vercel deploy --prod
VERCEL_ORG_ID=<team> VERCEL_PROJECT_ID=<tl-mis id> vercel deploy --prod
```

## Migration ฐานข้อมูล
```bash
vercel env pull neon.env --environment production   # ในโฟลเดอร์ที่ link กับ tl-mis-api (อย่าเก็บไฟล์ใน repo)
MIGRATION_DATABASE_URL="$NEON_DATABASE_URL_UNPOOLED" DATABASE_URL="$NEON_DATABASE_URL_UNPOOLED" npx prisma migrate deploy
```
ตารางใหม่ได้สิทธิ์ให้ `csis_app` อัตโนมัติ (ALTER DEFAULT PRIVILEGES)

## ข้อมูลบนคลาวด์
ข้อมูลตัวอย่างเท่านั้น (seed `SEED_DEMO=true` + `DEMO_STAFF_PASSWORD` สุ่ม) · บัญชีเจ้าหน้าที่ทดลองถูกระงับ เหลือผู้ดูแล `shoyu` · ไม่มีข้อมูลนักเรียนจริง

## ข้อจำกัดที่รู้แล้ว
- Vercel Hobby (ฟรี) ใช้ได้สำหรับงานส่วนตัว/ไม่เชิงพาณิชย์ — ใช้จริงในนามวิทยาลัยควรพิจารณาแผน Pro หรือเซิร์ฟเวอร์ของวิทยาลัย
- Neon Free: พื้นที่จำกัด และฐานข้อมูลพักเมื่อไม่มีคนใช้ (ตื่นใช้เวลาไม่กี่วินาที)
- จำกัดอัตราคำขอนับในหน่วยความจำของแต่ละ instance (ล็อกบัญชีเมื่อรหัสผิดซ้ำยังเก็บในฐานข้อมูล)
