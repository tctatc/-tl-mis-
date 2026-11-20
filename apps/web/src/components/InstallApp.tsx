'use client';

import { Download, Share } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cx } from './ui';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// เบราว์เซอร์ยิง beforeinstallprompt ครั้งเดียวตอนโหลดหน้า อาจก่อนปุ่มถูกวาด จึงดักไว้ตั้งแต่โหลดไฟล์นี้
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
// iPhone/iPad ไม่มีหน้าต่างติดตั้ง ต้องบอกให้กดแชร์เอง (iPadOS รายงานตัวเป็น Mac ที่มีจอสัมผัส)
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** ปุ่ม "ติดตั้งแอป" — ซ่อนเองเมื่อเปิดจากแอปที่ติดตั้งแล้ว หรือเบราว์เซอร์ติดตั้งไม่ได้ */
export function InstallApp({ variant = 'button', className }: { variant?: 'button' | 'row'; className?: string }) {
  const [, rerender] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    setMounted(true);
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  if (!mounted || isStandalone()) return null;
  const ios = !deferred && isIos();
  if (!deferred && !ios) return null;

  const install = async () => {
    if (!deferred) { setHint((v) => !v); return; }
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    rerender((n) => n + 1);
  };

  return (
    <div className={className}>
      <button type="button" onClick={() => void install()} aria-expanded={ios ? hint : undefined}
        className={cx(variant === 'row'
          ? 'flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-left text-[15px] hover:bg-sunken'
          : 'inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-brand hover:bg-brand-soft')}>
        {variant === 'row'
          ? <span className="grid size-9 place-items-center rounded-[var(--radius-control)] bg-brand-soft text-brand"><Download className="size-5" aria-hidden="true" /></span>
          : <Download className="size-4" aria-hidden="true" />}
        ติดตั้งแอป
      </button>
      {hint && (
        <p className="mt-1 flex flex-wrap items-center gap-1 px-3 text-sm text-ink-muted" role="status">
          เปิดใน Safari กดปุ่มแชร์ <Share className="inline size-4" aria-label="แชร์" /> แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”
        </p>
      )}
    </div>
  );
}
