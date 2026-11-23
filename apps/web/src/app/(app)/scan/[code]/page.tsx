'use client';

import { STUDENT_CODE_RE } from '@csis/shared';
import { ScanLine } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Alert } from '@/components/ui';
import { isStaffUser, useMe } from '@/lib/me';
import { LookupResult, StaffOnly, useStudentLookup } from '../StudentLookup';

/** เปิดจากกล้องมือถือ (ลิงก์ใน QR) — ยังไม่ล็อกอินจะถูกพาไปเข้าสู่ระบบแล้วกลับมาหน้านี้เอง */
export default function ScanResultPage() {
  const { code } = useParams<{ code: string }>();
  const { me } = useMe();
  const { r, lookup } = useStudentLookup();
  const valid = STUDENT_CODE_RE.test(code);
  const staff = !!me && isStaffUser(me);
  useEffect(() => { if (valid && staff) void lookup(code); }, [code, valid, staff, lookup]);
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <h1 className="text-2xl font-semibold">ข้อมูลนักเรียนจาก QR</h1>
      <StaffOnly>
        {valid ? <LookupResult r={r} /> : <Alert>ลิงก์นี้ไม่ถูกต้อง</Alert>}
        <Link href="/scan" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand px-4 text-[17px] font-medium text-ink-inverse hover:bg-brand-hover">
          <ScanLine className="size-5" aria-hidden="true" />สแกนคนอื่น
        </Link>
      </StaffOnly>
    </div>
  );
}
