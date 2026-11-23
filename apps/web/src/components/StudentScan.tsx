'use client';

import { LEVEL_LABEL, STUDENT_STATUS_LABEL, fullName, studentScanPath, type StudentScanView } from '@csis/shared';
import { CameraOff, IdCard, Lock, Phone, ScanLine, ShieldCheck, Smartphone, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';
import { QrImage, useAbsoluteUrl } from './Qr';
import { Button, Card, cx } from './ui';

// ---------------- กล้องสแกน ----------------
type CamState = 'idle' | 'starting' | 'scanning' | 'denied' | 'nocam' | 'error';

interface Detector { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type JsQr = (data: Uint8ClampedArray, w: number, h: number, o?: { inversionAttempts: 'dontInvert' }) => { data: string } | null;

/**
 * เปิดกล้องหลังแล้วอ่าน QR — ใช้ BarcodeDetector ของเบราว์เซอร์ถ้ามี (Chrome/Android)
 * ไม่มี (iPhone/Safari) ใช้ jsQR ที่โหลดเมื่อจำเป็นเท่านั้น · ภาพไม่ถูกส่งออกจากเครื่อง
 */
export function QrScanner({ onText, active }: { onText: (text: string) => void; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<CamState>('idle');
  const cb = useRef(onText);
  cb.current = onText;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) { setState('nocam'); return; }
    setState('starting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      stream.current = s;
      const v = video.current!;
      v.srcObject = s;
      await v.play();
      setState('scanning');

      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      if (BD && (await BD.getSupportedFormats?.().catch((): string[] => []))?.includes('qr_code')) detector = new BD({ formats: ['qr_code'] });
      const jsQR: JsQr | null = detector ? null : ((await import('jsqr')).default as unknown as JsQr);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      const tick = async () => {
        if (!stream.current) return;
        let text = '';
        try {
          if (v.readyState >= 2) {
            if (detector) text = (await detector.detect(v))[0]?.rawValue ?? '';
            else if (jsQR && ctx) {
              const scale = Math.min(1, 640 / (v.videoWidth || 640));
              canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              text = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })?.data ?? '';
            }
          }
        } catch { /* เฟรมเสีย ข้ามไป */ }
        if (text) { navigator.vibrate?.(60); stop(); setState('idle'); cb.current(text); return; }
        timer.current = setTimeout(() => void tick(), 120);
      };
      void tick();
    } catch (e) {
      stop();
      const name = (e as { name?: string }).name;
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'nocam' : 'error');
    }
  }, [stop]);

  // active = เปิดกล้องอัตโนมัติ (หลังกด "สแกนคนต่อไป")
  useEffect(() => { if (active && state === 'idle' && !stream.current) void start(); }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => stop, [stop]);
  // ออกจากแท็บ/ล็อกจอ → ปิดกล้อง ประหยัดแบต
  useEffect(() => {
    const h = () => { if (document.hidden && stream.current) { stop(); setState('idle'); } };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [stop]);

  const on = state === 'scanning' || state === 'starting';
  return (
    <div className="grid gap-3">
      <div className={cx('relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[var(--radius-card)] bg-[#1b0a0d]', !on && 'hidden')}>
        <video ref={video} muted playsInline className="size-full object-cover" aria-label="ภาพจากกล้อง" />
        <div className="pointer-events-none absolute inset-[14%] rounded-2xl ring-4 ring-white/85 [box-shadow:0_0_0_100vmax_rgb(0_0_0/0.35)]" aria-hidden="true" />
        <p className="absolute inset-x-0 bottom-3 text-center text-[15px] font-medium text-white drop-shadow">{state === 'starting' ? 'กำลังเปิดกล้อง…' : 'ส่อง QR Code ให้อยู่ในกรอบ'}</p>
      </div>
      {on ? (
        <Button variant="secondary" className="mx-auto min-h-12 w-full max-w-sm" onClick={() => { stop(); setState('idle'); }}>ปิดกล้อง</Button>
      ) : (
        <>
          {state === 'denied' && <CamNote title="เว็บยังไม่ได้รับอนุญาตให้ใช้กล้อง">กดรูปแม่กุญแจหรือ “Aa” ที่ช่องที่อยู่เว็บ เลือกอนุญาตกล้อง แล้วกดเปิดกล้องอีกครั้ง หรือพิมพ์รหัสนักศึกษาด้านล่างแทน</CamNote>}
          {state === 'nocam' && <CamNote title="เครื่องนี้ไม่มีกล้องที่ใช้ได้">ใช้มือถือเปิดหน้านี้ หรือพิมพ์รหัสนักศึกษาด้านล่างแทน</CamNote>}
          {state === 'error' && <CamNote title="เปิดกล้องไม่ได้">กล้องอาจถูกแอปอื่นใช้อยู่ ปิดแอปนั้นแล้วลองใหม่ หรือพิมพ์รหัสนักศึกษาด้านล่างแทน</CamNote>}
          <Button className="mx-auto min-h-14 w-full max-w-sm text-[17px]" icon={<ScanLine className="size-5" aria-hidden="true" />} onClick={() => void start()}>เปิดกล้องสแกน QR</Button>
        </>
      )}
    </div>
  );
}

function CamNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="mx-auto flex w-full max-w-sm gap-3 rounded-[var(--radius-control)] bg-warn-soft p-3 text-[15px] text-warn">
      <CameraOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div><p className="font-semibold">{title}</p><p className="mt-0.5">{children}</p></div>
    </div>
  );
}

// ---------------- ผลการสแกน ----------------
export function StudentScanCard({ s, canOpenRecord }: { s: StudentScanView; canOpenRecord: boolean }) {
  const studying = s.status === 'studying';
  return (
    <Card className="overflow-hidden">
      <div className={cx('flex items-center gap-2 px-4 py-2.5 text-[16px] font-semibold', studying ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn')} role="status">
        {studying ? <ShieldCheck className="size-5" aria-hidden="true" /> : <IdCard className="size-5" aria-hidden="true" />}
        {STUDENT_STATUS_LABEL[s.status] ?? s.status}
        {!studying && <span className="font-normal">· ไม่ได้อยู่ระหว่างศึกษา</span>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><UserRound className="size-7" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 className="text-[22px] leading-snug font-semibold">{fullName(s)}{s.nickname && <span className="ml-2 text-[17px] font-normal text-ink-muted">({s.nickname})</span>}</h2>
            <p className="text-[16px] text-ink-muted tabular-nums">รหัส {s.studentCode}</p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-2.5 text-[16px] sm:grid-cols-2">
          <Row k="ระดับชั้น" v={`${LEVEL_LABEL[s.level]} ปี ${s.yearLevel}${s.groupNo ? ` กลุ่ม ${s.groupNo}` : ''}`} />
          <Row k="สาขา" v={s.program} />
          <Row k="แผนก" v={s.department} />
          <Row k="ครูที่ปรึกษา" v={s.isAdvisee ? `${s.advisor} (คุณ)` : s.advisor || '—'} />
        </dl>

        {s.contact ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t border-line/80 pt-4">
            <h3 className="font-semibold">ติดต่อ</h3>
            {!s.contact.phone && s.contact.guardians.every((g) => !g.phone) && <p className="text-ink-muted">ยังไม่มีเบอร์โทรในระบบ</p>}
            {s.contact.phone && <CallRow who="นักเรียน" name={fullName(s)} phone={s.contact.phone} />}
            {s.contact.guardians.filter((g) => g.name || g.phone).map((g, i) => <CallRow key={i} who={g.relation || 'ผู้ปกครอง'} name={g.name} phone={g.phone} />)}
            <p className="text-sm text-ink-muted">{s.isAdvisee ? 'คุณเห็นเบอร์ติดต่อเพราะเป็นครูที่ปรึกษาของนักเรียนคนนี้' : 'คุณเห็นเบอร์ติดต่อเพราะเป็นงานทะเบียน/ผู้ดูแลระบบ'}</p>
          </div>
        ) : (
          <p className="flex gap-2 border-t border-line/80 pt-4 text-[15px] text-ink-muted"><Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />เบอร์โทรนักเรียนและผู้ปกครองดูได้เฉพาะครูที่ปรึกษาและงานทะเบียน</p>
        )}
        {canOpenRecord && (
          <Link href={`/admin/students?q=${encodeURIComponent(s.studentCode)}`} className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] px-4 text-[15px] font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft">เปิดประวัตินักเรียนเต็ม</Link>
        )}
      </div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2"><dt className="text-ink-muted">{k}</dt><dd className="min-w-0 font-medium">{v || '—'}</dd></div>;
}

function CallRow({ who, name, phone }: { who: string; name: string; phone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-3 py-2">
      <div className="min-w-0 flex-1"><p className="text-sm text-ink-muted">{who}</p><p className="truncate font-medium">{name || '—'}</p></div>
      {phone ? (
        <a href={`tel:${phone.replace(/[^0-9+]/g, '')}`} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] bg-brand px-3 text-[15px] font-medium text-ink-inverse tabular-nums hover:bg-brand-hover" aria-label={`โทรหา${who} ${phone}`}>
          <Phone className="size-4" aria-hidden="true" />{phone}
        </a>
      ) : <span className="text-sm text-ink-muted">ไม่มีเบอร์</span>}
    </div>
  );
}

// ---------------- QR ของนักเรียน (ให้ครูสแกน) ----------------
export function StudentQrButton({ code, name, className }: { code: string; name: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={cx('inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft', className)}>
        <IdCard className="size-5" aria-hidden="true" />บัตรนักศึกษา QR
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="บัตรนักศึกษา QR">
        {open && <StudentQrBody code={code} name={name} />}
      </Dialog>
    </>
  );
}

function StudentQrBody({ code, name }: { code: string; name: string }) {
  const url = useAbsoluteUrl(studentScanPath(code));
  return (
    <div className="grid justify-items-center gap-4 text-center">
      <div className="rounded-[var(--radius-card)] bg-white p-3 ring-1 ring-line"><QrImage value={url} size={240} label={`QR Code บัตรนักศึกษาของ ${name}`} /></div>
      <div>
        <p className="text-[18px] font-semibold">{name}</p>
        <p className="text-[16px] text-ink-muted tabular-nums">รหัส {code}</p>
      </div>
      <p className="flex gap-2 rounded-[var(--radius-control)] bg-sunken p-3 text-left text-[15px]">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
        ยื่นหน้าจอนี้ให้ครูหรือเจ้าหน้าที่สแกนเมื่อถูกขอ QR นี้มีแค่รหัสนักศึกษา คนที่ไม่ใช่ครูหรือเจ้าหน้าที่สแกนแล้วไม่เห็นข้อมูลของคุณ
      </p>
    </div>
  );
}
