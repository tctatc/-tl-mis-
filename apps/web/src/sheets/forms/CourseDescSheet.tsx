'use client';

import type { CourseRow } from '@csis/shared';
import { COLLEGE, DirectorOrder, Fill, RequestNo, Row, Text, WrittenAt, fullNameOf, nameOnly, step, str, type SheetProps, SignFill } from '../blocks';

const cell = 'border border-black px-[1.5mm] align-middle';

/** คำร้องขอคำอธิบายรายวิชา (สแกน p06) — มีตราวิทยาลัยหัวกระดาษ */
export function CourseDescSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {}, studentSignature }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const rows = ((d.courses as CourseRow[] | undefined) ?? []).slice(0, 5);
  const cur = a('curriculum');
  const dep = a('deputy');
  return (
    <article className="sheet compact" aria-label="คำร้องขอคำอธิบายรายวิชา">
      <RequestNo requestNo={requestNo} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/college-logo.png" alt="" className="absolute" style={{ left: '93mm', top: '20mm', width: '20mm', height: '20mm' }} />
      <Text x={0} w={210} y={48} center bold size={13.5}>คำร้องขอคำอธิบายรายวิชา</Text>
      <WrittenAt x={119} y={57.5} dateX={119} dateY={65} submittedAt={submittedAt} right={28} />
      <Text x={27.5} y={72}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={79} x={39.5} right={27}><span>ข้าพเจ้า (นาย/นางสาว)</span><Fill w={68} left>{nameOnly(s)}</Fill><span>รหัสประจำตัว</span><Fill grow>{s.studentCode}</Fill></Row>
      <Row y={86} x={27.5} right={27}><span>เบอร์โทรศัพท์</span><Fill w={30}>{str(d.phone)}</Fill><span>แผนกวิชา</span><Fill w={40} left>{s.department.replace(/^แผนกวิชา/, '')}</Fill><span>สาขาวิชา</span><Fill grow left>{s.program}</Fill></Row>
      <Row y={93} x={27.5} right={27}><span>มีความประสงค์ขอคำอธิบายรายวิชา จำนวน</span><Fill w={18}>{rows.length ? String(rows.length) : ''}</Fill><span>รายวิชา เพื่อ</span><Fill grow left>{str(d.purpose)}</Fill></Row>

      <table className="absolute text-[12pt]" style={{ left: '29mm', top: '95.5mm', width: '154mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>{[11, 34, 85, 9.5, 9.5].map((w, i) => <col key={i} style={{ width: `${w}mm` }} />)}</colgroup>
        <thead><tr style={{ height: '12mm' }}>{['ลำดับ', 'รหัสวิชา', 'รายวิชา', 'ป', 'น'].map((h) => <th key={h} className={`${cell} text-center font-normal`}>{h}</th>)}</tr></thead>
        <tbody className="text-[#0b2a8a] print:text-black">
          {Array.from({ length: 5 }, (_, i) => rows[i]).map((r, i) => (
            <tr key={i} style={{ height: '6.6mm' }}>
              <td className={`${cell} text-center`}>{r ? i + 1 : ''}</td>
              <td className={`${cell} text-center`}>{r?.code}</td>
              <td className={`${cell} truncate`}>{r?.name}</td>
              <td className={`${cell} text-center`}>{r?.periods ?? ''}</td>
              <td className={`${cell} text-center`}>{r?.credits ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Text x={51} y={153.5}>จึงเรียนมาเพื่อโปรดพิจารณา</Text>
      <Text x={0} w={210} y={161} center>ขอแสดงความนับถือ</Text>
      <Row y={168.5} x={78} right={null}><span>ลงชื่อ</span><SignFill w={52} src={studentSignature} /><span>นักศึกษา</span></Row>
      <Row y={175} x={84} right={null}><span>(</span><Fill w={52}>{fullNameOf(s)}</Fill><span>)</span></Row>

      <Text x={29} y={180.5}>ความเห็นงานพัฒนาหลักสูตรและการจัดการเรียนรู้</Text>
      <Row y={188.5} x={32} right={135}><Fill grow left>{cur ? `${cur.comment || 'เห็นควร'} · ลงนามออนไลน์ ${cur.actorName}` : ''}</Fill></Row>
      <Text x={29} w={70} y={198} center>({officials.curriculum_head})</Text>
      <Text x={20} w={90} y={205} center>หัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้</Text>
      <Text x={125} y={180.5}>ความเห็นของรองผู้อำนวยการฝ่ายวิชาการ</Text>
      <Row y={189} x={133} right={28}><Fill grow left>{dep ? `${dep.comment || 'เห็นควร'} · ลงนามออนไลน์ ${dep.actorName}` : ''}</Fill></Row>
      <Text x={125} w={70} y={198} center>({officials.deputy_academic})</Text>
      <Text x={125} w={70} y={205} center>รองผู้อำนวยการฝ่ายวิชาการ</Text>
      <DirectorOrder y={212} a={a('director')} holder={officials.director} options={false} signGap={13} />
      <Text x={27.5} y={252} bold>หมายเหตุ : เอสการประกอบการยื่นคำร้องขอคำอธิบายรายวิชา</Text>
      <Text x={41} y={259}>1. ใบระเบียนแสดงผลการเรียน (ใบ รบ.)</Text>
      <Text x={120} y={259}>2. สำเนาใบเปลี่ยนชื่อ-สกุล (ถ้ามี)</Text>
    </article>
  );
}
