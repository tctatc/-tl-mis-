'use client';

import { Eraser } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui';

const INK = '#0b2a8a'; // หมึกน้ำเงินเหมือนปากกา (สีเดียวกับข้อความที่กรอกในแบบฟอร์ม)

/** ตัดขอบว่างรอบลายเซ็น แล้วย่อให้กว้างไม่เกิน 600px — ไฟล์เล็ก วางในช่องแบบฟอร์มได้พอดี */
function exportTrimmed(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d')!;
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (px[(y * width + x) * 4 + 3]! > 0) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = 8;
  const w = maxX - minX + 1 + pad * 2;
  const h = maxY - minY + 1 + pad * 2;
  const scale = Math.min(1, 600 / w);
  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  out.getContext('2d')!.drawImage(canvas, minX - pad, minY - pad, w, h, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

/** ช่องวาดลายเซ็น: ใช้นิ้ว (มือถือ) หรือเมาส์ */
export function SignaturePad({ onDone, onCancel, busy }: { onDone: (png: string) => void; onCancel?: () => void; busy?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = INK;
      setEmpty(true);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    setEmpty(false);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext('2d')!;
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  return (
    <div className="grid gap-2">
      <div className="relative rounded-[var(--radius-control)] bg-surface ring-1 ring-line-strong">
        <canvas ref={ref} aria-label="ช่องวาดลายเซ็น ใช้นิ้วหรือเมาส์เซ็นชื่อ" role="img"
          className="block h-44 w-full cursor-crosshair touch-none rounded-[var(--radius-control)]"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-line-strong" aria-hidden="true" />
        {empty && <span className="pointer-events-none absolute inset-0 grid place-items-center text-[15px] text-ink-muted">เซ็นชื่อตรงนี้ด้วยนิ้วหรือเมาส์</span>}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={clear} disabled={empty} icon={<Eraser className="size-4" aria-hidden="true" />}>ล้าง</Button>
        {onCancel && <Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button>}
        <Button type="button" loading={busy} disabled={empty} onClick={() => { const png = exportTrimmed(ref.current!); if (png) onDone(png); }}>ใช้ลายเซ็นนี้</Button>
      </div>
    </div>
  );
}
