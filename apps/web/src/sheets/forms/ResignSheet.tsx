'use client';

import { COLLEGE, DirectorOrder, Fill, Opinion, Paren, RequestNo, Row, Text, WrittenAt, fullNameOf, nameOnly, step, str, SignFill, type SheetProps } from '../blocks';

/** คำร้อง ขอลาออกจากสถานศึกษา (สแกน p07) */
export function ResignSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {}, studentSigned }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  return (
    <article className="sheet compact" aria-label="คำร้องขอลาออกจากสถานศึกษา">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={195} y={16} center bold size={14}>คำร้อง&nbsp; ขอลาออกจากสถานศึกษา</Text>
      <WrittenAt x={105.5} y={21.5} dateX={102} dateY={30} submittedAt={submittedAt} right={50} />
      <Text x={27.4} y={43.5}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={50} x={38.5} right={25}>
        <span>ข้าพเจ้า นาย/นางสาว</span><Fill w={52} left>{nameOnly(s)}</Fill>
        <span>รหัสประจำตัว</span><Fill w={28}>{s.studentCode}</Fill><span>กลุ่มที่</span><Fill grow>{s.groupNo}</Fill>
      </Row>
      <Row y={56} x={27.4} right={25}>
        <span>เป็นนักศึกษาระดับ <Paren on={s.level === 'pvc'}>ปวช.</Paren></span><Fill w={13}>{''}</Fill>
        <span><Paren on={s.level === 'pvs'}>ปวส.</Paren></span><Fill w={13}>{''}</Fill>
        <span>ชั้นปีที่</span><Fill w={9}>{String(s.yearLevel)}</Fill><span>สาขาวิชา</span><Fill grow left>{s.program}</Fill>
      </Row>
      <Row y={62} x={27.4} right={25}>
        <span>มีความประสงค์ขอลาออกจาก{COLLEGE} เพราะ (ระบุรายละเอียด)</span><Fill grow left>{''}</Fill>
      </Row>
      <Row y={68.3} x={27.4} right={25}><Fill grow left>{str(d.reason)}</Fill></Row>
      <Text x={32.4} y={75}>จึงเรียนมาเพื่อโปรดดำเนินการ ตามความประสงค์ของข้าพเจ้าด้วย</Text>
      <Row y={80} x={121} right={null}><span>ลงชื่อ</span><SignFill w={48} name={studentSigned ? `${s.firstName} ${s.lastName}` : undefined} /><span>นักศึกษา</span></Row>
      <Row y={86.6} x={125.5} right={null}><span>(</span><Fill w={46}>{fullNameOf(s)}</Fill><span>)</span></Row>
      <Row y={92.3} x={121} right={null}><span>ลงชื่อ</span><Fill w={48}>{''}</Fill><span>ผู้ปกครอง</span></Row>
      <Row y={99} x={125.5} right={null}><span>(</span><Fill w={46}>{str(d.guardianName)}</Fill><span>)</span></Row>

      <Opinion x={28.7} y={108} w={58} title="1. ความเห็นของครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} gap={6.9} />
      <Opinion x={97.7} y={107} w={58} title="2. ความเห็นของหัวหน้าสาขาวิชา" a={a('programHead')} holder={s.programHeadName} gap={6.9} />
      <Opinion x={28.7} y={142.5} w={58} title={<>3. ความเห็นหัวหน้างานห้องสมุด<br />&nbsp;&nbsp;&nbsp;ขอรับรองไม่มีหนี้สินติดค้าง</>} a={a('library')} holder={officials.library_head} gap={6.9} lines={1} titleLines={2} />
      <Opinion x={97.7} y={141.5} w={58} title={<>4. ความเห็นหน้างานการเงิน<br />&nbsp;&nbsp;&nbsp;ขอรับรองไม่มีหนี้สินติดค้าง</>} a={a('finance')} holder={officials.finance_head} gap={6.9} lines={1} titleLines={2} />
      <Opinion x={28.7} y={184.5} w={58} title="5. ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={6.9} />
      <Opinion x={97.7} y={183.5} w={58} title="6. ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={6.9} />
      <DirectorOrder y={219.5} cx={106.6} a={a('director')} holder={officials.director} signGap={15} />
      <Row y={271} x={27.4} right={60}><span>เบอร์โทรศัพท์ที่ติดต่อได้</span><Fill grow left>{str(d.phone)}</Fill></Row>
    </article>
  );
}
