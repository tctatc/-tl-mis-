'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from './api';

/** โหลดข้อมูล GET พร้อมสถานะ loading/error — path เปลี่ยนแล้วโหลดใหม่ */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError('');
    try {
      setData(await api.get<T>(path));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load };
}
