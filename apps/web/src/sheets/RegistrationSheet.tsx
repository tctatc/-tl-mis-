'use client';

import {
  LEVEL_LABEL, THAI_MONTHS, bangkokDateParts, fullName, toBuddhistYear, tpn,
  type RegistrationCardView, type StudentSnapshot,
} from '@csis/shared';
import { COLLEGE } from './GeneralSheet';

const KIND: Record<string, string> = { repeat: 'เรียนซ้ำ', regrade: 'รีเกรด' };
const MIN_ROWS = 12;

/**
 * บัตรลงทะเบียนเรียน (A4) — ยังไม่มีแบบฟอร์มจริงของวิทยาลัย จึงออกแบบตามรูปแบบเอกสารราชการทั่วไป
 * ถ้ามีสแกนบัตรลงทะเบียนจริง ให้วางตำแหน่งใหม่ตามต้นฉบับแบบเดียวกับแบบคำร้อง
 */
export function RegistrationSheet({ card, student }: { card: RegistrationCardView; student: StudentSnapshot }) {
  const term = card.term!;
  const reg = card.registeredAt ? bangkokDateParts(card.registeredAt) : null;
  const printed = bangkokDateParts(new Date());
  const blanks = Math.max(0, MIN_ROWS - card.subjects.length);
  const cell = 'border border-black px-[1.6mm] py-[1mm]';

  return (
    <article className="sheet" aria-label="บัตรลงทะเบียนเรียน" style={{ padding: '14mm 16mm' }}>
      <header className="flex items-center gap-[4mm]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/college-logo.png" alt="" style={{ width: '20mm', height: '20mm' }} />
        <div className="flex-1 text-center">
          <p className="text-[15pt] font-bold">บัตรลงทะเบียนเรียน</p>
          <p className="text-[13pt]">{COLLEGE}</p>
          <p className="text-[13pt]">ภาคเรียนที่ {term.term === 3 ? 'ฤดูร้อน' : term.term} ปีการศึกษา {term.year}</p>
        </div>
        <div style={{ width: '20mm' }} />
      </header>

      <table className="mt-[6mm] w-full text-[12.5pt]" style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td className="py-[0.8mm]" style={{ width: '50%' }}>ชื่อ-สกุล <strong>{fullName(student)}</strong></td>
            <td>รหัสประจำตัว <strong className="tabular-nums">{student.studentCode}</strong></td>
          </tr>
          <tr>
            <td className="py-[0.8mm]">ระดับ {LEVEL_LABEL[student.level]} ชั้นปีที่ {student.yearLevel} กลุ่ม {student.groupNo}</td>
            <td>สาขาวิชา {student.program}</td>
          </tr>
          <tr>
            <td className="py-[0.8mm]">{student.department}</td>
            <td>ครูที่ปรึกษา {card.advisor || '........................................'}</td>
          </tr>
        </tbody>
      </table>

      <table className="mt-[4mm] w-full text-[12pt]" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="text-center font-bold">
            <th className={cell} style={{ width: '9mm' }}>ที่</th>
            <th className={cell} style={{ width: '26mm' }}>รหัสวิชา</th>
            <th className={cell}>ชื่อวิชา</th>
            <th className={cell} style={{ width: '16mm' }}>ท-ป-น</th>
            <th className={cell} style={{ width: '12mm' }}>กลุ่ม</th>
            <th className={cell} style={{ width: '40mm' }}>ครูผู้สอน</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((s, i) => (
            <tr key={s.subject.code}>
              <td className={`${cell} text-center`}>{i + 1}</td>
              <td className={`${cell} text-center tabular-nums`}>{s.subject.code}</td>
              <td className={cell}>{s.subject.name}{KIND[s.kind] ? ` (${KIND[s.kind]})` : ''}</td>
              <td className={`${cell} text-center tabular-nums`}>{tpn(s.subject)}</td>
              <td className={`${cell} text-center`}>{s.groupCode}</td>
              <td className={cell} style={{ fontSize: '11pt' }}>{s.teacher}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`b${i}`}>{Array.from({ length: 6 }, (__, j) => <td key={j} className={cell}>&nbsp;</td>)}</tr>
          ))}
          <tr className="font-bold">
            <td className={`${cell} text-right`} colSpan={3}>รวม {card.subjects.length} รายวิชา</td>
            <td className={`${cell} text-center tabular-nums`}>{card.totalCredits}</td>
            <td className={cell} colSpan={2}>หน่วยกิต</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[14mm] grid grid-cols-3 gap-[6mm] text-center text-[12pt]">
        {[['นักเรียน/นักศึกษา', fullName(student)], ['ครูที่ปรึกษา', card.advisor], ['เจ้าหน้าที่งานทะเบียน', '']].map(([role, name]) => (
          <div key={role}>
            <p>ลงชื่อ....................................</p>
            <p className="mt-[1.5mm]">({name || '....................................'})</p>
            <p className="mt-[1mm]">{role}</p>
          </div>
        ))}
      </div>

      <p className="absolute text-[9.5pt] text-black/70" style={{ left: '16mm', right: '16mm', bottom: '10mm' }}>
        ลงทะเบียนเมื่อ {reg ? `${reg.day} ${THAI_MONTHS[reg.month - 1]} ${toBuddhistYear(reg.year)}` : '–'} ·
        พิมพ์จากระบบทะเบียนออนไลน์ {printed.day} {THAI_MONTHS[printed.month - 1]} {toBuddhistYear(printed.year)}
      </p>
    </article>
  );
}
