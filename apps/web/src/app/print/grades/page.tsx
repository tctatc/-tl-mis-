'use client';

import type { GradesView, Me, ProfileView } from '@csis/shared';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Alert, Button, Spinner } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { GradeReportSheet, paginateReport } from '@/sheets/GradeReportSheet';

/**
 * รายงานผลการศึกษา (A4) ตามแบบของวิทยาลัย — ?term=<id> = ภาคเดียว, ?term=all = ทุกภาค
 * เปิดแล้วสั่งพิมพ์ให้อัตโนมัติเมื่อฟอนต์โหลดเสร็จ
 */
function GradeReport() {
  const term = useSearchParams().get('term') ?? 'all';
  const me = useApi<Me>('/auth/me').data;
  const grades = useApi<GradesView>('/student/grades');
  const profile = useApi<ProfileView>('/student/profile');
  const ready = !!(grades.data && profile.data && me?.student);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void document.fonts.ready.then(() => setTimeout(() => !cancelled && window.print(), 300));
    return () => { cancelled = true; };
  }, [ready]);

  const error = grades.error || profile.error || (me && !me.student ? 'หน้านี้สำหรับนักศึกษาเท่านั้น' : '');
  if (error) return <div className="p-6"><Alert>{error}</Alert></div>;
  if (!ready) return <Spinner />;

  // API เรียงจากล่าสุด → รายงานเรียงจากภาคแรก
  const terms = [...grades.data!.terms].reverse().filter((t) => term === 'all' || t.term.id === term);
  const pages = paginateReport(terms);
  const info = { student: me!.student!, status: profile.data!.status };

  return (
    <>
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface px-4 py-2">
        <Link href="/student/grades" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] text-ink-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" /> กลับ</Link>
        <span className="text-[15px] text-ink-muted">รายงานผลการศึกษา · {terms.length === 1 ? `ภาคเรียนที่ ${terms[0]!.term.label}` : `${terms.length} ภาคเรียน`} · {pages.length} แผ่น</span>
        <Button className="ml-auto" onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>พิมพ์ / บันทึก PDF</Button>
      </div>
      {terms.length === 0 ? <div className="p-6"><Alert>ไม่พบผลการเรียนของภาคเรียนที่เลือก</Alert></div> : (
        <main className="print-doc grid justify-center gap-6 overflow-x-auto bg-sunken p-6">
          {pages.map((pieces, i) => (
            <div key={i} className="print-page shadow-paper"><GradeReportSheet info={info} pieces={pieces} page={i + 1} pages={pages.length} /></div>
          ))}
        </main>
      )}
    </>
  );
}

export default function PrintGrades() {
  return <Suspense fallback={<Spinner />}><GradeReport /></Suspense>;
}
