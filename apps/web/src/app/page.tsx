'use client';

import type { Me } from '@csis/shared';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { homeOf } from '@/lib/me';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    api.get<Me>('/auth/me').then((me) => router.replace(me.mustChangePassword ? '/change-password' : homeOf(me))).catch(() => router.replace('/login'));
  }, [router]);
  return <Spinner />;
}
