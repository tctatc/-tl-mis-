'use client';

import type { Me } from '@csis/shared';
import { CalendarDays, ClipboardCheck, Eye, EyeOff, FileText, GraduationCap, LogIn, Smartphone, Upload, type LucideIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Brand } from '@/components/Brand';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { homeOf } from '@/lib/me';

/** สิ่งที่ระบบทำได้จริงตอนนี้ — เพิ่มเมื่อมีฟีเจอร์ใหม่ อย่าใส่ของที่ยังไม่มี */
const FEATURES: { title: string; items: { icon: LucideIcon; text: string }[] }[] = [
  {
    title: 'นักศึกษา',
    items: [
      { icon: FileText, text: 'ยื่นคำร้องออนไลน์ เห็นแบบฟอร์มจริงระหว่างกรอก ข้อมูลส่วนตัวเติมให้เอง พิมพ์ได้ทันที' },
      { icon: ClipboardCheck, text: 'ติดตามว่าคำร้องอยู่ที่ใคร อนุมัติถึงขั้นไหนแล้ว' },
      { icon: CalendarDays, text: 'ดูแผนการเรียน ตารางเรียน และบัตรลงทะเบียน' },
      { icon: GraduationCap, text: 'ดูผลการเรียนรายภาค เกรดเฉลี่ย และเกรดเฉลี่ยสะสม' },
    ],
  },
  {
    title: 'ครูและเจ้าหน้าที่',
    items: [
      { icon: ClipboardCheck, text: 'ลงความเห็นและอนุมัติคำร้องตามลำดับขั้น' },
      { icon: Upload, text: 'งานทะเบียนนำเข้ารายชื่อนักเรียน แผนการเรียน ตารางเรียน และเกรด จาก Excel หรือ CSV' },
    ],
  },
];

function Features() {
  return (
    <section aria-labelledby="features-title" className="max-w-xl">
      <h2 id="features-title" className="text-2xl font-semibold leading-snug text-balance sm:text-[28px]">ยื่นคำร้องและดูข้อมูลการเรียน ได้ในที่เดียว</h2>
      <p className="mt-2 text-[15px] text-ink-muted text-pretty">ไม่ต้องเดินไปขอแบบฟอร์มที่งานทะเบียน กรอกบนเว็บแล้วพิมพ์ออกมาเป็นแบบฟอร์มของวิทยาลัย</p>
      <div className="mt-8 grid gap-7">
        {FEATURES.map((group) => (
          <div key={group.title}>
            <h3 className="text-[13px] font-semibold tracking-wide text-brand">{group.title}</h3>
            <ul className="mt-3 grid gap-3">
              {group.items.map(({ icon: Icon, text }) => (
                <li key={text} className="flex gap-3 text-[15px] leading-relaxed">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="size-4" aria-hidden="true" /></span>
                  <span className="pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-8 flex items-center gap-2 text-sm text-ink-muted"><Smartphone className="size-4 shrink-0" aria-hidden="true" />ใช้บนมือถือได้ และเพิ่มไว้ที่หน้าจอโฮมเหมือนแอปได้</p>
    </section>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      await api.post('/auth/login', { username, password });
      const me = await api.get<Me>('/auth/me');
      const next = params.get('next');
      // รับเฉพาะ path ภายในเว็บ กัน open redirect
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      router.replace(me.mustChangePassword ? '/change-password' : safeNext ?? homeOf(me));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(Object.keys(err.fields).length ? '' : err.message);
        setFields(err.fields);
      } else setError('เข้าสู่ระบบไม่สำเร็จ');
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh px-4 py-10 sm:px-8 lg:grid lg:place-items-center lg:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="mb-10 hidden lg:block"><Brand /></div>
          <Features />
        </div>
        <div className="rise order-1 mx-auto w-full max-w-[420px] lg:order-2">
          <div className="mb-6 flex justify-center lg:hidden"><Brand /></div>
          <Card className="p-6 sm:p-8">
            <h1 className="text-xl font-semibold">เข้าสู่ระบบ</h1>
            <p className="mt-1 text-[15px] text-ink-muted">นักศึกษาใช้รหัสนักศึกษา ครูและเจ้าหน้าที่ใช้บัญชีที่ได้รับจากวิทยาลัย</p>
            <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
              <Field label="ชื่อผู้ใช้ / รหัสนักศึกษา" error={fields.username}>
                {({ id, describedBy, invalid }) => (
                  <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" inputMode="text" autoCapitalize="none" spellCheck={false} required autoFocus />
                )}
              </Field>
              <Field label="รหัสผ่าน" hint="ครั้งแรก: วันเดือนปีเกิด (พ.ศ.) เช่น 01/11/2551" error={fields.password}>
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
              <Button type="submit" loading={busy} icon={<LogIn className="size-4" aria-hidden="true" />} className="mt-1 w-full">เข้าสู่ระบบ</Button>
            </form>
          </Card>
          <p className="mt-5 text-center text-sm text-ink-muted">ลืมรหัสผ่าน ติดต่องานทะเบียนพร้อมบัตรนักศึกษา</p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
