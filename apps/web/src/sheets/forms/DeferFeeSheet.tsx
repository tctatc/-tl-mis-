'use client';

import { THAI_MONTHS, parseIsoDate, toBuddhistYear } from '@csis/shared';
import { COLLEGE, DirectorOrder, Fill, Opinion, Paren, RequestNo, Row, Text, WrittenAt, fullNameOf, step, str, type SheetProps } from '../blocks';

const money = (v: unknown) => (typeof v === 'number' && v > 0 ? v.toLocaleString('th-TH') : '');
const units = (v: unknown) => (typeof v === 'number' && v > 0 ? String(v) : '');

/** คำร้อง ขอผ่อนผันการชำระค่าหน่วยกิต (สแกน p12) — ผู้ปกครองเป็นผู้ยื่น */
export function DeferFeeSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {} }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const pay = parseIsoDate(str(d.payDate));
  const fin = a('finance');
  return (
    <article className="sheet compact" aria-label="คำร้องขอผ่อนผันการชำระค่าหน่วยกิต">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={190} y={9.5} center bold size={13}>คำร้อง&nbsp; ขอผ่อนผันการชำระค่าหน่วยกิต</Text>
      <WrittenAt x={115} y={15} dateX={115} dateY={21} submittedAt={submittedAt} right={34} />
      <Text x={23} y={29}>เรื่อง&nbsp; ขอผ่อนผันการชำระเงินค่าหน่วยกิต</Text>
      <Text x={23} y={35}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={43} x={41} right={22}><span>ข้าพเจ้า(ชื่อผู้ปกครอง)นาย/นาง/นางสาว</span><Fill w={40} left>{str(d.guardianName)}</Fill><span>เบอร์โทรศัพท์</span><Fill grow>{str(d.guardianPhone)}</Fill></Row>
      <Row y={51} x={23} right={22}><span>เป็นผู้ปกครองของ นาย/นางสาว</span><Fill w={38} left>{`${s.firstName} ${s.lastName}`}</Fill><span>เป็นนักเรียน/นักศึกษาสาขาวิชา</span><Fill grow left>{s.program}</Fill></Row>
      <Row y={59} x={23} right={null}>
        <span>ระดับชั้น</span><Fill w={12}>{`${s.level === 'pvc' ? 'ปวช.' : 'ปวส.'} ${s.yearLevel}`}</Fill><span>เกี่ยวข้องเป็น</span><Fill w={12}>{str(d.relation)}</Fill>
        <span>มีความประสงค์ขอผ่อนผันการชำระเงินภาคเรียนที่</span><Fill w={6}>{str(d.term)}</Fill><span>ปีการศึกษา</span><Fill w={12}>{str(d.year)}</Fill>
      </Row>
      <Row y={67.5} x={23} right={null}>
        <span>ดังนี้ 1. ค่าหน่วยกิต</span><Fill w={8}>{units(d.creditUnits)}</Fill><span>หน่วยกิตเป็นเงิน</span><Fill w={13}>{money(d.creditAmount)}</Fill><span>บาท&nbsp; 2. ค่าวัสดุฝึกงาน</span>
        <Fill w={8}>{units(d.materialUnits)}</Fill><span>หน่วยกิตเป็นเงิน</span><Fill w={13}>{money(d.materialAmount)}</Fill><span>บาท</span>
      </Row>
      <Row y={76} x={23} right={null}><span>ค้างชำระเงิน&nbsp;&nbsp; งวดที่ 2 ดังนี้ 1. ค่าหน่วยกิต</span><Fill w={10}>{units(d.oweCreditUnits)}</Fill><span>หน่วยกิตเป็นเงิน</span><Fill w={18}>{money(d.oweCreditAmount)}</Fill><span>บาท</span></Row>
      <Row y={84.5} x={61} right={null}><span>2. ค่าวัสดุฝึกงาน</span><Fill w={10}>{units(d.oweMaterialUnits)}</Fill><span>หน่วยกิตเป็นเงิน</span><Fill w={18}>{money(d.oweMaterialAmount)}</Fill><span>บาท</span></Row>
      <Row y={93.5} x={23} right={null}>
        <span>และจะนำเงิน&nbsp; งวดที่ 2&nbsp; มาชำระภายในวันที่</span><Fill w={16}>{pay ? String(pay.day) : ''}</Fill><span>เดือน</span><Fill w={30}>{pay ? THAI_MONTHS[pay.month - 1] : ''}</Fill>
        <span>พ.ศ.</span><Fill w={18}>{pay ? String(toBuddhistYear(pay.year)) : ''}</Fill>
      </Row>
      <Row y={103} x={23} right={28}><span>เหตุผลในการขอผ่อนผันการชำระเงินค่าหน่วยกิตในครั้งนี้เพราะ</span><Fill grow left>{str(d.reason)}</Fill></Row>
      <p className="absolute leading-[7mm]" style={{ left: '23mm', right: '24mm', top: '106mm', textIndent: '22mm', textAlign: 'justify' }}>
        ข้าพเจ้าขอรับรองว่า&nbsp; เมื่อครบกำหนดที่ขอผ่อนผันไว้แล้ว ข้าพเจ้าจะนำเงินส่วนที่ติดค้างไว้มาชำระให้ครบถ้วนทันทีถ้าข้าพเจ้าไม่ปฏิบัติตามคำร้องผ่อนผัน&nbsp; ให้ทางวิทยาลัยฯปฏิบัติตามระเบียบการจัดการศึกษา&nbsp; หลักสูตร ปวช.67&nbsp; และหลักสูตร ปวส.67 ได้ตามระเบียบทุกประการ
      </p>
      <Text x={124} y={133}>ขอแสดงความนับถือ</Text>
      <Row y={145} x={104} right={null}><span>ลงชื่อ</span><Fill w={46}>{''}</Fill><span>ผู้ปกครองนักเรียน</span></Row>
      <Text x={108} y={150} size={10} style={{ color: '#444' }}>({str(d.guardianName)} ผู้ปกครองของ {fullNameOf(s)})</Text>
      <div className="absolute border-t border-black" style={{ left: '22mm', right: '18mm', top: '152mm' }} />

      <Opinion x={23} y={158} w={62} title="1.  ความเห็นของครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} gap={6.5} date={false} />
      <Opinion x={98} y={157} w={56} title="2.  ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={6.5} date={false} />
      <Opinion x={25} y={184} w={60} title="3.  ความเห็นรองผู้อำนวยการฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={6.6} date={false} />
      <Text x={122} y={182} bold>คำสั่งอนุมัติ</Text>
      <Text x={118} y={189}><Paren on={a('director')?.decision === 'approve'}>อนุมัติ</Paren>&nbsp;&nbsp; <Paren on={a('director')?.decision === 'reject'}>ไม่อนุมัติ</Paren></Text>
      <Text x={118} y={196}>และมอบงานทะเบียนเก็บไว้ทวงถาม</Text>
      <Row y={203} x={118} right={22}><span>ลงชื่อ</span><Fill grow>{a('director') ? `ลงนามออนไลน์ ${a('director')!.actorName}` : ''}</Fill></Row>
      <Text x={125} y={210}>({officials.director})</Text>
      <div className="absolute border-t border-black" style={{ left: '17mm', right: '18mm', top: '213mm' }} />

      <Text x={20} y={219.5} style={{ textDecoration: 'underline' }}>หัวหน้างานการเงิน</Text>
      <Row y={227} x={20} right={18}>
        <span>ได้รับเงิน <u>งวดแรก</u> จำนวน</span><Fill w={14}>{''}</Fill><span>บาทตามใบเสร็จเล่มที่</span><Fill grow left>{fin?.comment ?? ''}</Fill>
        <span>ยังค้างชำระเงิน<u>งวดที่ 2</u> อีกจำนวน</span><Fill w={14}>{money((d.oweCreditAmount as number) + ((d.oweMaterialAmount as number) || 0))}</Fill><span>บาท</span>
      </Row>
      <Row y={235} x={20} right={60}><span>ลงชื่อ</span><Fill grow>{fin ? `ลงนามออนไลน์ ${fin.actorName}` : ''}</Fill><span>ผู้รับเงิน</span></Row>
      <Row y={243} x={20} right={18}><span>ได้รับเงิน งวดสอง เป็นจำนวนเงิน</span><Fill w={24}>{''}</Fill><span>บาท ตามใบเสร็จเล่มที่</span><Fill grow>{''}</Fill></Row>
      <Row y={251} x={20} right={18}><Fill grow>{''}</Fill></Row>
      <Row y={259} x={20} right={18}><Fill grow>{''}</Fill></Row>
    </article>
  );
}
