'use client';

import {
  DECISION_LABEL, FINAL_DECISION_LABEL, THAI_MONTHS, bangkokDateParts, toBuddhistYear,
  type ApprovalRecord, type PositionKey, type StudentSnapshot,
} from '@csis/shared';
import type { CSSProperties, ReactNode } from 'react';
import { Box, Fill, Pick, Row } from './parts';

export const COLLEGE = 'วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์';
export const LINE = 7.6; // ระยะบรรทัดมาตรฐานของแบบฟอร์ม (mm)

export interface SheetProps {
  student: StudentSnapshot;
  data: Record<string, unknown>;
  submittedAt?: string;
  requestNo?: string;
  /** ผลพิจารณารอบล่าสุด */
  approvals?: ApprovalRecord[];
  officials?: Partial<Record<PositionKey, string>>;
}

export const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
export const nameOnly = (s: StudentSnapshot) => `${s.firstName} ${s.lastName}`.trim();
export const fullNameOf = (s: StudentSnapshot) => `${s.prefix}${s.firstName} ${s.lastName}`.trim();
export const step = (approvals: ApprovalRecord[] | undefined, key: string) => approvals?.find((a) => a.stepKey === key);
const nbsp = (n: number) => ' '.repeat(n);

export function dateTriple(iso?: string) {
  const p = bangkokDateParts(iso ?? new Date());
  return { day: String(p.day), month: THAI_MONTHS[p.month - 1] ?? '', year: String(toBuddhistYear(p.year)) };
}
export const slashDate = (iso?: string) => {
  if (!iso) return ['', '', ''] as const;
  const p = bangkokDateParts(iso);
  return [String(p.day), String(p.month), String(toBuddhistYear(p.year))] as const;
};

export function Text({ x, y, children, bold, size, center, w, style, wrap }: { x: number; y: number; children: ReactNode; bold?: boolean; size?: number; center?: boolean; w?: number; style?: CSSProperties; wrap?: boolean }) {
  return (
    <p className={`absolute ${wrap ? 'leading-[1.25]' : 'whitespace-nowrap'} ${bold ? 'font-bold' : ''} ${center ? 'text-center' : ''}`}
      style={{ left: `${x}mm`, top: `${y - 5.2}mm`, ...(w ? { width: `${w}mm` } : {}), ...(size ? { fontSize: `${size}pt` } : {}), ...style }}>{children}</p>
  );
}

/** "( ) ข้อความ" แบบวงเล็บของฟอร์ม — ติ๊กแล้วใส่เครื่องหมายถูกในวงเล็บ */
export function Paren({ on, children }: { on: boolean; children: ReactNode }) {
  return <span>(<span className="inline-block w-[3.2mm] text-center text-[#0b2a8a] print:text-black">{on ? '✓' : nbsp(1)}</span>) {children}</span>;
}
export { Box, Fill, Pick, Row };

/** หัวกระดาษมาตรฐาน: เขียนที่ + วันที่ (ตำแหน่ง x ของคำว่า "เขียนที่"/"วันที่") */
export function WrittenAt({ x, y, dateX, dateY, submittedAt, right = 22 }: { x: number; y: number; dateX: number; dateY: number; submittedAt?: string; right?: number }) {
  const d = dateTriple(submittedAt);
  return (
    <>
      <Text x={x} y={y}>เขียนที่&nbsp; {COLLEGE}</Text>
      <Row y={dateY} x={dateX} right={right}>
        <span>วันที่</span><Fill w={10}>{d.day}</Fill><span>เดือน</span><Fill w={27}>{d.month}</Fill><span>พ.ศ.</span><Fill grow>{d.year}</Fill>
      </Row>
    </>
  );
}

/**
 * ช่องความเห็น 1 ช่อง: หัวข้อ, บรรทัดความเห็น, ลงชื่อ, (ชื่อ), วันที่
 * ผู้พิจารณาออนไลน์แล้ว → ช่องลงชื่อแสดง "ลงนามออนไลน์" + ชื่อ, ความเห็นพิมพ์ในบรรทัด
 */
export function Opinion({ x, y, w, title, a, holder, lines = 1, sign = true, paren = true, date = true, final = false, signLabel = 'ลงชื่อ', extra, gap = LINE, titleLines = 1 }: {
  x: number; y: number; w: number; title?: ReactNode; a?: ApprovalRecord; holder?: string; lines?: number;
  sign?: boolean; paren?: boolean; date?: boolean; final?: boolean; signLabel?: string; extra?: ReactNode; gap?: number; titleLines?: number;
}) {
  const LINE = gap;
  const label = a ? (final ? FINAL_DECISION_LABEL : DECISION_LABEL)[a.decision] : '';
  const comment = a?.comment && a.comment !== label ? a.comment : '';
  const texts = !a ? [] : lines <= 1 ? [comment || label] : [label, comment];
  const right = 210 - x - w;
  let cy = y;
  const out: ReactNode[] = [];
  if (title) { out.push(<Text key="t" x={x} y={cy} bold>{title}</Text>); cy += LINE * titleLines; }
  if (extra) { out.push(<div key="x">{extra}</div>); }
  for (let i = 0; i < lines; i++) {
    out.push(<Row key={`l${i}`} y={cy} x={x} right={right}><Fill grow left>{texts[i] ?? ''}</Fill></Row>);
    cy += LINE;
  }
  if (sign) {
    out.push(
      <Row key="s" y={cy} x={x} right={right}>
        <span>{signLabel}</span>
        <Fill grow>{a ? `ลงนามออนไลน์ ${a.actorName}` : ''}</Fill>
      </Row>,
    );
    cy += LINE;
  }
  if (paren) {
    out.push(
      <Row key="p" y={cy} x={x + 8} right={right + 4}>
        <span>(</span><Fill grow>{holder || a?.actorName || ''}</Fill><span>)</span>
      </Row>,
    );
    cy += LINE;
  }
  if (date) {
    const [d, m, yy] = slashDate(a?.decidedAt);
    out.push(
      <Row key="d" y={cy} x={x + 14} right={null} style={{ gap: 0 }}>
        <Fill w={10}>{d}</Fill><span>/</span><Fill w={12}>{m}</Fill><span>/</span><Fill w={14}>{yy}</Fill>
      </Row>,
    );
  }
  return <>{out}</>;
}

/** คำสั่งผู้อำนวยการ: ( ) อนุมัติ ( ) ไม่อนุมัติ + ลงชื่อ + ชื่อ + ตำแหน่ง + วันที่ */
export function DirectorOrder({ y, a, holder, title = 'คำสั่ง  ผู้อำนวยการ', cx = 105, options = true, position = true, date = true, signGap = LINE * 1.8 }: {
  y: number; a?: ApprovalRecord; holder?: string; title?: string; cx?: number; options?: boolean; position?: boolean; date?: boolean; signGap?: number;
}) {
  const left = cx - 50;
  let cy = y;
  const out: ReactNode[] = [<Text key="t" x={left} w={100} y={cy} center bold>{title}</Text>];
  cy += LINE;
  if (options) {
    out.push(<Text key="o" x={left} w={100} y={cy} center><Paren on={a?.decision === 'approve'}>อนุมัติ</Paren>&nbsp;&nbsp;&nbsp;&nbsp;<Paren on={a?.decision === 'reject'}>ไม่อนุมัติ</Paren></Text>);
    cy += LINE;
  }
  if (a?.comment && a.comment !== 'อนุมัติ') { out.push(<Text key="c" x={left} w={100} y={cy} center><span className="text-[#0b2a8a] print:text-black">{a.comment}</span></Text>); }
  cy += signGap - LINE;
  out.push(<Row key="s" y={cy} x={left + 12} right={210 - left - 88}><span>ลงชื่อ</span><Fill grow>{a ? `ลงนามออนไลน์ ${a.actorName}` : ''}</Fill></Row>);
  cy += LINE;
  out.push(<Text key="n" x={left} w={100} y={cy} center>({holder || a?.actorName || nbsp(30)})</Text>);
  cy += LINE;
  if (position) { out.push(<Text key="p" x={left - 20} w={140} y={cy} center>ผู้อำนวยการ{COLLEGE}</Text>); cy += LINE; }
  if (date) {
    const [d, m, yy] = slashDate(a?.decidedAt);
    out.push(<Row key="d" y={cy} x={cx - 18} right={null} style={{ gap: 0 }}><Fill w={10}>{d}</Fill><span>/</span><Fill w={10}>{m}</Fill><span>/</span><Fill w={13}>{yy}</Fill></Row>);
  }
  return <>{out}</>;
}

export function RequestNo({ requestNo, right = 12 }: { requestNo?: string; right?: number }) {
  if (!requestNo) return null;
  return <p className="absolute text-[9pt] text-black/60" style={{ right: `${right}mm`, bottom: '5mm' }}>เลขที่คำร้อง {requestNo} · ยื่นออนไลน์</p>;
}

/** ช่องหัวหน้างานการเงิน: ได้รับเงินค่าธรรมเนียม/ใบเสร็จ (ความเห็นที่บันทึกออนไลน์พิมพ์ในบรรทัดแรก) */
export function FinanceReceipt({ x, y, w, title, a, holder, gap = 6.8, sign = true }: { x: number; y: number; w: number; title: string; a?: ApprovalRecord; holder?: string; gap?: number; sign?: boolean }) {
  const right = 210 - x - w;
  const [d, m, yy] = slashDate(a?.decidedAt);
  return (
    <>
      <Text x={x} y={y} bold>{title}</Text>
      <Row y={y + gap} x={x} right={right}><span>ได้รับเงินค่าธรรมเนียม จำนวน</span><Fill grow>{a?.comment ?? ''}</Fill><span>บาท</span></Row>
      <Row y={y + gap * 2} x={x} right={right}><span>ไว้เรียบร้อยแล้ว ตามใบเสร็จเลขที่</span><Fill grow>{''}</Fill></Row>
      <Row y={y + gap * 3} x={x} right={right}><span>วัน/เดือน/ปี</span><Fill grow>{a ? `${d}/${m}/${yy}` : ''}</Fill></Row>
      {sign && <Row y={y + gap * 4} x={x + 12} right={right}><span>ลงชื่อ</span><Fill grow>{a ? `ลงนามออนไลน์ ${a.actorName}` : ''}</Fill></Row>}
      <Text x={x} w={w} y={y + gap * (sign ? 5 : 4)} center>({holder || a?.actorName || ' '.repeat(30)})</Text>
    </>
  );
}
