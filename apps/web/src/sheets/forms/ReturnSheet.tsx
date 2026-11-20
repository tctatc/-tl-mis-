'use client';

import { COLLEGE, DirectorOrder, FinanceReceipt, Fill, Opinion, Paren, RequestNo, Row, Text, WrittenAt, fullNameOf, nameOnly, step, str, type SheetProps, SignFill } from '../blocks';

/** คำร้อง ขอกลับเข้าเรียน (สแกน p08) */
export function ReturnSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {}, studentSigned }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const cause = str(d.cause);
  const at = (key: string) => (cause === key ? [str(d.causeTerm), str(d.causeYear)] : ['', '']);
  return (
    <article className="sheet compact" aria-label="คำร้องขอกลับเข้าเรียน">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={210} y={17.5} center bold size={14}>คำร้อง&nbsp; ขอกลับเข้าเรียน</Text>
      <WrittenAt x={101.5} y={22.5} dateX={109} dateY={31} submittedAt={submittedAt} right={46} />
      <Text x={26} y={44.5}>เรื่อง&nbsp; ขอกลับเข้าเรียนตามปกติ</Text>
      <Text x={26} y={51.5}>เรียน&nbsp; ผู้อำนวยการ {COLLEGE}</Text>
      <Row y={59} x={33.5} right={26}>
        <span>ข้าพเจ้า นาย/นางสาว</span><Fill w={50} left>{nameOnly(s)}</Fill><span>รหัสประจำตัว</span><Fill grow>{s.studentCode}</Fill><span>นักศึกษา</span>
      </Row>
      <Row y={66} x={26} right={26}>
        <span>ระดับชั้น <Paren on={s.level === 'pvc'}>ปวช.</Paren> <Paren on={s.level === 'pvs'}>ปวส.</Paren> สาขาวิชา</span><Fill w={58} left>{s.program}</Fill>
        <span>ปีการศึกษา</span><Fill grow>{str(d.returnYear)}</Fill>
      </Row>
      {([['retain', 'รักษาสภาพ', 74], ['leave', 'ลาพักการเรียน', 81.5], ['other', '', 89]] as const).map(([key, label, y], i) => {
        const [t, yy] = at(key);
        return (
          <div key={key}>
            <Row y={y} x={i === 0 ? 26 : 45} right={null}>
              {i === 0 && <span>เนื่องจากสาเหตุ</span>}
              <span><Paren on={cause === key}>{label}</Paren></span>{key === 'other' && <Fill w={36} left>{cause === 'other' ? str(d.causeOther) : ''}</Fill>}
            </Row>
            <Row y={y} x={88} right={36}><span>เมื่อภาคเรียนที่</span><Fill w={14}>{t}</Fill><span>ปีการศึกษา</span><Fill grow>{yy}</Fill></Row>
          </div>
        );
      })}
      <Row y={96} x={33.5} right={26}><span>บัดนี้ข้าพเจ้ามีความประสงค์ขอกลับเข้าเรียน&nbsp;&nbsp; เพื่อเรียนให้จบหลักสูตร</span><Fill grow left>{s.curriculumName ?? ''}</Fill></Row>
      <Row y={103.5} x={26} right={26}>
        <span>ในภาคเรียนที่</span><Fill w={13}>{str(d.returnTerm)}</Fill><span>ปีการศึกษา</span><Fill w={14}>{str(d.returnYear)}</Fill>
        <span>ซึ่งจะต้องเรียนกับ ระดับชั้น/แผนก</span><Fill grow left>{str(d.withLevel)}</Fill>
      </Row>
      <Row y={111} x={26} right={null}><span>เป็นเวลา(ระบุภาคเรียน)</span><Fill w={50}>{str(d.termsLeft)}</Fill><span>ภาคเรียน จึงจะจบหลักสูตร</span></Row>
      <Text x={33.5} y={122.5}>จึงเรียนมาเพื่อโปรดพิจารณา</Text>
      <Row y={131.5} x={84} right={null}><span>ลงชื่อ</span><SignFill w={42} name={studentSigned ? `${s.firstName} ${s.lastName}` : undefined} /><span>นักเรียน/นักศึกษา</span></Row>
      <Row y={138.5} x={88} right={null}><span>(</span><Fill w={42}>{fullNameOf(s)}</Fill><span>)</span></Row>

      <Opinion x={26} y={148} w={60} title="1. ความเห็นของครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} gap={6.6} paren={false} />
      <Opinion x={104} y={145} w={62} title="2. ความเห็นของหัวหน้าสาขาวิชา" a={a('programHead')} holder={s.programHeadName} gap={6.6} paren={false} />
      <FinanceReceipt x={26} y={178} w={62} title="3. หัวหน้างานการเงิน" a={a('finance')} holder={officials.finance_head} gap={7} />
      <Opinion x={104} y={175.5} w={62} title="4. ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} gap={7.2} />
      <Opinion x={26} y={227} w={58} title="5. ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร" a={a('deputy')} holder={officials.deputy_resources} gap={7.6} />
      <DirectorOrder y={219.5} cx={152} a={a('director')} holder={officials.director} signGap={17} />
    </article>
  );
}
