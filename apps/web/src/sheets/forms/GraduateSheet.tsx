'use client';

import { THAI_MONTHS, parseIsoDate, toBuddhistYear } from '@csis/shared';
import { COLLEGE, DirectorOrder, Fill, Opinion, Paren, RequestNo, Row, Text, fullNameOf, nameOnly, step, str, type SheetProps, SignFill } from '../blocks';
import type { ApprovalRecord } from '@csis/shared';

/** ช่องความเห็นแบบติ๊ก ( ) ครบ / ( ) ไม่ครบ เนื่องจาก... ของแบบคำร้องขอจบ */
function Checked({ x, y, title, ok, not, a, holder }: { x: number; y: number; title: string; ok: string; not: string; a?: ApprovalRecord; holder?: string }) {
  const yes = a?.decision === 'approve';
  const no = !!a && !yes;
  return (
    <>
      <Text x={x} y={y} bold>{title}</Text>
      <Text x={x} y={y + 7}><Paren on={yes}>{ok}</Paren></Text>
      <Row y={y + 14} x={x} right={210 - x - 70}><span><Paren on={no}>{not}</Paren></span><Fill grow left>{no ? a?.comment ?? '' : ''}</Fill></Row>
      <Row y={y + 21} x={x} right={210 - x - 70}><span>(ลงชื่อ)</span><Fill grow>{a ? `ลงนามออนไลน์ ${a.actorName}` : ''}</Fill></Row>
      <Text x={x} w={72} y={y + 28} center>({holder || a?.actorName || ' '.repeat(30)})</Text>
    </>
  );
}

/** แบบคำร้องขอจบการศึกษา (สแกน p09) */
export function GraduateSheet({ student: s, data: d, requestNo, approvals, officials = {}, studentSignature }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const birth = parseIsoDate(s.birthDate);
  const reg = a('registrar');
  return (
    <article className="sheet compact" aria-label="แบบคำร้องขอจบการศึกษา">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={210} y={15} center bold size={13.5}>แบบคำร้องขอจบการศึกษา</Text>
      <Row y={30} x={27} right={null}><span>เรื่อง&nbsp; ขอจบการศึกษาในปีการศึกษา</span><Fill w={36}>{str(d.year)}</Fill></Row>
      <Text x={27} y={38}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={46} x={38.5} right={23}>
        <span>ข้าพเจ้า (นาย/นางสาว)</span><Fill w={48} left>{nameOnly(s)}</Fill><span>รหัสประจำตัวนักศึกษา</span><Fill grow>{s.studentCode}</Fill>
      </Row>
      <Row y={54} x={27} right={23}>
        <span>นักเรียน นักศึกษาระดับ <Paren on={s.level === 'pvc'}>ปวช.</Paren> <Paren on={s.level === 'pvs'}>ปวส.</Paren> สาขาวิชา</span><Fill w={44} left>{s.program}</Fill>
        <span>ระดับชั้น</span><Fill grow>{String(s.yearLevel)}</Fill>
      </Row>
      <Row y={62} x={27} right={23}>
        <span>เกิดวันที่</span><Fill w={16}>{birth ? String(birth.day) : ''}</Fill><span>เดือน</span><Fill w={26}>{birth ? THAI_MONTHS[birth.month - 1] : ''}</Fill>
        <span>พ.ศ.</span><Fill w={16}>{birth ? String(toBuddhistYear(birth.year)) : ''}</Fill><span>เบอร์โทรศัพท์</span><Fill grow>{str(d.phone)}</Fill>
      </Row>
      <Row y={70} x={27} right={23}><span>บิดาชื่อ</span><Fill w={70} left>{s.fatherName}</Fill><span>มารดาชื่อ</span><Fill grow left>{s.motherName}</Fill></Row>
      <Text x={27} y={78}>
        ได้รับการประเมินผลการเรียนรวมแล้วครบถ้วนตามหลักสูตร <Paren on={s.level === 'pvc'}>ปวช.</Paren> <Paren on={s.level === 'pvs'}>ปวส.</Paren> และได้ลงทะเบียนเรียน <Paren on={d.registeredAll === 'yes'}>ครบ</Paren> <Paren on={d.registeredAll === 'no'}>ไม่ครบ</Paren>
      </Text>
      <Text x={27} y={86} bold>กรณีลงทะเบียนไม่ครบกรุณาติดต่องานทะเบียนโดยทันที(หากไม่ติดต่อจะอนุมัติจบการศึกษาไม่ได้)</Text>
      <Text x={27} y={94}>จึงขออนุมัติสำเร็จการศึกษาจาก{COLLEGE}</Text>
      <Text x={38.5} y={102}>จึงเรียนมาเพื่อโปรดทราบ</Text>
      <Text x={137} y={111}>ขอแสดงความนับถือ</Text>
      <Row y={124} x={121} right={null}><span>ลงชื่อ</span><SignFill w={42} src={studentSignature} /><span>นักศึกษา</span></Row>
      <Row y={131} x={125} right={null}><span>(</span><Fill w={42}>{fullNameOf(s)}</Fill><span>)</span></Row>

      <Opinion x={29.5} y={139} w={60} title="1.  ความเห็นครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} lines={0} date={false} signLabel="(ลงชื่อ)" gap={7} />
      <Checked x={116} y={137} title="2.  ความเห็นหัวหน้าสาขาวิชา" ok="ส่งคืนอุปกรณ์  วัสดุ  อื่นๆ ครบถ้วนแล้ว" not="ไม่ครบ เนื่องจาก" a={a('programHead')} holder={s.programHeadName} />
      <Checked x={29.5} y={160} title="3.  ความเห็นหัวหน้าห้องสมุด" ok="ส่งคืนหนังสือครบถ้วน" not="ไม่ครบ เนื่องจาก" a={a('library')} holder={officials.library_head} />
      <Checked x={116} y={174} title="4.  ความเห็นหัวหน้าการเงิน" ok="ชำระเงินค่าบำรุงการศึกษา หน่วยกิต ครบถ้วนแล้ว" not="ไม่ครบ เนื่องจาก" a={a('finance')} holder={officials.finance_head} />
      <Text x={29.5} y={200} bold>5.  ความเห็นหัวหน้างานทะเบียน</Text>
      <Text x={29.5} y={207}><Paren on={reg?.decision === 'approve'}>เห็นควรอนุมัติ</Paren></Text>
      <Row y={214} x={29.5} right={110}><span><Paren on={!!reg && reg.decision !== 'approve'}>{''}</Paren></span><Fill grow left>{reg && reg.decision !== 'approve' ? reg.comment : reg?.comment ?? ''}</Fill></Row>
      <Row y={221} x={29.5} right={110}><span>(ลงชื่อ)</span><Fill grow>{reg ? `ลงนามออนไลน์ ${reg.actorName}` : ''}</Fill></Row>
      <Text x={29.5} w={72} y={228} center>({officials.registrar_head || ' '.repeat(30)})</Text>
      <DirectorOrder y={211} cx={150} a={a('director')} holder={officials.director} date={false} signGap={16} />
      <Text x={29.5} y={262} size={12}><span className="underline">หมายเหตุ</span>&nbsp;&nbsp; ใช้รูปถ่าย 1 นิ้ว&nbsp; จำนวน 8&nbsp; รูป&nbsp;&nbsp; (เขียนชื่อ-นามสกุลและรหัสประจำตัวหลังรูปด้วย)</Text>
    </article>
  );
}
