'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { useMe } from '@/lib/me';

export default function AcademicIndex() {
  const router = useRouter();
  const { me } = useMe();
  // งานวัดผลเริ่มที่กระดานส่งผล งานทะเบียนเริ่มที่ผลการเรียนรายห้อง
  const assessment = !!me?.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'ASSESSMENT_STAFF');
  useEffect(() => { if (me) router.replace(assessment ? '/admin/academic/grading' : '/admin/academic/grades'); }, [router, me, assessment]);
  return <Spinner />;
}
