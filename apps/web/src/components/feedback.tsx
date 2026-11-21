'use client';

import { CheckCircle2, CircleAlert, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button, cx } from './ui';

// ---------------- กล่องยืนยัน ----------------
export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = ลบ/ระงับ/ยกเลิก (ปุ่มสีแดง) */
  tone?: 'default' | 'danger';
}
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);
/** const confirm = useConfirm(); if (!(await confirm({ title: '...' }))) return; */
export const useConfirm = () => useContext(ConfirmCtx);

function ConfirmDialog({ pending, done }: { pending: Pending | null; done: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (pending && !d.open) d.showModal();
    if (!pending && d.open) d.close();
  }, [pending]);
  const danger = pending?.tone === 'danger';
  return (
    <dialog ref={ref} role="alertdialog" aria-labelledby={titleId} aria-describedby={pending?.message ? descId : undefined}
      onCancel={(e) => { e.preventDefault(); done(false); }} onClick={(e) => { if (e.target === ref.current) done(false); }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] bg-surface p-0 text-ink shadow-[0_8px_32px_hsl(350_30%_15%/0.25)] backdrop:bg-black/40 open:[animation:rise_180ms_var(--ease-out)]">
      {pending && (
        <div className="grid gap-4 p-5 sm:p-6">
          <div className="flex gap-3">
            <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', danger ? 'bg-danger-soft text-danger' : 'bg-brand-soft text-brand')}>
              <TriangleAlert className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 pt-1">
              <h2 id={titleId} className="text-[18px] font-semibold">{pending.title}</h2>
              {pending.message && <div id={descId} className="mt-1.5 text-[16px] leading-relaxed text-ink-muted">{pending.message}</div>}
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" className="min-h-12" onClick={() => done(false)}>{pending.cancelLabel ?? 'ยังไม่ทำ'}</Button>
            <Button variant={danger ? 'danger' : 'primary'} className="min-h-12" autoFocus onClick={() => done(true)}>{pending.confirmLabel ?? 'ยืนยัน'}</Button>
          </div>
        </div>
      )}
    </dialog>
  );
}

// ---------------- แจ้งผล (toast) ----------------
type Toast = { id: number; tone: 'ok' | 'danger'; text: string };
const ToastCtx = createContext<{ ok: (t: string) => void; error: (t: string) => void }>({ ok: () => {}, error: () => {} });
/** const toast = useToast(); toast.ok('บันทึกแล้ว') */
export const useToast = () => useContext(ToastCtx);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), []);
  const done = (ok: boolean) => { pending?.resolve(ok); setPending(null); };

  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'ok' ? 4000 : 7000);
  }, []);
  const [api] = useState(() => ({ ok: (t: string) => push('ok', t), error: (t: string) => push('danger', t) }));
  // ข้อความแจ้งผลต้องอยู่เหนือกล่อง <dialog> ที่เปิดอยู่ → ใช้ popover (top layer) แล้วเปิดใหม่ทุกครั้งให้ขึ้นบนสุด
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layer.current;
    if (!el || typeof el.showPopover !== 'function') return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch { /* เบราว์เซอร์เก่า: แสดงแบบ fixed ธรรมดา */ }
  }, [toasts]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={api}>
        {children}
        <ConfirmDialog pending={pending} done={done} />
        <div ref={layer} popover="manual" className="no-print pointer-events-none fixed inset-x-0 top-auto bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 m-0 grid w-full max-w-none justify-items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 lg:bottom-6 lg:justify-items-end lg:px-6 h-auto" aria-live="polite" role="status">
          {toasts.map((t) => (
            <div key={t.id} className={cx('pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-[var(--radius-card)] px-4 py-3 text-[16px] shadow-[0_8px_24px_hsl(350_30%_15%/0.2)] ring-1 [animation:rise_180ms_var(--ease-out)]',
              t.tone === 'ok' ? 'bg-surface text-ink ring-ok/40' : 'bg-danger-soft text-danger ring-danger/30')}>
              {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 flex-1">{t.text}</span>
              <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5" aria-label="ปิดข้อความ"><X className="size-4" aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}
