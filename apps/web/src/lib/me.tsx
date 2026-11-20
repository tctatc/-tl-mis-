'use client';

import type { Me } from '@csis/shared';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { clearAppCache } from '@/components/ServiceWorker';
import { api } from './api';

interface MeState { me: Me | null; loading: boolean; refresh: () => Promise<void>; logout: () => Promise<void> }

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.get<Me>('/auth/me'));
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => undefined);
    clearAppCache();
    setMe(null);
    router.replace('/login');
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <MeContext.Provider value={{ me, loading, refresh, logout }}>{children}</MeContext.Provider>;
}

export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe ต้องอยู่ใน MeProvider');
  return ctx;
}

export const isStaffUser = (me: Me) => me.roles.some((r) => r !== 'STUDENT') || me.positions.length > 0;
export const isAdminUser = (me: Me) => me.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
export const homeOf = (me: Me) => (me.student ? '/student' : isAdminUser(me) ? '/admin' : '/staff');
