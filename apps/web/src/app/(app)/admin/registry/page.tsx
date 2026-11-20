'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';

export default function RegistryIndex() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/registry/groups'); }, [router]);
  return <Spinner />;
}
