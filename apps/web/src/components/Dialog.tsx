'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

/** กล่องโต้ตอบ: ใช้ <dialog> ของเบราว์เซอร์ (กัก focus, Esc ปิด, คืน focus ให้ปุ่มเดิมเอง) */
export function Dialog({ open, onClose, title, children, wide = false, xl = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; xl?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onClose={(e) => { if (e.target === e.currentTarget) onClose(); }} onCancel={(e) => { if (e.target !== e.currentTarget) return; e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={`m-auto w-[calc(100%-2rem)] ${xl ? 'max-w-6xl' : wide ? 'max-w-3xl' : 'max-w-lg'} rounded-[var(--radius-card)] bg-surface p-0 text-ink shadow-[0_8px_32px_hsl(350_30%_15%/0.25)] backdrop:bg-black/35 open:[animation:rise_200ms_var(--ease-out)]`}>
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="-m-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-sunken" aria-label="ปิด"><X className="size-5" aria-hidden="true" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
