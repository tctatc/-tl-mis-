'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';

/** การนำเข้าย้ายไปอยู่ในหน้านักเรียนแล้ว (ลิงก์เดิมยังใช้ได้) */
export default function ImportRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/students?import=1'); }, [router]);
  return <Spinner />;
}
