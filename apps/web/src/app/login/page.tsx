'use client';

import { THAI_MONTHS_SHORT, toBuddhistYear, type Me, type PublicOverview } from '@csis/shared';
import { BookOpen, CalendarDays, ChevronRight, Clock3, Eye, EyeOff, FileText, GraduationCap, LogIn, QrCode, Smartphone, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { BarList, ColumnChart } from '@/components/charts';
import { Alert, Button, Field, Input, cx } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { homeOf } from '@/lib/me';

/**
 * หน้าแรกของ TLMis = หน้าเข้าสู่ระบบ + ภาพรวมวิทยาลัย
 * งานหลักของหน้านี้คือ "เข้าสู่ระบบ" — ช่องกรอกจึงอยู่จอแรกเสมอ (มือถือขึ้นก่อนทุกอย่าง)
 * ตัวเลขภาพรวมเป็นยอดรวมจาก /public/overview ไม่มีข้อมูลรายคน
 */

/** สิ่งที่ระบบทำได้จริงตอนนี้ — อย่าใส่ของที่ยังไม่มี */
const SERVICES: { icon: LucideIcon; text: string }[] = [
  { icon: FileText, text: 'ยื่นคำร้อง เห็นแบบฟอร์มจริง' },
  { icon: Clock3, text: 'ติดตามว่าคำร้องอยู่ขั้นไหน' },
  { icon: GraduationCap, text: 'ผลการเรียน เกรดเฉลี่ยสะสม' },
  { icon: CalendarDays, text: 'ตารางเรียน บัตรลงทะเบียน' },
];

const n = (v: number) => v.toLocaleString('th-TH');
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return `${THAI_MONTHS_SHORT[m! - 1]} ${String(toBuddhistYear(y!)).slice(2)}`;
};

function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const next = params.get('next');
  // รับเฉพาะ path ภายในเว็บ กัน open redirect
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      await api.post('/auth/login', { username, password });
      const me = await api.get<Me>('/auth/me');
      router.replace(me.mustChangePassword ? '/change-password' : safeNext ?? homeOf(me));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(Object.keys(err.fields).length ? '' : err.message);
        setFields(err.fields);
      } else setError('เข้าสู่ระบบไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
      setBusy(false);
    }
  }

  return (
    <div className="rise rounded-[18px] bg-surface p-6 text-ink shadow-[0_2px_6px_hsl(350_40%_10%/0.12),0_28px_60px_-24px_hsl(350_60%_8%/0.55)] sm:p-8">
      <h2 className="text-[22px] font-semibold">เข้าสู่ระบบ</h2>
      {safeNext?.startsWith('/student/new/')
        ? <p className="mt-1 text-[15px] text-ink-muted">เข้าสู่ระบบแล้วระบบจะพาไปที่แบบฟอร์มคำร้องที่สแกนมาทันที</p>
        : <p className="mt-1 text-[15px] text-ink-muted">นักศึกษาใช้รหัสนักศึกษา ครูและเจ้าหน้าที่ใช้บัญชีที่ได้รับจากวิทยาลัย</p>}
      <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
        <Field label="ชื่อผู้ใช้ / รหัสนักศึกษา" error={fields.username}>
          {({ id, describedBy, invalid }) => (
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" inputMode="text" autoCapitalize="none" spellCheck={false} required autoFocus />
          )}
        </Field>
        <Field label="รหัสผ่าน" hint="นักศึกษาครั้งแรก: วันเดือนปีเกิด (พ.ศ.) เช่น 01/11/2551" error={fields.password}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="pr-12" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted hover:text-ink" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" loading={busy} icon={<LogIn className="size-4" aria-hidden="true" />} className="mt-1 min-h-12 w-full text-[17px]">เข้าสู่ระบบ</Button>
      </form>
      <p className="mt-5 border-t border-line pt-4 text-sm text-ink-muted">ลืมรหัสผ่าน ติดต่องานทะเบียนพร้อมบัตรนักศึกษา</p>
    </div>
  );
}

/* ---------------- ภาพรวมวิทยาลัย ---------------- */

function useOverview() {
  const [data, setData] = useState<PublicOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.get<PublicOverview>('/public/overview').then(setData).catch(() => setFailed(true));
  }, []);
  return { data, failed };
}

function Figure({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-4 sm:px-6 sm:py-5">
      <dt className="text-[15px] text-ink-muted">{label}</dt>
      <dd className="mt-1.5 text-[34px] leading-none font-semibold tracking-[-0.02em] tabular-nums sm:text-[40px]">{value}</dd>
      {note && <dd className="mt-2 text-sm text-ink-muted">{note}</dd>}
    </div>
  );
}

function Overview() {
  const { data, failed } = useOverview();
  if (failed) return null; // ภาพรวมเป็นของเสริม โหลดไม่ได้ก็ไม่ขวางการเข้าสู่ระบบ
  const s = data?.students;
  const r = data?.requests;
  const dash = <span className="text-ink-muted">–</span>;
  const updated = data ? new Date(data.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';

  return (
    <section aria-labelledby="overview-title" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h2 id="overview-title" className="text-[22px] font-semibold">ภาพรวมวิทยาลัย</h2>
        <p className="text-sm text-ink-muted" aria-live="polite">{data ? `ข้อมูลล่าสุด ${updated} น.` : 'กำลังโหลดข้อมูล…'}</p>
      </div>

      {/* เส้นคั่นระหว่างช่อง = พื้นสีเส้นที่โผล่จาก gap 1px */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line/80 shadow-card ring-1 ring-line/70 lg:grid-cols-4">
        <Figure label="นักศึกษาที่กำลังศึกษา" value={s ? n(s.studying) : dash} note={s ? <>ปวช. <b className="font-semibold text-ink tabular-nums">{n(s.pvc)}</b> · ปวส. <b className="font-semibold text-ink tabular-nums">{n(s.pvs)}</b></> : null} />
        <Figure label="สาขาที่มีนักศึกษา" value={s ? n(s.programs) : dash} note={s ? `${n(s.byDepartment.length)} ประเภทวิชา` : null} />
        <Figure label="คำร้องออนไลน์" value={r ? n(r.total) : dash} note={r ? <>อนุมัติแล้ว <b className="font-semibold text-ink tabular-nums">{n(r.approved)}</b> · กำลังดำเนินการ <b className="font-semibold text-ink tabular-nums">{n(r.open)}</b></> : null} />
        <Figure label="ยื่นจนได้ผล เฉลี่ย" value={r ? (r.avgDays === null ? dash : <>{r.avgDays.toLocaleString('th-TH', { maximumFractionDigits: 1 })}<span className="ml-1.5 text-lg font-normal text-ink-muted">วัน</span></>) : dash} note={r?.avgDays === null ? 'ยังไม่มีคำร้องที่ได้ผล' : 'นับจากวันยื่นถึงวันอนุมัติ/ไม่อนุมัติ'} />
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        <Block title="คำร้องที่ยื่นแต่ละเดือน" className="lg:col-span-2">
          {r ? (r.total === 0
            ? <Empty>ยังไม่มีคำร้องออนไลน์ เมื่อนักศึกษาเริ่มยื่น กราฟจะแสดงที่นี่</Empty>
            : <ColumnChart label="จำนวนคำร้องรายเดือน" items={r.monthly.map((m) => ({ key: m.month, label: monthLabel(m.month), value: m.count }))} />)
            : <Skeleton />}
        </Block>
        <Block title="เรื่องที่ยื่นมากที่สุด">
          {r ? <BarList empty="ยังไม่มีคำร้อง" unit="ฉบับ" items={r.topTypes.map((t) => ({ key: t.code, label: t.name, value: t.total, tone: 'gold' }))} /> : <Skeleton />}
        </Block>
        <Block title="นักศึกษาตามประเภทวิชา" className="lg:col-span-3">
          {s ? <BarList empty="ยังไม่มีข้อมูลนักศึกษา" unit="คน" items={s.byDepartment.map((d) => ({ key: d.name, label: d.name.replace(/^ประเภทวิชา/, ''), value: d.count }))} /> : <Skeleton />}
        </Block>
      </div>
    </section>
  );
}

function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={cx('min-w-0 rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70 sm:p-5', className)}>
      <h3 className="mb-3 text-[17px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}
const Empty = ({ children }: { children: ReactNode }) => <p className="grid min-h-44 place-items-center px-4 text-center text-ink-muted">{children}</p>;
const Skeleton = () => <div className="h-44 animate-pulse rounded-[var(--radius-control)] bg-sunken" aria-hidden="true" />;

/* ---------------- ทางลัด ---------------- */

const LINKS: { href: string; icon: LucideIcon; title: string; text: string }[] = [
  { href: '/help/poster', icon: BookOpen, title: 'คู่มือการใช้งาน', text: 'โปสเตอร์สรุปและไฟล์ PDF สำหรับนักศึกษา ครู และเจ้าหน้าที่' },
  { href: '/help/qr', icon: QrCode, title: 'QR Code แบบฟอร์มคำร้อง', text: 'สแกนแล้วกรอกคำร้องต่อบนมือถือได้ทันที' },
];

function Shortcuts() {
  return (
    <nav aria-label="ทางลัด" className="grid divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card ring-1 ring-line/70 md:grid-cols-2 md:divide-x md:divide-y-0">
      {LINKS.map(({ href, icon: Icon, title, text }) => (
        <Link key={href} href={href} className="group flex items-center gap-4 p-4 hover:bg-sunken focus-visible:bg-sunken sm:p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-brand-soft text-brand"><Icon className="size-5" aria-hidden="true" /></span>
          <span className="grid min-w-0 flex-1">
            <span className="font-semibold group-hover:text-brand">{title}</span>
            <span className="text-sm text-ink-muted">{text}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      ))}
    </nav>
  );
}

/* ---------------- หน้า ---------------- */

function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* แถบแดงเข้มด้านบน: ตรา + ชื่อระบบ + ช่องเข้าสู่ระบบ */}
      <div className="relative isolate overflow-hidden bg-brand-deep text-white">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_32rem_at_85%_-10%,hsl(352_62%_32%/0.9),transparent_70%),radial-gradient(40rem_24rem_at_-10%_110%,hsl(42_92%_54%/0.10),transparent_70%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-px bg-gold/60" />
        <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-5 pb-2 sm:px-8 sm:pt-7">
          <Brand tone="inverse" />
          <nav aria-label="ลิงก์ช่วยเหลือ" className="ml-auto hidden items-center gap-1 md:flex">
            <Link href="/help" className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[15px] text-white/85 hover:bg-white/10 hover:text-white"><BookOpen className="size-4" aria-hidden="true" />คู่มือ</Link>
            <Link href="/help/qr" className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[15px] text-white/85 hover:bg-white/10 hover:text-white"><QrCode className="size-4" aria-hidden="true" />QR แบบฟอร์ม</Link>
          </nav>
        </header>

        <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 pt-6 pb-10 sm:px-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 lg:pt-14 lg:pb-16">
          <div className="order-2 lg:order-1">
            {/* ภาษาไทยไม่มีช่องว่างระหว่างคำ: ห่อเป็นวลี (inline-block) กันเบราว์เซอร์ตัดกลางคำ */}
            <h1 className="text-[32px] leading-[1.25] font-semibold tracking-[-0.01em] sm:text-[44px] lg:text-[50px]">
              <span className="inline-block">ยื่นคำร้อง</span><span className="inline-block">และดูผลการเรียน</span>{' '}
              <span className="inline-block text-gold">ครบในที่เดียว</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-relaxed text-white/80">
              ไม่ต้องไปขอแบบฟอร์มที่งานทะเบียน กรอกบนเว็บหรือมือถือ ระบบพิมพ์ออกมาเป็นแบบฟอร์มของวิทยาลัยให้เอง
            </p>
            <ul className="mt-7 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {SERVICES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-[15px] text-white/90">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-white/10 text-gold ring-1 ring-white/15"><Icon className="size-[18px]" aria-hidden="true" /></span>
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-7 flex items-center gap-2 text-sm text-white/70"><Smartphone className="size-4 shrink-0" aria-hidden="true" />ใช้บนมือถือได้ และเพิ่มไว้ที่หน้าจอโฮมเหมือนแอป</p>
          </div>
          <div className="order-1 mx-auto w-full max-w-[440px] lg:order-2">
            <Suspense><LoginCard /></Suspense>
          </div>
        </div>
      </div>

      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-10 sm:px-8 sm:py-12">
        <Overview />
        <Shortcuts />
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-muted sm:px-8">
          <p>วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์ · 290 ต.บ้านครัว อ.บ้านหมอ จ.สระบุรี 18270</p>
          <p className="flex gap-4">
            <Link href="/help" className="underline-offset-2 hover:text-ink hover:underline">คู่มือการใช้งาน</Link>
            <Link href="/help/qr" className="underline-offset-2 hover:text-ink hover:underline">QR แบบฟอร์มคำร้อง</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return <LandingPage />;
}
