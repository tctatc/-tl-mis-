'use client';

import { CATEGORIES, VISIBLE_REQUEST_TYPES } from '@csis/shared';
import { Printer, Smartphone } from 'lucide-react';
import { Wordmark } from '@/components/Brand';
import { QrImage, formPath } from '@/components/Qr';
import { ScaledSheet } from '@/sheets/parts';
import { SITE_HOST, siteUrl } from '@/lib/site';
import { HelpNav } from '../HelpNav';

const FORMS = VISIBLE_REQUEST_TYPES.filter((t) => t.ready);
const PER_PAGE = 8; // 2×4 ต่อแผ่น: 13 แบบฟอร์มพอดี 2 แผ่น
const pages = Array.from({ length: Math.ceil(FORMS.length / PER_PAGE) }, (_, i) => FORMS.slice(i * PER_PAGE, (i + 1) * PER_PAGE));

/**
 * QR Code ทุกแบบฟอร์มคำร้อง — พิมพ์ติดหน้างานทะเบียน/บอร์ดประชาสัมพันธ์
 * นักศึกษาสแกนแล้วไปที่แบบฟอร์มนั้นบนมือถือ (ยังไม่เข้าสู่ระบบ → เข้าสู่ระบบแล้วพากลับมาเอง)
 * QR ชี้เว็บจริงเสมอ (lib/site.ts) แม้เปิดหน้านี้จากเครื่องพัฒนา
 */
export default function FormsQrPage() {
  return (
    <div className="min-h-dvh">
      <HelpNav />
      <main id="main" className="print-doc mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="no-print flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-[26px] font-semibold sm:text-[30px]">QR Code แบบฟอร์มคำร้อง</h1>
            <p className="mt-1 text-[17px] text-ink-muted">สแกนด้วยกล้องมือถือเพื่อเปิดแบบฟอร์มนั้นทันที พิมพ์ติดหน้างานทะเบียนได้ ({FORMS.length} แบบฟอร์ม พิมพ์ได้ {pages.length} หน้า A4)</p>
          </div>
          <button type="button" onClick={() => window.print()} className="inline-flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-5 font-medium text-white hover:bg-brand-hover">
            <Printer className="size-5" aria-hidden="true" />พิมพ์ / บันทึก PDF
          </button>
        </div>

        {/* บนจอ: รายการ QR อ่านง่าย (มือถือ 1 คอลัมน์) */}
        <ul className="no-print grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FORMS.map((t) => (
            <li key={t.code} className="flex items-center gap-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70">
              <QrImage value={siteUrl(formPath(t.code))} size={112} label={`QR Code ของ ${t.name}`} className="rounded-md" />
              <div className="min-w-0">
                <p className="font-semibold">{t.name}</p>
                <p className="text-sm text-ink-muted">{CATEGORIES[t.category].name} · <span className="tabular-nums">{t.code}</span></p>
              </div>
            </li>
          ))}
        </ul>

        {/* ตอนพิมพ์: แผ่น A4 หน้าละ 6 แบบฟอร์ม */}
        <section aria-label="ตัวอย่างแผ่นพิมพ์" className="grid gap-6">
          <h2 className="no-print text-xl font-semibold">ตัวอย่างแผ่นที่จะพิมพ์</h2>
          {pages.map((items, i) => (
            <div key={i} className="print-page">
              <ScaledSheet className="[&_.a4]:shadow-paper"><QrSheet items={items} page={i + 1} total={pages.length} /></ScaledSheet>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function QrSheet({ items, page, total }: { items: typeof FORMS; page: number; total: number }) {
  return (
    <div className="a4 flex flex-col p-[14mm]">
      <header className="flex items-center gap-[5mm] border-b-[0.6mm] border-brand pb-[5mm]">
        {/* eslint-disable-next-line @next/next/no-img-element -- แผ่นพิมพ์ ต้องขึ้นทันทีไม่รอ lazy load */}
        <img src="/college-logo.png" alt="" className="h-[18mm] w-[18mm]" />
        <div className="min-w-0 flex-1">
          <p className="text-[22pt] leading-none"><Wordmark /> <span className="text-[13pt] font-medium text-ink-muted">ระบบบริการนักเรียน นักศึกษา</span></p>
          <p className="mt-[2mm] text-[18pt] font-semibold leading-tight">สแกนเพื่อยื่นคำร้องออนไลน์</p>
        </div>
        <p className="flex items-center gap-[1.5mm] text-[10.5pt] text-ink-muted"><Smartphone className="size-[5mm]" aria-hidden="true" />เปิดกล้องมือถือ แล้วส่องที่ QR</p>
      </header>
      <ul className="grid flex-1 grid-cols-2 grid-rows-4 gap-[4mm] py-[5mm]">
        {items.map((t) => (
          <li key={t.code} className="flex items-center gap-[5mm] rounded-[3mm] border-[0.35mm] border-line-strong p-[4mm]">
            <QrImage value={siteUrl(formPath(t.code))} size={150} label={`QR Code ของ ${t.name}`} className="h-[40mm] w-[40mm] shrink-0" />
            <div className="min-w-0">
              <p className="text-[14pt] font-semibold leading-snug">{t.name}</p>
              <p className="text-[10pt] text-ink-muted">{CATEGORIES[t.category].name} · {t.code}</p>
            </div>
          </li>
        ))}
      </ul>
      <footer className="flex justify-between border-t-[0.3mm] border-line pt-[3mm] text-[9.5pt] text-ink-muted">
        <span>ยังไม่ได้เข้าสู่ระบบ: ใช้รหัสนักศึกษา และวันเดือนปีเกิด (พ.ศ.) เช่น 01/11/2551 · {SITE_HOST}</span>
        <span className="tabular-nums">หน้า {page}/{total}</span>
      </footer>
    </div>
  );
}
