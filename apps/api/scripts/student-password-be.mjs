// แปลงรหัสผ่านเริ่มต้นของนักศึกษาจากวันเกิดปี ค.ศ. (01/11/2008) เป็นปี พ.ศ. (01/11/2551)
// เปลี่ยนเฉพาะบัญชีที่ยังใช้รหัสวันเกิดแบบเดิมอยู่ บัญชีที่ตั้งรหัสเองแล้วไม่ถูกแตะ
// ใช้: node --env-file=.env scripts/student-password-be.mjs   (รันซ้ำได้ ไม่มีผลกับบัญชีที่แปลงแล้ว)
import { hash, verify } from '@node-rs/argon2';
import pg from 'pg';

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };
const pad = (n) => String(n).padStart(2, '0');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const { rows } = await client.query(
  `SELECT u.id, u."passwordHash" AS h, to_char(s."birthDate", 'YYYY-MM-DD') AS birth
     FROM students s JOIN users u ON u.id = s."userId"
    WHERE s."birthDate" IS NOT NULL`,
);
let changed = 0;
for (const r of rows) {
  const [y, m, d] = r.birth.split('-').map(Number);
  const ce = `${pad(d)}/${pad(m)}/${y}`;
  if (!(await verify(r.h, ce).catch(() => false))) continue;
  const be = `${pad(d)}/${pad(m)}/${y + 543}`;
  await client.query(`UPDATE users SET "passwordHash" = $1 WHERE id = $2`, [await hash(be, ARGON), r.id]);
  changed++;
}
console.log(`นักศึกษาทั้งหมด ${rows.length} คน · แปลงเป็นปี พ.ศ. ${changed} คน`);
await client.end();
