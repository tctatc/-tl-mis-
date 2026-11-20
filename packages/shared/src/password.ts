/** นโยบายรหัสผ่าน (ใช้ทั้งหน้าเว็บและ API): อย่างน้อย 8 ตัว มีตัวอักษรภาษาอังกฤษและตัวเลข */
export const PASSWORD_MIN = 8;

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `อย่างน้อย ${PASSWORD_MIN} ตัวอักษร`;
  if (pw.length > 128) return 'ยาวเกิน 128 ตัวอักษร';
  if (/\s/.test(pw)) return 'ห้ามมีช่องว่าง';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'ต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข';
  return null;
}

/** รหัสสุ่ม 10 ตัว อ่านง่าย (ไม่มี 0/O 1/l/I) ผ่านนโยบายเสมอ — ใช้เติมช่องรหัสผ่านให้แอดมินแก้ต่อได้ */
export function randomPassword(random: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = letters + digits;
  for (;;) {
    const pw = Array.from({ length: 10 }, () => all[random(all.length)]).join('');
    if (!passwordProblem(pw)) return pw;
  }
}
