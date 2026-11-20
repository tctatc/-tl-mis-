'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * ชิ้นส่วนของแบบฟอร์มกระดาษ ทุกหน่วยเป็น mm เพื่อให้พิมพ์ออกมาตรงตำแหน่งต้นฉบับ
 */

/**
 * บรรทัดของแบบฟอร์ม: y = ตำแหน่งเส้นบรรทัดจากขอบบนกระดาษ, x = ระยะจากขอบซ้าย
 * right = ระยะปลายบรรทัดจากขอบขวา (null = ยาวตามข้อความ ไม่มีช่องยืด)
 */
export function Row({ y, x, right = 7, children, style }: { y: number; x: number; right?: number | null; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="sheet-row" style={{ top: `${y - 5.2}mm`, left: `${x}mm`, ...(right === null ? {} : { right: `${right}mm` }), ...style }}>
      {children}
    </div>
  );
}

/**
 * ช่องเส้นประ — ข้อความยาวเกินช่องจะย่อตัวอักษรลงเอง (ไม่ตัดทิ้ง เอกสารราชการต้องเห็นครบ)
 * ไม่มีข้อมูลก็ยังเห็นเส้นประให้เขียนมือได้
 */
export function Fill({ children, w, grow = false, left = false }: { children?: string | undefined; w?: number; grow?: boolean; left?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);
  const text = children ?? '';

  useLayoutEffect(() => {
    const box = ref.current;
    const inner = textRef.current;
    if (!box || !inner) return;
    // วัดจริงจากความกว้างที่ได้ (รวมช่องที่ยืดตามบรรทัด) แทนการเดาจากจำนวนตัวอักษร
    const fit = () => {
      inner.style.fontSize = '';
      const available = box.clientWidth - 6;
      const needed = inner.scrollWidth;
      const next = needed > available && available > 0 ? Math.max(0.55, available / needed) : 1;
      // ตั้ง style ตรงนี้ด้วย: ถ้าค่าเท่าเดิม setScale จะไม่ render ใหม่ แล้วขนาดที่เพิ่งล้างไปจะไม่กลับมา
      inner.style.fontSize = next < 1 ? `${next * 100}%` : '';
      setScale(next);
    };
    fit();
    void document.fonts?.ready.then(fit);
  }, [text, w, grow]);

  return (
    <span ref={ref} className={`sheet-fill${grow ? ' grow' : ''}${left ? ' left' : ''}`} style={w ? { width: `${w}mm` } : undefined}>
      <span ref={textRef} className="inline-block" style={scale < 1 ? { fontSize: `${scale * 100}%` } : undefined}>{text || ' '}</span>
    </span>
  );
}

export function Box({ checked }: { checked: boolean }) {
  return (
    <span className="sheet-box" role="img" aria-label={checked ? 'เลือก' : 'ไม่เลือก'}>
      {checked && (
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 6.6 4.9 9.2 9.8 2.8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </span>
  );
}

/** วงกลมรอบคำนำหน้าที่ตรงกับนักศึกษา เช่น (นาย / นางสาว) */
export function Pick({ on, children }: { on: boolean; children: string }) {
  return on ? <span className="sheet-circle">{children}</span> : <span>{children}</span>;
}

/**
 * ย่อแผ่น A4 ให้พอดีความกว้างกรอบ (มือถือ/คอลัมน์แคบ) โดยไม่เปลี่ยนขนาดจริง ตอนพิมพ์ CSS ล้างการย่อทิ้ง
 * maxHeight = ความสูงของกรอบที่อยู่นิ่ง (ไม่ขึ้นกับการเลื่อน) → ย่อให้เห็นทั้งแผ่นแล้วจัดกึ่งกลาง
 */
export function ScaledSheet({ children, className, maxHeight }: { children: ReactNode; className?: string; maxHeight?: number }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      if (!inner.offsetWidth || !outer.clientWidth) return;
      const next = Math.min(1, outer.clientWidth / inner.offsetWidth, maxHeight ? maxHeight / inner.offsetHeight : Infinity);
      setScale(next);
      setHeight(inner.offsetHeight * next);
      setOffset(Math.max(0, (outer.clientWidth - inner.offsetWidth * next) / 2));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [maxHeight]);

  return (
    // contain:inline-size = ความกว้างของกรอบไม่ขึ้นกับแผ่น A4 ข้างใน (กว้าง 794px) ไม่ว่าจะวางใน grid/flex แบบไหน
    // ไม่งั้นกรอบถูกแผ่นดันให้กว้างเท่า A4 แล้วคำนวณได้ว่าไม่ต้องย่อ จอมือถือเห็นแค่ครึ่งแผ่น
    <div ref={outerRef} className={`w-full min-w-0 overflow-hidden [contain:inline-size] print:overflow-visible print:[contain:none] ${className ?? ''}`} style={{ height }}>
      <div ref={innerRef} className="print-scale w-max origin-top-left" style={{ transform: scale < 1 || offset ? `translateX(${offset}px) scale(${scale})` : undefined }}>
        {children}
      </div>
    </div>
  );
}

/**
 * ช่องลงชื่อของนักศึกษา: ลงชื่อออนไลน์ → เขียนชื่อ-สกุลด้วยลายมือ (หมึกน้ำเงิน) บนเส้นประ
 * ไม่ได้เลือก → เส้นประว่างให้เซ็นด้วยปากกา
 */
export function SignFill({ w, name }: { w: number; name?: string | undefined }) {
  return (
    <span className="sheet-fill sheet-sign" style={{ width: `${w}mm` }} aria-label={name ? `ลงชื่อออนไลน์ ${name}` : undefined}>
      {name || '\u00a0'}
    </span>
  );
}
