import type { NextConfig } from 'next';

const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:4010';

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
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default config;
