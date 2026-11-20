'use client';

import { useEffect } from 'react';

/** ลงทะเบียน service worker เฉพาะ production (ตอน dev จะชนกับ hot reload ของ Next) */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* ไม่รองรับก็ใช้เป็นเว็บธรรมดา */ });
  }, []);
  return null;
}

/** เรียกตอนออกจากระบบ: ให้ service worker ล้างหน้าที่เก็บไว้ */
export function clearAppCache() {
  navigator.serviceWorker?.controller?.postMessage('logout');
}
