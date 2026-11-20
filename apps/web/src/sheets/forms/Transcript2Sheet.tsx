'use client';

import { COLLEGE, DirectorOrder, FinanceReceipt, Fill, Opinion, Paren, RequestNo, Row, Text, WrittenAt, nameOnly, step, str, type SheetProps } from '../blocks';

/** คำร้อง ขอ Transcript ชุดที่ 2 (สแกน p10) */
export function Transcript2Sheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {} }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  return (
    <article className="sheet compact" aria-label="คำร้องขอ Transcript ชุดที่ 2">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={210} y={18} center bold size={13.5}>คำร้อง&nbsp; ขอ Transcript&nbsp; ชุดที่ 2</Text>
      <WrittenAt x={120.5} y={27} dateX={119} dateY={34.5} submittedAt={submittedAt} right={30} />
      <Text x={28.3} y={47.5}>เรื่อง&nbsp; ขอ Transcript&nbsp;&nbsp; ชุดที่ 2</Text>
      <Text x={28.3} y={57.5}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={67} x={39} right={21}><span>ข้าพเจ้า (นาย/นางสาว)ชื่อไทย</span><Fill w={40} left>{nameOnly(s)}</Fill><span>ชื่ออังกฤษ</span><Fill grow left>{str(d.nameEn)}</Fill></Row>
      <Row y={74} x={28.3} right={21}>
        <span>จังหวัดที่เกิด</span><Fill w={30}>{str(d.birthProvince)}</Fill><span>เป็นศิษย์เก่า&nbsp; ระดับ <Paren on={s.level === 'pvc'}>ปวช.</Paren>&nbsp;&nbsp; <Paren on={s.level === 'pvs'}>ปวส.</Paren>&nbsp; สาขาวิชา</span><Fill grow left>{s.program}</Fill>
      </Row>
      <Row y={81.5} x={28.3} right={21}><span>เริ่มเข้าเรียนเมื่อปีการศึกษา</span><Fill w={42}>{str(d.entryYear)}</Fill><span>สำเร็จการศึกษาเมื่อ</span><Fill grow left>{str(d.graduatedWhen)}</Fill></Row>
      <Row y={89} x={28.3} right={21}><span>มีความประสงค์ขอหลักฐานราชการข้างต้น&nbsp; เพื่อนำไป</span><Fill grow left>{str(d.purpose)}</Fill></Row>
      <Row y={96.5} x={28.3} right={80}><span>เนื่องจาก สำเนา รบ. ชุดที่ 1</span><Fill grow left>{str(d.reason)}</Fill></Row>
      <Text x={39.5} y={106}>จึงเรียนมาเพื่อโปรดดำเนินการให้ด้วย&nbsp; จักขอบคุณยิ่ง</Text>
      <Text x={122} y={112}>ขอแสดงความนับถือ</Text>
      <Row y={124.5} x={110} right={null}><span>ลงชื่อ</span><Fill w={52}>{''}</Fill><span>นักศึกษา</span></Row>

      <Opinion x={25} y={140} w={68} title="1. ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={6.8} />
      <FinanceReceipt x={25} y={175} w={68} title="2.  หัวหน้างานการเงิน" a={a('finance')} holder={officials.finance_head} gap={6.8} />
      <Opinion x={120} y={138} w={66} title="3. ความเห็นของรอง  ฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={6.8} />
      <DirectorOrder y={172} cx={150} a={a('director')} holder={officials.director} signGap={14.5} options />
      <Text x={25} y={262} size={12}><span className="underline">หมายเหตุ</span>&nbsp;&nbsp;&nbsp; ใช้รูปถ่าย&nbsp; 1&nbsp; นิ้ว&nbsp;&nbsp; จำนวน&nbsp; 2&nbsp; รูป&nbsp;&nbsp; แนบมาด้วย&nbsp;&nbsp; (เขียนชื่อหลังรูป)</Text>
    </article>
  );
}
