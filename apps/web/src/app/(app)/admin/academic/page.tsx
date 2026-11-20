'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';

export default function AcademicIndex() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/academic/plan'); }, [router]);
  return <Spinner />;
}
