'use client';

import { STUDENT_CODE_RE, parseStudentQr, type StudentScanView } from '@csis/shared';
import { Search } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { StudentScanCard } from '@/components/StudentScan';
import { Alert, Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { isAdminUser, isStaffUser, useMe } from '@/lib/me';

export type Lookup = { state: 'idle' } | { state: 'loading'; code: string } | { state: 'ok'; data: StudentScanView } | { state: 'error'; message: string };

/** เรียก API ดูข้อมูลนักเรียนจากรหัส (ใช้ทั้งหน้าสแกนและหน้าที่เปิดจากลิงก์ใน QR) */
export function useStudentLookup() {
  const [r, setR] = useState<Lookup>({ state: 'idle' });
  const lookup = useCallback(async (code: string) => {
    setR({ state: 'loading', code });
    try { setR({ state: 'ok', data: await api.get<StudentScanView>(`/scan/student/${code}`) }); }
    catch (e) { setR({ state: 'error', message: errorMessage(e) }); }
  }, []);
  /** ข้อความจาก QR → ถ้าไม่ใช่บัตรนักศึกษาของระบบ ไม่เปิดลิงก์นั้น */
  const fromQr = useCallback((text: string) => {
    const code = parseStudentQr(text);
    if (code) void lookup(code);
    else setR({ state: 'error', message: 'QR นี้ไม่ใช่บัตรนักศึกษาของระบบ TL MIS ลองสแกน QR บนบัตรหรือบนมือถือของนักเรียน' });
  }, [lookup]);
  const reset = useCallback(() => setR({ state: 'idle' }), []);
  return { r, lookup, fromQr, reset };
}

export function LookupResult({ r }: { r: Lookup }) {
  const { me } = useMe();
  if (r.state === 'idle') return null;
  if (r.state === 'loading') return <Spinner label={`กำลังค้นหารหัส ${r.code}`} />;
  if (r.state === 'error') return <Alert>{r.message}</Alert>;
  const canOpen = !!me && (isAdminUser(me) || me.roles.includes('REGISTRAR'));
  return <StudentScanCard s={r.data} canOpenRecord={canOpen} />;
}

export function ManualCode({ onCode }: { onCode: (code: string) => void }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = v.replace(/\D/g, '');
    if (!STUDENT_CODE_RE.test(code)) { setErr('กรอกรหัสนักศึกษาเป็นตัวเลข 5–15 หลัก'); return; }
    setErr(''); onCode(code);
  };
  return (
    <form onSubmit={submit} className="mx-auto grid w-full max-w-sm gap-1.5" noValidate>
      <label htmlFor="scan-code" className="text-[15px] font-medium">หรือพิมพ์รหัสนักศึกษา</label>
      <div className="flex gap-2">
        <input id="scan-code" value={v} onChange={(e) => setV(e.target.value)} inputMode="numeric" autoComplete="off" placeholder="เช่น 68302020002" aria-invalid={!!err} aria-describedby={err ? 'scan-code-err' : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-[var(--radius-control)] bg-surface px-3 text-[17px] tabular-nums ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand" />
        <Button type="submit" className="min-h-12" icon={<Search className="size-4" aria-hidden="true" />}>ค้นหา</Button>
      </div>
      {err && <p id="scan-code-err" className="text-sm text-danger">{err}</p>}
    </form>
  );
}

/** นักเรียนใช้หน้านี้ไม่ได้ (เซิร์ฟเวอร์ก็ปฏิเสธ) — บอกให้ชัดแทนการโชว์ error */
export function StaffOnly({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  if (me && !isStaffUser(me)) {
    return <Alert tone="info">การสแกนดูข้อมูลนักเรียนใช้ได้เฉพาะครูและเจ้าหน้าที่ ดูข้อมูลของตัวเองได้ที่เมนู “ข้อมูลประวัติ”</Alert>;
  }
  return <>{children}</>;
}
