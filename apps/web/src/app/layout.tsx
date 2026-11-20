import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, Sarabun } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

const plex = IBM_Plex_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex', display: 'swap' });
const sarabun = Sarabun({ subsets: ['thai', 'latin'], weight: ['400', '700'], variable: '--font-sarabun', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ระบบทะเบียนออนไลน์', template: '%s · ระบบทะเบียนออนไลน์' },
  description: 'ระบบทะเบียนและบริการนักเรียน–นักศึกษา วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์',
  robots: { index: false, follow: false },
  applicationName: 'ทะเบียน ทล.',
  appleWebApp: { capable: true, title: 'ทะเบียน ทล.', statusBarStyle: 'default' },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#5c0f1a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${plex.variable} ${sarabun.variable}`}>
      <body className="min-h-dvh">{children}<ServiceWorker /></body>
    </html>
  );
}
