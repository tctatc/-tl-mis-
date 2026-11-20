import { LEVEL_LABEL, formatGpa, tpn, type GradesView, type StudentSnapshot } from '@csis/shared';
import type { ReactNode } from 'react';
import { COLLEGE } from './GeneralSheet';

export const COLLEGE_ADDRESS = '290  ต. บ้านครัว อ. บ้านหมอ จ. สระบุรี 18270';

type Term = GradesView['terms'][number];
export interface GradeReportInfo { student: StudentSnapshot; status: string }

/** "4" → "4.0", "3.5" → "3.5", "ผ" → "ผ." แบบรายงานผลการศึกษาของวิทยาลัย */
export function reportGrade(g: string) {
  if (/^\d+(\.\d+)?$/.test(g)) return Number(g).toFixed(1);
  return g.endsWith('.') ? g : `${g}.`;
}

/**
 * ตัดหน้ารายงาน: ทุกหน้ามีหัวเอกสารเต็ม เหลือพื้นที่รายวิชา ~170mm
 * ภาคเรียนหนึ่ง = หัวภาค + รายวิชา + สรุป 2 บรรทัด — ไม่แยกสรุปไปไว้คนละหน้ากับรายวิชาสุดท้าย
 */
const BODY_MM = 168;
const ROW_MM = 7.6;
const TERM_HEAD_MM = 10;
const SUMMARY_MM = 17;
type Piece = { term: Term; rows: Term['rows']; head: boolean; summary: boolean };

export function paginateReport(terms: Term[]): Piece[][] {
  const pages: Piece[][] = [[]];
  let left = BODY_MM;
  for (const term of terms) {
    let rows = [...term.rows];
    let head = true;
    for (;;) {
      const fixed = head ? TERM_HEAD_MM : 0;
      const fitAll = fixed + rows.length * ROW_MM + SUMMARY_MM <= left;
      if (fitAll) {
        pages.at(-1)!.push({ term, rows, head, summary: true });
        left -= fixed + rows.length * ROW_MM + SUMMARY_MM;
        break;
      }
      // ใส่ได้บางแถว (ต้องเหลือแถวไว้คู่กับสรุปในหน้าถัดไปอย่างน้อย 1 แถว)
      const n = Math.min(rows.length - 1, Math.floor((left - fixed) / ROW_MM));
      if (n > 0) pages.at(-1)!.push({ term, rows: rows.slice(0, n), head, summary: false });
      if (n > 0) { rows = rows.slice(n); head = false; }
      pages.push([]);
      left = BODY_MM;
    }
  }
  return pages.filter((p) => p.length);
}

export function GradeReportSheet({ info, pieces, page, pages }: { info: GradeReportInfo; pieces: Piece[]; page: number; pages: number }) {
  const s = info.student;
  const kind = /ทวิภาคี/.test(s.program) ? 'ทวิภาคี' : 'ปกติ';
  const fields: [string, ReactNode, string, ReactNode][] = [
    ['รหัสนักศึกษา', <strong key="c" className="tabular-nums">{s.studentCode}</strong>, 'ชื่อ - สกุล', <strong key="n">{s.prefix}{s.firstName}&nbsp;&nbsp;{s.lastName}</strong>],
    ['รหัสกลุ่มเรียน', '–', 'กลุ่มเรียน', s.groupNo || '–'],
    ['ชั้นปี', `${LEVEL_LABEL[s.level]}${s.yearLevel}`, 'ประเภทวิชา', s.department.replace(/^ประเภทวิชา/, '') || '–'],
    ['ประเภทนักเรียน', kind, 'กลุ่มอาชีพ', '–'],
    ['สถานะนักเรียน', info.status, 'สาขาวิชา', s.program.replace(/\s*\(ทวิภาคี\)$/, '')],
  ];

  return (
    <article className="sheet flex flex-col text-[14pt] leading-[1.35]" aria-label={`รายงานผลการศึกษา หน้า ${page}`} style={{ padding: '10mm 9mm 10mm 9mm' }}>
      <header className="relative text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/college-logo.png" alt="" className="absolute left-0 top-0" style={{ width: '22mm', height: '22mm' }} />
        <p className="text-[18pt] font-bold">{COLLEGE}</p>
        <p className="mt-[1mm]">{COLLEGE_ADDRESS}</p>
        <p className="mt-[2mm] text-[16pt] font-bold">รายงานผลการศึกษา</p>
      </header>

      <div className="mt-[4mm] grid gap-y-[1.2mm]" style={{ gridTemplateColumns: '46mm 40mm 24mm 5mm 1fr' }}>
        {fields.map(([l1, v1, l2, v2]) => (
          <div key={l1} className="contents">
            <span className="text-right whitespace-nowrap">{l1} :</span><span className="pl-[1mm] whitespace-nowrap">{v1}</span>
            <span className="whitespace-nowrap">{l2}</span><span>:</span><span className="whitespace-nowrap">{v2}</span>
          </div>
        ))}
      </div>

      <div className="mt-[2mm] grid border-y-[1.4px] border-black py-[2.5mm] font-bold" style={{ gridTemplateColumns: COLS }}>
        <span className="text-center">รหัสวิชา</span><span className="pl-[33mm]">ชื่อวิชา</span><span>หน่วยกิต</span><span className="text-center">เกรด</span>
      </div>

      <div className="flex-1 pt-[1mm]">
        {pieces.map((p) => (
          <section key={`${p.term.term.id}-${p.rows[0]?.subject.code ?? 'x'}`}>
            {p.head && <p className="pl-[27mm] pt-[2mm] pb-[0.5mm] font-bold">ภาคเรียนที่&nbsp;&nbsp;{p.term.term.label}</p>}
            {p.rows.map((r) => (
              <div key={r.subject.code} className="grid items-baseline" style={{ gridTemplateColumns: COLS, height: `${ROW_MM}mm` }}>
                <span className="pl-[1mm] tabular-nums whitespace-nowrap">{r.subject.code}</span>
                <span className="truncate pr-[3mm]">{r.subject.name}</span>
                <span className="tabular-nums">{tpn(r.subject)}</span>
                <span className="text-center tabular-nums">{reportGrade(r.grade)}</span>
              </div>
            ))}
            {p.summary && (
              <div className="grid gap-y-[1.5mm] pt-[1mm] text-right tabular-nums" style={{ gridTemplateColumns: '79mm 87mm' }}>
                <span>หน่วยกิตประจำภาค : {p.term.credits}</span>
                <span>เกรดเฉลี่ยประจำภาค : {formatGpa(p.term.gpa)}</span>
                <span>หน่วยกิตสะสม : {p.term.creditsEarned}</span>
                <span>เกรดเฉลี่ยสะสม : {formatGpa(p.term.gpax)}</span>
              </div>
            )}
          </section>
        ))}
      </div>

      {pages > 1 && <p className="text-right text-[11pt]">หน้า {page}/{pages}</p>}
    </article>
  );
}

/** รหัสวิชา | ชื่อวิชา | หน่วยกิต | เกรด */
const COLS = '28mm 1fr 25mm 17mm';
