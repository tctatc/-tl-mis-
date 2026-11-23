import type { NextConfig } from 'next';

const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:4010';
const PROD = process.env.NODE_ENV === 'production';
/** เว็บที่ฝังระบบนี้ใน iframe ได้ — ค่าเริ่มต้นเปิดให้ทุกเว็บ https (คุกกี้แยกพาร์ทิชัน จึงไม่เห็นเซสชันที่ล็อกอินไว้)
 *  จำกัดเฉพาะเว็บวิทยาลัยได้ เช่น FRAME_ANCESTORS="'self' https://www.example.ac.th" */
// localhost:5000 = จอหุ่น (Pi) ของวิทยาลัยที่เปิด TLMis ซ้อนในหน้าของตัวเองผ่าน http://localhost
const FRAME_ANCESTORS = process.env.FRAME_ANCESTORS?.trim() || "'self' https: http://localhost:5000 http://127.0.0.1:5000";

/** CSP: ทุกอย่างมาจากเว็บเราเอง (ฟอนต์ self-host ผ่าน next/font) — โหมดพัฒนาต้องใช้ eval จึงใส่เฉพาะ production */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  `frame-ancestors ${FRAME_ANCESTORS}`,
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // เบราว์เซอร์เรียก /api ของเว็บนี้ แล้ว Next ส่งต่อให้ NestJS (คุกกี้ first-party, ไม่ต้องเปิด CORS)
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API}/api/:path*` }];
  },
  async headers() {
    return [
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          ...(PROD ? [
            { key: 'Content-Security-Policy', value: CSP },
            // เบราว์เซอร์ใช้ HSTS เฉพาะเมื่อเปิดผ่าน https (http://localhost ไม่ได้รับผล)
            { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
          ] : []),
        ],
      },
    ];
  },
};

export default config;
