'use client';

import { Download, Printer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Wordmark } from '@/components/Brand';
import { QrImage } from '@/components/Qr';
import { cx } from '@/components/ui';
import { ScaledSheet } from '@/sheets/parts';
import { SITE_HOST, siteUrl } from '@/lib/site';
import { HelpNav } from '../HelpNav';

/**
 * คู่มือฉบับโปสเตอร์ A4 — สรุปหน้าเดียว พิมพ์ติดบอร์ด หรือดาวน์โหลด PDF
 * ข้อความต้องตรงกับปุ่ม/เมนูจริง (เหมือน help/content.ts) ถ้าเปลี่ยนชื่อปุ่มให้แก้ที่นี่ด้วย
 * PDF ใน public/manuals สร้างจากหน้านี้ (พิมพ์เป็น PDF ขนาด A4 ไม่มีขอบ เปิดพื้นหลัง) — แก้ข้อความแล้วต้องสร้างไฟล์ใหม่ทับด้วย
 */
type Who = 'student' | 'staff';
const POSTERS: Record<Who, { label: string; pdf: string; file: string }> = {
  student: { label: 'นักศึกษา', pdf: '/manuals/tlmis-manual-student.pdf', file: 'TLMis-คู่มือนักศึกษา.pdf' },
  staff: { label: 'ครูและเจ้าหน้าที่', pdf: '/manuals/tlmis-manual-staff.pdf', file: 'TLMis-คู่มือครูและเจ้าหน้าที่.pdf' },
};

export default function PosterPage() {
  const [who, setWho] = useState<Who>('student');
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('for');
    if (p === 'student' || p === 'staff') setWho(p);
  }, []);
  const choose = (w: Who) => { setWho(w); window.history.replaceState(null, '', `?for=${w}`); };

  return (
    <div className="min-h-dvh">
      <HelpNav />
      <main id="main" className="print-doc mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="no-print grid gap-4">
          <div>
            <h1 className="text-[26px] font-semibold sm:text-[30px]">คู่มือฉบับโปสเตอร์</h1>
            <p className="mt-1 text-[17px] text-ink-muted">สรุปการใช้งานในหน้าเดียว พิมพ์ติดบอร์ด หรือดาวน์โหลดเป็นไฟล์ PDF ส่งต่อในกลุ่มได้</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div role="tablist" aria-label="คู่มือสำหรับ" className="inline-flex rounded-full bg-sunken p-1">
              {(Object.keys(POSTERS) as Who[]).map((w) => (
                <button key={w} role="tab" aria-selected={who === w} onClick={() => choose(w)}
                  className={cx('min-h-10 rounded-full px-4 text-[15px]', who === w ? 'bg-surface font-semibold text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
                  {POSTERS[w].label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <a href={POSTERS[who].pdf} download={POSTERS[who].file} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 font-medium text-white hover:bg-brand-hover">
                <Download className="size-5" aria-hidden="true" />ดาวน์โหลด PDF
              </a>
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-4 font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft">
                <Printer className="size-5" aria-hidden="true" />พิมพ์
              </button>
            </div>
          </div>
        </div>
        <div className="print-page mx-auto w-full max-w-[820px]">
          <ScaledSheet className="[&_.a4]:shadow-paper">{who === 'student' ? <StudentPoster /> : <StaffPoster />}</ScaledSheet>
        </div>
      </main>
    </div>
  );
}

/* ---------------- ชิ้นส่วนโปสเตอร์ (หน่วย mm/pt ให้ขนาดบนกระดาษคงที่) ---------------- */

function PosterHeader({ audience }: { audience: string }) {
  return (
    <header className="relative shrink-0 overflow-hidden bg-brand-deep px-[14mm] pt-[10mm] pb-[8mm] text-white">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(120mm_70mm_at_95%_0%,hsl(352_62%_32%),transparent_70%)]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[1.2mm] bg-gold" />
      <div className="relative flex items-center gap-[6mm]">
        {/* eslint-disable-next-line @next/next/no-img-element -- แผ่นพิมพ์ */}
        <img src="/college-logo.png" alt="" className="h-[24mm] w-[24mm] rounded-full bg-white p-[1mm]" />
        <div className="min-w-0">
          <p className="text-[34pt] leading-none"><Wordmark inverse /></p>
          <p className="mt-[2mm] text-[14pt] text-white/85">ระบบบริการนักเรียน นักศึกษา · วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์</p>
        </div>
      </div>
      <p className="relative mt-[6mm] text-[22pt] font-semibold leading-tight">คู่มือฉบับย่อ <span className="text-gold">สำหรับ{audience}</span></p>
    </header>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="mb-[3mm] flex items-center gap-[2.5mm] text-[15pt] font-semibold text-brand-deep">
        <span aria-hidden="true" className="h-[5mm] w-[1.2mm] rounded-full bg-gold" />{title}
      </h2>
      {children}
    </section>
  );
}

/** ขั้นตอนเรียงลำดับ — ตัวเลขบอกลำดับจริง ต้องทำตามนี้ */
function Steps({ items }: { items: { title: string; text: ReactNode }[] }) {
  return (
    <ol className="grid grid-cols-4 gap-[3mm]">
      {items.map((s, i) => (
        <li key={s.title} className="rounded-[3mm] bg-sunken p-[3.5mm]">
          <span className="grid size-[8mm] place-items-center rounded-full bg-brand text-[12pt] font-semibold text-white">{i + 1}</span>
          <p className="mt-[2.5mm] text-[12.5pt] font-semibold leading-snug">{s.title}</p>
          <p className="mt-[1mm] text-[10.5pt] leading-snug text-ink-muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-[2.5mm] text-[11.5pt] leading-snug">
      {items.map((t, i) => <li key={i} className="flex gap-[2mm]"><span aria-hidden="true" className="mt-[2mm] size-[1.6mm] shrink-0 rounded-full bg-brand" /><span className="min-w-0">{t}</span></li>)}
    </ul>
  );
}

const Key = ({ children }: { children: ReactNode }) => <b className="font-semibold text-ink">“{children}”</b>;

function LoginBox({ user, pass, note }: { user: ReactNode; pass: ReactNode; note: ReactNode }) {
  return (
    <div className="flex items-center gap-[6mm] rounded-[3mm] border-[0.4mm] border-brand-border bg-brand-soft p-[5mm]">
      <div className="shrink-0 rounded-[2mm] bg-white p-[1.5mm]"><QrImage value={siteUrl('/')} size={130} label="QR Code เว็บ TLMis" className="h-[32mm] w-[32mm]" /></div>
      <dl className="grid min-w-0 flex-1 gap-[2.5mm] text-[11pt]">
        <div><dt className="text-[9.5pt] text-ink-muted">เว็บไซต์ (สแกน QR หรือพิมพ์)</dt><dd className="text-[14pt] font-semibold">{SITE_HOST}</dd></div>
        <div className="grid grid-cols-2 gap-[4mm]">
          <div><dt className="text-[9.5pt] text-ink-muted">ชื่อผู้ใช้</dt><dd className="font-semibold">{user}</dd></div>
          <div><dt className="text-[9.5pt] text-ink-muted">รหัสผ่าน</dt><dd className="font-semibold">{pass}</dd></div>
        </div>
        <dd className="text-[9.5pt] leading-snug text-ink-muted">{note}</dd>
      </dl>
    </div>
  );
}

function PosterFooter({ helpFor }: { helpFor: string }) {
  return (
    <footer className="mt-auto flex shrink-0 items-center gap-[5mm] border-t-[0.3mm] border-line px-[14mm] py-[4mm]">
      <QrImage value={siteUrl(`/help?for=${helpFor}`)} size={80} label="QR Code คู่มือแบบละเอียด" className="h-[17mm] w-[17mm]" />
      <p className="flex-1 text-[9.5pt] leading-snug text-ink-muted">
        คู่มือแบบละเอียดพร้อมภาพหน้าจอ: สแกน QR หรือเปิด {SITE_HOST}/help<br />
        วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์ · 290 ต.บ้านครัว อ.บ้านหมอ จ.สระบุรี 18270
      </p>
    </footer>
  );
}

/* ---------------- โปสเตอร์นักศึกษา ---------------- */

function StudentPoster() {
  return (
    <div className="a4 flex flex-col">
      <PosterHeader audience="นักศึกษา" />
      <div className="grid gap-[7mm] px-[14mm] pt-[8mm] pb-[6mm]">
        <Section title="เข้าสู่ระบบ">
          <LoginBox user="รหัสนักศึกษา 11 หลัก" pass={<>วันเดือนปีเกิด พ.ศ. <span className="font-normal text-ink-muted">เช่น</span> 01/11/2551</>}
            note="ใส่รหัสผิด 5 ครั้งติดกัน บัญชีล็อก 15 นาที · ลืมรหัสผ่าน ติดต่องานทะเบียนพร้อมบัตรนักศึกษา" />
        </Section>
        <Section title="ยื่นคำร้องออนไลน์">
          <Steps items={[
            { title: 'เลือกเรื่อง', text: <>เมนู <Key>คำร้อง</Key> แล้วกดเรื่องที่ต้องการ หรือสแกน QR ของแบบฟอร์มที่งานทะเบียน</> },
            { title: 'กรอกเฉพาะที่ถาม', text: 'ชื่อ รหัส สาขา ระบบเติมให้แล้ว ดูแบบฟอร์มจริงได้ก่อนยื่น' },
            { title: 'กดยื่นคำร้อง', text: <>กด <Key>ยื่นคำร้อง</Key> ได้เลขที่คำร้องทันที อ่านรายการเอกสารที่ต้องนำมาด้วย</> },
            { title: 'ติดตามผล', text: <>ดูได้ว่าอยู่ขั้นไหน ถ้า <Key>อนุมัติแล้ว</Key> ไปรับเอกสารที่งานทะเบียน แจ้งเลขที่คำร้อง</> },
          ]} />
        </Section>
        <div className="grid grid-cols-2 gap-[8mm]">
          <Section title="ดูข้อมูลการเรียน">
            <Bullets items={[
              <><Key>ผลการเรียน</Key> เกรดรายภาค เกรดเฉลี่ยสะสม พิมพ์รายงานผลการศึกษาได้</>,
              <><Key>ตารางเรียน</Key> ตารางรายสัปดาห์ของห้องตัวเอง</>,
              <><Key>แผนการเรียน</Key> วิชาทั้งหลักสูตร ผ่านแล้วกี่หน่วยกิต</>,
              <><Key>บัตรลงทะเบียน</Key> วิชาที่ลงทะเบียนภาคนี้</>,
            ]} />
          </Section>
          <Section title="ถ้าติดปัญหา">
            <Bullets items={[
              <>คำร้องถูก <Key>ส่งกลับให้แก้ไข</Key> อ่านเหตุผล แล้วกด <Key>แก้ไขแล้วส่งใหม่</Key></>,
              'ยังไม่มีใครพิจารณา ยกเลิกคำร้องเองได้',
              'เกรดขึ้นหลังงานวัดผลประกาศผลแล้วเท่านั้น',
              <>ติดตั้งเป็นแอป: iPhone กดแชร์ › <Key>เพิ่มไปยังหน้าจอโฮม</Key> · Android กด <Key>ติดตั้งแอป</Key></>,
            ]} />
          </Section>
        </div>
      </div>
      <PosterFooter helpFor="student" />
    </div>
  );
}

/* ---------------- โปสเตอร์ครูและเจ้าหน้าที่ ---------------- */

function StaffPoster() {
  return (
    <div className="a4 flex flex-col">
      <PosterHeader audience="ครูและเจ้าหน้าที่" />
      <div className="grid gap-[4mm] px-[14mm] pt-[5mm] pb-[3mm]">
        <Section title="เข้าสู่ระบบ">
          <LoginBox user="ชื่อผู้ใช้จากผู้ดูแลระบบ" pass="รหัสชั่วคราว เปลี่ยนหลังเข้าครั้งแรก"
            note={<>เปลี่ยนรหัสผ่าน: กดไอคอนกุญแจมุมขวาบน · ใส่ผิด 5 ครั้งล็อก 15 นาที ผู้ดูแลระบบปลดล็อกได้</>} />
        </Section>
        <Section title="พิจารณาคำร้อง">
          <Steps items={[
            { title: 'เปิดคำร้องที่รอ', text: <>เมนู <Key>พิจารณาคำร้อง</Key> เรียงจากเรื่องที่รอนานที่สุด</> },
            { title: 'ลงความเห็น', text: 'ความเห็นที่พิมพ์ลงในช่องความเห็นของแบบฟอร์ม' },
            { title: 'เลือกผล', text: <><Key>เห็นควร ส่งต่อ</Key> <Key>ส่งกลับแก้ไข</Key> หรือ <Key>ไม่อนุมัติ</Key> (ต้องบอกเหตุผล)</> },
            { title: 'ส่งต่ออัตโนมัติ', text: 'คำร้องไปหาผู้พิจารณาขั้นถัดไปเอง นักศึกษาเห็นสถานะทันที' },
          ]} />
        </Section>
        <Section title="ครูผู้สอน: กรอกเกรด">
          <Steps items={[
            { title: 'เลือกวิชา', text: <>เมนู <Key>กรอกเกรด</Key> แสดงวิชาที่สอนภาคนี้และกำหนดส่ง</> },
            { title: 'กรอกคะแนนรวม', text: 'กรอกในตาราง หรืออัปโหลดจาก Excel ระบบตัดเกรดให้' },
            { title: 'ผลพิเศษ', text: 'นักเรียนที่ไม่มีคะแนน เลือก ร หรือ มส' },
            { title: 'ยืนยันส่ง', text: <>ครบทุกคนแล้วกด <Key>ยืนยันส่งผลการเรียน</Key></> },
          ]} />
        </Section>
        <Section title="งานทะเบียน และงานวัดผล">
          <Bullets items={[
            <>นำเข้ารายชื่อ แผนการเรียน ตารางเรียน เกรด จาก Excel / CSV ที่เมนู <Key>นำเข้าข้อมูล</Key> ไม่บันทึกจนกว่าจะกดยืนยัน</>,
            'งานวัดผลดูว่าใครส่งเกรดแล้ว ส่งคืนให้แก้ อนุมัติ และประกาศผล · การแก้ไขทุกครั้งเก็บประวัติว่าใครทำ',
          ]} />
        </Section>
      </div>
      <PosterFooter helpFor="staff" />
    </div>
  );
}
