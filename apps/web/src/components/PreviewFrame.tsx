'use client';

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ScaledSheet } from '@/sheets/parts';

/**
 * กรอบแสดงแผ่น A4 แบบเว็บรับสมัคร: ย่อตามความกว้างกรอบอย่างเดียว ขนาดคงที่ ไม่เปลี่ยนตอนเลื่อน
 * หลายแผ่น (เช่น ทอ.02 + ทอ.02-2) เรียงต่อกันลงมา · print = แผ่นเดียวเป็นส่วนที่พิมพ์ออกกระดาษ
 */
export function PreviewFrame({ children, print = false }: { children: ReactNode; print?: boolean }) {
  const pages = Children.toArray(children);
  const multi = pages.length > 1;
  return (
    <div className="rounded-[var(--radius-card)] bg-sunken p-3 ring-1 ring-line/70">
      <div className={print && !multi ? 'print-area' : undefined}>
        {pages.map((page, i) => (
          <div key={i} className="print-page mb-4 last:mb-0">
            {multi && <p className="no-print mb-1.5 text-sm text-ink-muted">แผ่นที่ {i + 1} / {pages.length}</p>}
            <ScaledSheet className="[&_.sheet]:shadow-paper">{page}</ScaledSheet>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ฝั่งขวาของหน้ากรอก (จอใหญ่): อยู่นิ่ง ไม่เลื่อนตามฟอร์ม
 * ย่อแผ่นให้พอดีทั้งกว้างและสูงของพื้นที่ — ขนาดเปลี่ยนเฉพาะตอนปรับขนาดหน้าต่าง ไม่เปลี่ยนตอนเลื่อน
 * หลายแผ่นเลื่อนดูภายในกรอบ
 */
export function FixedPreview({ children }: { children: ReactNode }) {
  const pages = Children.toArray(children);
  const multi = pages.length > 1;
  const ref = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setH(Math.max(240, el.clientHeight - 12 - (multi ? 28 : 0)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [multi]);
  return (
    <div ref={ref} className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-[var(--radius-card)] bg-sunken p-1.5 ring-1 ring-line/70" aria-label="ตัวอย่างแบบฟอร์มที่จะพิมพ์">
      {pages.map((page, i) => (
        <div key={i} className="mb-4 last:mb-0">
          {multi && <p className="mb-1.5 text-sm text-ink-muted">แผ่นที่ {i + 1} / {pages.length}</p>}
          <ScaledSheet className="[&_.sheet]:shadow-paper" maxHeight={h}>{page}</ScaledSheet>
        </div>
      ))}
    </div>
  );
}
