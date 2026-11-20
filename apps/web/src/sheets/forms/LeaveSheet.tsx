'use client';

import { LEVEL_LABEL } from '@csis/shared';
import { COLLEGE, DirectorOrder, FinanceReceipt, Fill, Opinion, RequestNo, Row, Text, WrittenAt, fullNameOf, nameOnly, step, str, type SheetProps } from '../blocks';

/** คำร้อง ขอลาพักการเรียนและรักษาสภาพนักเรียน/นักศึกษา (สแกน p13) */
export function LeaveSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {} }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  return (
    <article className="sheet compact" aria-label="คำร้องขอลาพักการเรียน">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={215} y={14} center bold size={14}>คำร้อง&nbsp; ขอลาพักการเรียนและรักษาสภาพนักเรียน/นักศึกษา</Text>
      <WrittenAt x={117} y={21} dateX={117} dateY={28.5} submittedAt={submittedAt} right={26} />
      <Text x={30.2} y={35.5}>เรื่อง&nbsp; ขอลาพักการเรียนและรักษาสภาพนักเรียน/นักศึกษา</Text>
      <Text x={30.2} y={45}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={56} x={39} right={22}>
        <span>ข้าพเจ้า (นาย/นางสาว)</span><Fill w={46} left>{nameOnly(s)}</Fill>
        <span>รหัสประจำตัว</span><Fill w={30}>{s.studentCode}</Fill><span>กลุ่มที่</span><Fill grow>{s.groupNo}</Fill>
      </Row>
      <Row y={62.5} x={30.2} right={22}>
        <span>สาขาวิชา</span><Fill w={40} left>{s.program}</Fill><span>ระดับชั้น</span><Fill w={30}>{`${LEVEL_LABEL[s.level]} ${s.yearLevel}`}</Fill>
        <span>มีความประสงค์ขอลาพักการเรียนและ</span>
      </Row>
      <Row y={69.5} x={30.2} right={22}>
        <span>รักษาสภาพนักเรียน/นักศึกษา ในภาคเรียนที่</span><Fill w={12}>{str(d.term)}</Fill><span>ปีการศึกษา</span><Fill w={13}>{str(d.year)}</Fill>
        <span>เนื่องจาก (ระบุเหตุผล)</span><Fill grow left>{''}</Fill>
      </Row>
      <Row y={76} x={30.2} right={22}><Fill grow left>{str(d.reason)}</Fill></Row>
      <Row y={82.5} x={30.2} right={22}>
        <span>และจะกลับมาเรียนในภาคเรียนที่</span><Fill w={16}>{str(d.returnTerm)}</Fill><span>ปีการศึกษา</span><Fill w={20}>{str(d.returnYear)}</Fill>
        <span>โดยจะมาแจ้งความจำนงขอกลับเข้าเรียน</span>
      </Row>
      <Text x={30.2} y={90}>ก่อนลงทะเบียนทุกครั้ง</Text>
      <Text x={36} y={101}>จึงเรียนมาเพื่อโปรดพิจารณา</Text>
      <Row y={107.5} x={100.5} right={null}><span>ลงชื่อ</span><Fill w={40}>{''}</Fill><span>นักเรียน/นักศึกษา</span></Row>
      <Text x={100.5} y={113.5} size={10.5} style={{ color: '#444' }}>({fullNameOf(s)})</Text>

      {/* ผู้ปกครองลงความเห็นบนกระดาษ */}
      <Opinion x={30.2} y={121} w={70} title="1. ความเห็นผู้ปกครอง" holder={s.guardianName} gap={6.6} />
      <Opinion x={122} y={121} w={60} title="2. ความเห็นของครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} gap={6.6} />

      <FinanceReceipt x={30.2} y={154} w={68} title="3. หัวหน้างานการเงิน" a={a('finance')} holder={officials.finance_head} />
      <Opinion x={122} y={154} w={60} title="4. ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={6.6} />
      <Opinion x={30.2} y={200} w={68} title="5. ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={6.8} />
      <DirectorOrder y={200.5} cx={152} a={a('director')} holder={officials.director} signGap={20} />
    </article>
  );
}
