/**
 * ลิงก์เว็บตัวจริงของวิทยาลัย — ใช้กับของที่พิมพ์ออกไป (โปสเตอร์ PDF แผ่น QR)
 * ต้องชี้เว็บจริงเสมอ แม้สร้างไฟล์จากเครื่องพัฒนา ย้ายโดเมนเมื่อไหร่ตั้ง NEXT_PUBLIC_SITE_URL ตอน build
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tl-mis.vercel.app').replace(/\/+$/, '');
export const siteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
/** แสดงบนกระดาษ: ตัด https:// ออก อ่าน/พิมพ์ตามง่ายกว่า */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '');
