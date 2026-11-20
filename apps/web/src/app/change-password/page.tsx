'use client';

import { passwordProblem, type Me } from '@csis/shared';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '@/components/Brand';
import { Alert, Button, Card, Field, Input } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { homeOf } from '@/lib/me';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Me>('/auth/me').then(setMe).catch(() => router.replace('/login'));
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(next);
    if (problem) {
      setFields({ next: problem });
      return;
    }
    if (next !== confirm) {
      setFields({ confirm: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน' });
      return;
    }
    setBusy(true);
    setFields({});
    try {
      await api.post('/auth/change-password', { current, next });
      router.replace(me ? `${homeOf(me)}` : '/');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setFields(err.fields);
      else setError(err instanceof Error ? err.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      setBusy(false);
    }
  }

  const first = me?.mustChangePassword;
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="rise w-full max-w-[440px]">
        <div className="mb-6 flex justify-center"><Brand /></div>
        {me && !first && (
          <Link href={homeOf(me)} className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> กลับ</Link>
        )}
        <Card className="p-6 sm:p-8">
          <h1 className="text-xl font-semibold">{first ? 'ตั้งรหัสผ่านใหม่ก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน'}</h1>
          {first && <p className="mt-1 text-[15px] text-ink-muted">ผู้ดูแลระบบกำหนดให้ตั้งรหัสผ่านใหม่ก่อนใช้งาน</p>}
          <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
            <Field label={first ? 'รหัสผ่านเดิม (วันเกิด)' : 'รหัสผ่านปัจจุบัน'} error={fields.current}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required autoFocus />}
            </Field>
            <Field label="รหัสผ่านใหม่" hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข ห้ามใช้วันเกิดหรือรหัสนักศึกษา" error={fields.next}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required minLength={8} />}
            </Field>
            <Field label="ยืนยันรหัสผ่านใหม่" error={fields.confirm}>
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />}
            </Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" loading={busy} icon={<KeyRound className="size-4" aria-hidden="true" />} className="mt-1 w-full">บันทึกรหัสผ่านใหม่</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
