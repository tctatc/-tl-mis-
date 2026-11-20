'use client';

import { THAI_MONTHS, parseIsoDate, toBuddhistYear } from '@csis/shared';
import { COLLEGE, DirectorOrder, Fill, Opinion, Paren, RequestNo, Row, Text, WrittenAt, nameOnly, step, str, type SheetProps, SignFill } from '../blocks';

/** คำร้อง ขอใบรับรองความประพฤติ (สแกน p14) */
export function ConductSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {}, studentSignature }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const birth = parseIsoDate(s.birthDate);
  return (
    <article className="sheet compact" aria-label="คำร้องขอใบรับรองความประพฤติ">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={210} y={12.5} center bold size={13.5}>คำร้อง&nbsp; ขอใบรับรองความประพฤติ</Text>
      <WrittenAt x={117} y={22} dateX={117} dateY={33} submittedAt={submittedAt} right={30} />
      <Text x={27.5} y={42.5}>เรื่อง&nbsp; ขอใบรับรองความประพฤติ</Text>
      <Text x={27.5} y={53}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={63} x={38.5} right={22}>
        <span>ข้าพเจ้า นาย/นางสาว</span><Fill grow left>{nameOnly(s)}</Fill>
        <span>นักศึกษา&nbsp; ระดับ <Paren on={s.level === 'pvc'}>ปวช.</Paren> <Paren on={s.level === 'pvs'}>ปวส.</Paren></span>
      </Row>
      <Row y={71.5} x={27.5} right={22}>
        <span>ชั้นปีที่</span><Fill w={15}>{String(s.yearLevel)}</Fill><span>รหัสประจำตัว</span><Fill w={34}>{s.studentCode}</Fill>
        <span>กลุ่ม</span><Fill w={14}>{s.groupNo}</Fill><span>สาขาวิชา</span><Fill grow left>{s.program}</Fill>
      </Row>
      <Row y={80} x={27.5} right={22}>
        <span>สาขางาน</span><Fill w={52} left>{str(d.track)}</Fill><span>เกิดวันที่</span><Fill w={14}>{birth ? String(birth.day) : ''}</Fill>
        <span>เดือน</span><Fill w={26}>{birth ? THAI_MONTHS[birth.month - 1] : ''}</Fill><span>พ.ศ.</span><Fill grow>{birth ? String(toBuddhistYear(birth.year)) : ''}</Fill>
      </Row>
      <Row y={88.5} x={27.5} right={22}><span>บิดาชื่อ</span><Fill w={70} left>{s.fatherName}</Fill><span>มารดาชื่อ</span><Fill grow left>{s.motherName}</Fill></Row>
      <Row y={97} x={27.5} right={22}>
        <span>สถานศึกษาเดิม</span><Fill w={54} left>{str(d.prevSchool)}</Fill><span>จังหวัด</span><Fill w={26}>{str(d.prevProvince)}</Fill>
        <span>ชั้นเรียนสุดท้าย</span><Fill grow left>{str(d.prevLevel)}</Fill>
      </Row>
      <Text x={29.5} y={106}>มีความประสงค์ขอหลักฐานราชการข้างต้นเพื่อใช้ (ระบุวัตถุประสงค์ที่นำไปใช้ให้ชัดเจน)</Text>
      <Row y={114.5} x={27.5} right={22}><Fill grow left>{str(d.purpose)}</Fill></Row>
      <Text x={44} y={124}>จึงเรียนมาเพื่อโปรดทราบและพิจารณา</Text>
      <Row y={134} x={92} right={null}><span>ลงชื่อ</span><SignFill w={52} src={studentSignature} /><span>นักเรียน/นักศึกษา</span></Row>

      <Opinion x={29.5} y={144} w={58} title="1. ความเห็นของครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} gap={6.4} />
      <Opinion x={109} y={144} w={60} title="2. ความเห็นของฝ่ายปกครอง" a={a('discipline')} holder={officials.discipline_head} gap={6.4} />
      <Opinion x={29.5} y={181} w={58} title="3. ความเห็นฝ่ายหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={6.4} />
      <Opinion x={109} y={181} w={60} title="4. ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={6.4} />
      <DirectorOrder y={213.5} a={a('director')} holder={officials.director} signGap={18} />
    </article>
  );
}
