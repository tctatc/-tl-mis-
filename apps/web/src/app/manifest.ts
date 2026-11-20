import type { MetadataRoute } from 'next';

/** เว็บแอป: ติดตั้งลงหน้าจอโฮมได้ เปิดแบบเต็มจอเหมือนแอป */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'ระบบทะเบียนออนไลน์ วท.ท่าหลวงซิเมนต์ไทยอนุสรณ์',
    short_name: 'ทะเบียน ทล.',
    description: 'ตารางเรียน ผลการเรียน บัตรลงทะเบียน และยื่นคำร้องออนไลน์',
    lang: 'th',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: '#5c0f1a',
    background_color: '#f8f5f0',
    categories: ['education'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'ตารางเรียน', url: '/student/schedule', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'ผลการเรียน', url: '/student/grades', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'ยื่นคำร้อง', url: '/student/requests', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'พิจารณาคำร้อง (เจ้าหน้าที่)', url: '/staff', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
