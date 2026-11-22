'use client';

import QRCode from 'qrcode';
import { Copy, QrCode, Smartphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Dialog } from './Dialog';
import { useToast } from './feedback';
import { cx } from './ui';

/**
 * QR Code — สร้างในเบราว์เซอร์ (ไลบรารี qrcode) ไม่ส่งลิงก์ไปบริการภายนอก
 * สีเข้มบนพื้นขาว + ขอบเงียบ เพื่อให้กล้องมือถือรุ่นเก่าสแกนติดง่าย
 */
export function QrImage({ value, size = 220, className, label }: { value: string; size?: number; className?: string; label: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size * 2, color: { dark: '#2a0b10', light: '#ffffff' } })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [value, size]);
  return src
    // eslint-disable-next-line @next/next/no-img-element -- data URL ที่สร้างเอง ไม่ต้องผ่าน next/image
    ? <img src={src} alt={label} width={size} height={size} className={cx('block bg-white', className)} />
    : <span role="img" aria-label={label} className={cx('block animate-pulse rounded-md bg-sunken', className)} style={{ width: size, height: size }} />;
}

/** ลิงก์เต็มของหน้า (ใช้โดเมนที่เปิดอยู่จริง เปลี่ยนโดเมนแล้ว QR ตามเอง) */
export function useAbsoluteUrl(path: string) {
  const [url, setUrl] = useState(path);
  useEffect(() => { setUrl(new URL(path, window.location.origin).toString()); }, [path]);
  return url;
}

export const formPath = (code: string) => `/student/new/${code}`;

/** ปุ่ม QR ของแบบฟอร์มคำร้อง: เปิดกล่องให้สแกนแล้วไปกรอกต่อบนมือถือ */
export function FormQrButton({ code, name, variant = 'icon' }: { code: string; name: string; variant?: 'icon' | 'text' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        aria-label={`QR Code แบบฟอร์ม ${name} สำหรับเปิดบนมือถือ`}
        className={variant === 'icon'
          ? 'grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] text-ink-muted hover:bg-sunken hover:text-brand'
          : 'inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft'}>
        <QrCode className="size-5" aria-hidden="true" />{variant === 'text' && 'สแกนทำบนมือถือ'}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="สแกนเพื่อกรอกบนมือถือ">
        {open && <FormQrBody code={code} name={name} />}
      </Dialog>
    </>
  );
}

function FormQrBody({ code, name }: { code: string; name: string }) {
  const url = useAbsoluteUrl(formPath(code));
  const toast = useToast();
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <div className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line"><QrImage value={url} size={232} label={`QR Code ของ ${name}`} /></div>
      <div>
        <p className="text-[17px] font-semibold">{name}</p>
        <p className="text-sm text-ink-muted tabular-nums">แบบฟอร์ม {code}</p>
      </div>
      <ol className="grid w-full gap-1.5 rounded-[var(--radius-control)] bg-sunken p-3 text-left text-[15px]">
        <li className="flex gap-2"><Smartphone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />เปิดกล้องมือถือ แล้วส่องที่ QR Code</li>
        <li className="pl-6">แตะลิงก์ที่ขึ้นมา ถ้ายังไม่ได้เข้าสู่ระบบ ให้เข้าสู่ระบบก่อน ระบบจะพากลับมาที่แบบฟอร์มนี้เอง</li>
      </ol>
      <button type="button" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.ok('คัดลอกลิงก์แล้ว'), () => toast.error('คัดลอกไม่ได้ ลองกดค้างที่ลิงก์แทน'))}
        className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm text-ink-muted hover:bg-sunken hover:text-ink">
        <Copy className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{url}</span>
      </button>
    </div>
  );
}
