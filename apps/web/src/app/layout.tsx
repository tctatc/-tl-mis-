import type { Metadata, Viewport } from 'next';
import { Charm, IBM_Plex_Sans_Thai, Sarabun } from 'next/font/google';
import { FeedbackProvider } from '@/components/feedback';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

const plex = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
const sarabun = Sarabun({ subsets: ['thai', 'latin'], weight: ['400', '700'], variable: '--font-sarabun', display: 'swap' });
/** ลายมือ: ชื่อนักศึกษาในช่องลงชื่อเมื่อเลือกลงชื่อออนไลน์ */
const charm = Charm({ subsets: ['thai', 'latin'], weight: ['400'], variable: '--font-sign', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'TLMis ระบบบริการนักเรียน นักศึกษา', template: '%s · TLMis' },
  description: 'TLMis ระบบบริการนักเรียน นักศึกษา วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์ — ยื่นคำร้อง ผลการเรียน ตารางเรียน',
  robots: { index: false, follow: false },
  applicationName: 'TLMis',
  appleWebApp: { capable: true, title: 'TLMis', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#5c0f1a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plex.variable} ${sarabun.variable} ${charm.variable}`}>
      <body className="min-h-dvh"><FeedbackProvider>{children}</FeedbackProvider><ServiceWorker /></body>
    </html>
  );
}
