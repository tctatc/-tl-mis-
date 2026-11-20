'use client';

import { getRequestType, type FormData, type RequestDetail, type TemplateKey } from '@csis/shared';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { sheetsFor } from '@/sheets';

/**
 * หน้าพิมพ์ของคำร้องที่มีหลายแผ่น (เช่น ทอ.02 + ทอ.02-2 แนวนอน)
 * แสดงเฉพาะแผ่นกระดาษขนาดจริง ไม่มีเมนู — สั่งพิมพ์ให้อัตโนมัติเมื่อฟอนต์โหลดเสร็จ
 */
export default function PrintRequest() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<RequestDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<RequestDetail>(`/requests/${id}`).then(setD).catch((e) => setError(errorMessage(e)));
  }, [id]);

  useEffect(() => {
    if (!d) return;
    let cancelled = false;
    void document.fonts.ready.then(() => setTimeout(() => !cancelled && window.print(), 300));
    return () => { cancelled = true; };
  }, [d]);

  if (error) return <div className="p-6"><Alert>{error}</Alert></div>;
  if (!d) return <Spinner />;
  const template = (getRequestType(d.typeCode)?.template ?? 'general') as TemplateKey;
  const pages = sheetsFor(template, {
    student: d.student, data: d.data as FormData, submittedAt: d.submittedAt, requestNo: d.requestNo,
    approvals: d.approvals.filter((a) => a.round === d.round), officials: d.officials, studentSigned: d.studentSigned,
  });

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Link href={`/requests/${id}`} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> กลับ</Link>
        <span className="text-[15px] text-ink-muted">{d.requestNo} · {pages.length} แผ่น</span>
        <Button className="ml-auto" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>พิมพ์ / บันทึก PDF</Button>
      </div>
      <main className="print-doc grid justify-center gap-6 overflow-x-auto bg-sunken p-6">
        {pages.map((p, i) => <div key={i} className="print-page shadow-paper">{p}</div>)}
      </main>
    </>
  );
}
