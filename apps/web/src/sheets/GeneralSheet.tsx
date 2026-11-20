'use client';

import {
  FINAL_DECISION_LABEL, DECISION_LABEL, GENERAL_WANT_LABEL, LEVEL_LABEL, THAI_MONTHS, THAI_MONTHS_SHORT, WORKFLOWS,
  bangkokDateParts, parseIsoDate, toBuddhistYear,
  type ApprovalRecord, type GeneralFormData, type PositionKey, type StudentSnapshot,
} from '@csis/shared';
import { Box, Fill, Pick, Row, SignFill } from './parts';

export const COLLEGE = 'วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์';

export interface GeneralSheetProps {
  student: StudentSnapshot;
  studentSignature?: string | null;
  data: GeneralFormData;
  /** ยังไม่ยื่น = ใช้วันที่วันนี้ */
  submittedAt?: string;
  requestNo?: string;
  /** ผลพิจารณารอบล่าสุด (ว่าง = ยังไม่มีใครพิจารณา) */
  approvals?: ApprovalRecord[];
  officials?: Partial<Record<PositionKey, string>>;
}

const stripDept = (name: string) => name.replace(/^แผนกวิชา/, '');

function birthText(iso: string | null) {
  const p = parseIsoDate(iso);
  return p ? `${p.day} ${THAI_MONTHS_SHORT[p.month - 1]} ${toBuddhistYear(p.year)}` : '';
}

/** ความเห็น 1 ช่อง → 2 บรรทัด (ผลพิจารณา + เหตุผล) */
function opinionLines(a: ApprovalRecord | undefined, final = false): [string, string] {
  if (!a) return ['', ''];
  const label = (final ? FINAL_DECISION_LABEL : DECISION_LABEL)[a.decision];
  const comment = a.comment.trim();
  return comment && comment !== label ? [label, comment] : [label, ''];
}

function dateSegments(iso: string | undefined) {
  if (!iso) return ['', '', ''] as const;
  const p = bangkokDateParts(iso);
  return [String(p.day), THAI_MONTHS[p.month - 1] ?? '', String(toBuddhistYear(p.year))] as const;
}

/**
 * แบบคำร้องทั่วไป — วางทุกบรรทัดตามตำแหน่งที่วัดจากสแกนต้นฉบับ (docs/forms/p15.jpg, 10 px = 1 mm)
 * ข้อความที่ระบบ/นักศึกษากรอก เป็นหมึกน้ำเงินบนจอ และเป็นสีดำเมื่อพิมพ์
 */
export function GeneralSheet({ student, data, submittedAt, requestNo, approvals = [], officials = {}, studentSignature }: GeneralSheetProps) {
  const date = bangkokDateParts(submittedAt ?? new Date());
  const birth = birthText(student.birthDate);
  const knownPrefix = student.prefix === 'นาย' || student.prefix === 'นางสาว';
  const steps = WORKFLOWS.general;
  const byStep = (key: string) => approvals.find((a) => a.stepKey === key);
  const registrar = byStep(steps[0]!.key);
  const deputy = byStep(steps[1]!.key);
  const director = byStep(steps[2]!.key);
  const [r1, r2] = opinionLines(registrar);
  const [d1, d2] = opinionLines(deputy);
  const [x1, x2] = opinionLines(director, true);
  const rDate = dateSegments(registrar?.decidedAt);
  const dDate = dateSegments(deputy?.decidedAt);
  const copies = data.copies > 1 ? `  (จำนวน ${data.copies} ฉบับ)` : '';

  return (
    <article className="sheet" aria-label="แบบคำร้องทั่วไป">
      {requestNo && (
        <p className="absolute text-[9.5pt] text-black/70" style={{ right: '12mm', top: '7mm' }}>
          เลขที่คำร้อง {requestNo} · ยื่นออนไลน์
        </p>
      )}

      <h1 className="absolute inset-x-0 text-center text-[14pt] font-bold" style={{ top: '10.5mm' }}>แบบคำร้องทั่วไป</h1>

      <Row y={24} x={108} right={25}>
        <span>เขียนที่</span><Fill grow left>{COLLEGE}</Fill>
      </Row>
      <Row y={30.5} x={80} right={25}>
        <span>วันที่</span><Fill w={14}>{String(date.day)}</Fill>
        <span>เดือน</span><Fill w={42}>{THAI_MONTHS[date.month - 1]}</Fill>
        <span>พ.ศ.</span><Fill grow>{String(toBuddhistYear(date.year))}</Fill>
      </Row>

      <Row y={41} x={16.5} right={null}>
        <span>เรียน&nbsp;&nbsp;&nbsp; ผู้อำนวยการ{COLLEGE}</span>
      </Row>

      <Row y={55} x={27.5} right={22}>
        <span>ด้วยข้าพเจ้า&nbsp;&nbsp; (<Pick on={student.prefix === 'นาย'}>นาย</Pick> / <Pick on={student.prefix === 'นางสาว'}>นางสาว</Pick>)</span>
        <Fill w={62} left>{knownPrefix ? student.firstName : `${student.prefix}${student.firstName}`}</Fill>
        <span>นามสกุล</span><Fill grow left>{student.lastName}</Fill>
      </Row>
      <Row y={62.8} x={16.5} right={22}>
        <span>วัน/เดือน/ปีเกิด</span><Fill w={28}>{birth}</Fill>
        <span>รหัสประจำตัวนักศึกษา</span><Fill w={30}>{student.studentCode}</Fill>
        <span>นักศึกษาหลักสูตร</span><Fill grow>{LEVEL_LABEL[student.level]}</Fill>
      </Row>
      <Row y={70.6} x={16.5} right={22}>
        <span>แผนกวิชา</span><Fill w={36}>{stripDept(student.department)}</Fill>
        <span>สาขาวิชา</span><Fill w={44}>{student.program}</Fill>
        <span>ชั้นปีที่</span><Fill w={12}>{String(student.yearLevel)}</Fill>
        <span>กลุ่มที่</span><Fill grow>{student.groupNo}</Fill>
      </Row>
      <Row y={78.4} x={16.5} right={22}>
        <span>ชื่อ-สกุล บิดา</span><Fill w={56} left>{student.fatherName}</Fill>
        <span>ชื่อ-สกุล มารดา</span><Fill grow left>{student.motherName}</Fill>
      </Row>

      <Row y={87} x={27.5} right={null}><span>มีความประสงค์จะขอ</span></Row>
      <Row y={95} x={40.5} right={null} style={{ gap: '1.5mm' }}>
        <Box checked={data.wants.includes('student_cert')} /><span>{GENERAL_WANT_LABEL.student_cert}{data.wants.includes('student_cert') ? copies : ''}</span>
      </Row>
      <Row y={103} x={40.5} right={null} style={{ gap: '1.5mm' }}>
        <Box checked={data.wants.includes('transcript')} /><span>{GENERAL_WANT_LABEL.transcript}{data.wants.includes('transcript') ? copies : ''}</span>
      </Row>
      <Row y={111} x={40.5} right={22} style={{ gap: '1.5mm' }}>
        <Box checked={data.wants.includes('other')} /><span>อื่น ๆ</span>
        <Fill grow left>{data.wants.includes('other') ? `${data.other}${copies}` : ''}</Fill>
      </Row>
      <Row y={118.5} x={16.5} right={22}>
        <span>สาเหตุที่ขอเพื่อ</span><Fill grow left>{data.purpose}</Fill>
      </Row>

      <Row y={127} x={38} right={null}><span>จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการ</span></Row>
      <p className="absolute text-center" style={{ left: '70mm', width: '60mm', top: '132mm' }}>ขอแสดงความนับถือ</p>

      <Row y={152} x={66.5} right={null}>
        <span>ลงชื่อ</span><SignFill w={58} src={studentSignature} /><span>นักศึกษา</span>
      </Row>
      <Row y={159.3} x={66.5} right={null}>
        <span>(</span><Fill w={62}>{`${student.prefix}${student.firstName} ${student.lastName}`}</Fill><span>)</span>
      </Row>

      {/* ความเห็นงานทะเบียน (ซ้าย) */}
      <p className="absolute" style={{ left: '16.5mm', top: '166mm' }}>ความเห็นงานทะเบียน</p>
      <Row y={177} x={16.5} right={133}><Fill grow left>{r1}</Fill></Row>
      <Row y={184.8} x={16.5} right={133}><Fill grow left>{r2}</Fill></Row>
      <p className="absolute text-center" style={{ left: '16.5mm', width: '60mm', top: '187mm' }}>({officials.registrar_head || registrar?.actorName || ' '.repeat(30)})</p>
      <p className="absolute text-center" style={{ left: '16.5mm', width: '60mm', top: '194.6mm' }}>หัวหน้างานทะเบียน</p>
      <Row y={207} x={16.5} right={null} style={{ gap: 0 }}>
        <Fill w={14}>{rDate[0]}</Fill><span>/</span><Fill w={36}>{rDate[1]}</Fill><span>/</span><Fill w={14}>{rDate[2]}</Fill>
      </Row>

      {/* ความเห็นรองผู้อำนวยการฝ่ายบริหารทรัพยากร (ขวา) */}
      <p className="absolute" style={{ left: '106.5mm', top: '163.3mm' }}>ความเห็นของรองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
      <Row y={175.5} x={116.5} right={30}><Fill grow left>{d1}</Fill></Row>
      <Row y={182.6} x={116.5} right={30}><Fill grow left>{d2}</Fill></Row>
      <p className="absolute text-center" style={{ left: '116.5mm', width: '63.5mm', top: '185mm' }}>({officials.deputy_resources || deputy?.actorName || ' '.repeat(30)})</p>
      <p className="absolute text-center" style={{ left: '112mm', width: '72mm', top: '192.4mm' }}>รองผู้อำนวยการฝ่ายบริหารทรัพยากร</p>
      <Row y={205.6} x={114} right={null} style={{ gap: 0 }}>
        <Fill w={14}>{dDate[0]}</Fill><span>/</span><Fill w={36}>{dDate[1]}</Fill><span>/</span><Fill w={14}>{dDate[2]}</Fill>
      </Row>

      {/* คำสั่งผู้อำนวยการ */}
      <p className="absolute text-center" style={{ left: '70mm', width: '60mm', top: '213.5mm' }}>คำสั่ง</p>
      <Row y={226} x={70.5} right={79}><Fill grow>{x1}</Fill></Row>
      <Row y={234.3} x={70.5} right={79}><Fill grow>{x2}</Fill></Row>
      <p className="absolute text-center" style={{ left: '55mm', width: '100mm', top: '245mm' }}>({officials.director || director?.actorName || ' '.repeat(30)})</p>
      <p className="absolute text-center" style={{ left: '40mm', width: '130mm', top: '252.8mm' }}>ผู้อำนวยการ{COLLEGE}</p>

      <p className="absolute text-[10pt]" style={{ left: '15.5mm', right: '12mm', top: '267mm' }}>
        หมายเหตุ...... กรณีขอใบรับรองการเป็นนักเรียน ระเบียนแสดงผลการเรียน บัตรประจำตัวนักศึกษา ให้ยื่นพร้อมรูปถ่าย 1 นิ้ว ตามจำนวนที่ขอคำร้อง
      </p>
    </article>
  );
}
