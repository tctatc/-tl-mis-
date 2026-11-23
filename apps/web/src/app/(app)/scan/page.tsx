'use client';

import { ScanLine } from 'lucide-react';
import { useState } from 'react';
import { QrScanner } from '@/components/StudentScan';
import { Button } from '@/components/ui';
import { LookupResult, ManualCode, StaffOnly, useStudentLookup } from './StudentLookup';

export default function ScanPage() {
  const { r, lookup, fromQr, reset } = useStudentLookup();
  const [again, setAgain] = useState(false);
  const showResult = r.state !== 'idle';
  return (
    <div className="mx-auto grid max-w-xl gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-[28px]"><ScanLine className="size-7 text-brand" aria-hidden="true" />สแกน QR นักเรียน</h1>
        <p className="mt-1 text-[16px] text-ink-muted">สแกน QR บัตรนักศึกษาจากมือถือของนักเรียน เพื่อดูชื่อ ชั้น สาขา สถานะ และครูที่ปรึกษา</p>
      </div>
      <StaffOnly>
        {showResult ? (
          <div className="grid gap-4">
            <LookupResult r={r} />
            {r.state !== 'loading' && (
              <Button className="min-h-14 text-[17px]" icon={<ScanLine className="size-5" aria-hidden="true" />} onClick={() => { reset(); setAgain(true); }}>สแกนคนต่อไป</Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5">
            <QrScanner active={again} onText={fromQr} />
            <ManualCode onCode={(c) => void lookup(c)} />
          </div>
        )}
      </StaffOnly>
    </div>
  );
}
