'use client';

import type { CourseRow } from '@csis/shared';
import { COLLEGE, DirectorOrder, Fill, Paren, RequestNo, Row, Text, WrittenAt, nameOnly, step, str, type SheetProps, SignFill } from '../blocks';

const cell = 'border border-black px-[1mm] text-center align-middle';

/** คำร้อง ขอเปลี่ยนแปลงรายวิชาเรียน (เรียนซ้ำ,รีเกรด,เพิ่ม,ถอน) (สแกน p11) */
export function CourseChangeSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {}, studentSigned }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const actions = (d.actions as string[] | undefined) ?? [];
  const rows = ((d.courses as CourseRow[] | undefined) ?? []).slice(0, 5);
  const change = rows.reduce((sum, r) => sum + (r.periods ?? 0), 0);
  const regular = Number(d.regularPeriods) || 0;
  const total = actions.includes('withdraw') && !actions.some((x) => x !== 'withdraw') ? regular - change : regular + change;
  const opinion = (key: string, label: string, y: number, holder?: string) => {
    const x = a(key);
    return (
      <Row y={y} x={19.5} right={22}>
        <span>{label}</span><Fill grow left>{x ? [x.comment || 'เห็นควร', ].join('') : ''}</Fill>
        <span>ลงชื่อ</span><Fill w={36}>{x ? `ออนไลน์ ${x.actorName}` : holder ? '' : ''}</Fill>
      </Row>
    );
  };
  return (
    <article className="sheet compact" aria-label="คำร้องขอเปลี่ยนแปลงรายวิชาเรียน">
      <RequestNo requestNo={requestNo} />
      <Text x={0} w={210} y={15} center bold size={13.5}>คำร้อง&nbsp;&nbsp; ขอเปลี่ยนแปลงรายวิชาเรียน&nbsp; (เรียนซ้ำ,รีเกรด,เพิ่ม,ถอน)</Text>
      <WrittenAt x={114.5} y={27} dateX={114.5} dateY={34} submittedAt={submittedAt} right={27} />
      <Text x={20.5} y={40.5}>เรื่อง&nbsp; ขอเปลี่ยนแปลงรายวิชา</Text>
      <Text x={20.5} y={48}>เรียน&nbsp; ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={55.5} x={38} right={23}><span>ข้าพเจ้า (นาย/นางสาว)</span><Fill w={56} left>{nameOnly(s)}</Fill><span>รหัสประจำตัว</span><Fill grow>{s.studentCode}</Fill></Row>
      <Row y={62.5} x={77.5} right={null}><span><Paren on={d.studentKind === 'regular'}>&nbsp;นักศึกษาปกติ</Paren>&nbsp; ชั้นปีที่</span><Fill w={14}>{d.studentKind === 'regular' ? String(s.yearLevel) : ''}</Fill></Row>
      <Row y={69.5} x={77.5} right={null}><span><Paren on={d.studentKind === 'backlog'}>&nbsp;นักเรียนตกค้าง</Paren>&nbsp; ปีการศึกษา</span><Fill w={20}>{d.studentKind === 'backlog' ? str(d.backlogYear) : ''}</Fill></Row>
      <Row y={77} x={20.5} right={23}><span>แผนกวิชา</span><Fill w={66} left>{s.department.replace(/^แผนกวิชา/, '')}</Fill><span>กลุ่มที่</span><Fill w={28}>{s.groupNo}</Fill><span>มีความประสงค์ขอลงทะเบียน</span></Row>
      <Text x={44.5} y={84.5}><Paren on={actions.includes('repeat0')}>&nbsp;เรียนซ้ำรายวิชาที่ติด 0 (ศูนย์)</Paren></Text>
      <Text x={121} y={84.5}><Paren on={actions.includes('regrade')}>&nbsp;เรียนซ้ำเพื่อปรับระดับคะแนน (รีเกรด)</Paren></Text>
      <Text x={44.5} y={91.5}><Paren on={actions.includes('replace0')}>&nbsp;เรียนแทนรายวิชาที่ติด 0 (ศูนย์)</Paren></Text>
      <Text x={121} y={91.5}><Paren on={actions.includes('add')}>&nbsp;เพิ่มรายวิชาเพื่อให้ครบหลักสูตร</Paren></Text>
      <Row y={98.5} x={44.5} right={null}><span><Paren on={actions.includes('withdraw')}>&nbsp;ถอนรายวิชา เนื่องจาก</Paren></span><Fill w={30} left>{str(d.withdrawReason)}</Fill></Row>
      <Text x={121} y={98.5}><Paren on={actions.includes('audit')}>&nbsp;เรียนโดยไม่คิดหน่วยกิต</Paren></Text>

      <table className="absolute text-[11.5pt]" style={{ left: '18.5mm', top: '101mm', width: '153.5mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>{[11, 21, 36, 6.5, 6.5, 17, 18, 22, 15.5].map((w, i) => <col key={i} style={{ width: `${w}mm` }} />)}</colgroup>
        <thead>
          <tr style={{ height: '12.5mm' }}>
            {['ลำดับ', 'รหัสวิชา', 'รายวิชา', 'ป', 'น', 'จำนวนเงิน', 'เรียน วัน/เวลา', 'ชื่ออาจารย์ผู้สอน', 'ลายเซ็น อ.ผู้สอน'].map((h) => <th key={h} className={`${cell} font-normal leading-tight`}>{h}</th>)}
          </tr>
        </thead>
        <tbody className="text-[#0b2a8a] print:text-black">
          {Array.from({ length: 5 }, (_, i) => rows[i]).map((r, i) => (
            <tr key={i} style={{ height: '6.6mm' }}>
              <td className={cell}>{r ? i + 1 : ''}</td>
              <td className={`${cell} whitespace-nowrap text-[9.5pt]`}>{r?.code}</td>
              <td className={`${cell} truncate text-left text-[9.5pt]`}>{r?.name}</td>
              <td className={cell}>{r?.periods ?? ''}</td>
              <td className={cell}>{r?.credits ?? ''}</td>
              <td className={cell}>{r?.amount}</td>
              <td className={`${cell} truncate text-[9pt]`}>{r?.dayTime}</td>
              <td className={`${cell} truncate text-[9pt]`}>{r?.teacher}</td>
              <td className={cell} />
            </tr>
          ))}
        </tbody>
      </table>

      <Row y={155} x={20.5} right={36}><span>ในภาคเรียนนี้ข้าพเจ้าลงทะเบียนเรียนปกติจำนวน</span><span className="ml-auto" /><Fill w={26}>{String(regular)}</Fill><span>คาบ/สัปดาห์</span></Row>
      <Row y={162} x={20.5} right={36}><span>ขอเปลี่ยนแปลงรายวิชาจำนวน</span><span className="ml-auto" /><Fill w={26}>{rows.length ? String(change) : ''}</Fill><span>คาบ/สัปดาห์</span></Row>
      <Row y={169} x={20.5} right={36}><span>รวมลงทะเบียนในภาคเรียนทั้งหมด</span><span className="ml-auto" /><Fill w={26}>{rows.length ? String(total) : ''}</Fill><span>คาบ/สัปดาห์</span></Row>
      <Text x={20.5} y={181}>จึงเรียนมาเพื่อโปรดพิจารณา</Text>
      <Row y={187.5} x={118} right={null}><span>ลงชื่อ</span><SignFill w={40} name={studentSigned ? `${s.firstName} ${s.lastName}` : undefined} /><span>นักศึกษา</span></Row>
      {opinion('advisor', 'ความเห็นครูที่ปรึกษา', 194.5, s.advisorName)}
      {opinion('curriculum', 'ความเห็นหัวหน้างานหลักสูตร', 201.5)}
      <Row y={208.5} x={19.5} right={22}>
        <span>ความเห็นหัวหน้างานการเงิน เล่มที่</span><Fill w={12}>{''}</Fill><span>เลขที่</span><Fill w={12}>{''}</Fill><span>จำนวนเงิน</span><Fill grow>{a('finance')?.comment ?? ''}</Fill>
        <span>ลงชื่อ</span><Fill w={36}>{a('finance') ? `ออนไลน์ ${a('finance')!.actorName}` : ''}</Fill>
      </Row>
      {opinion('registrar', 'ความเห็นหัวหน้างานทะเบียน', 215.5)}
      {opinion('deputy', 'ความเห็นรองผู้อำนวยการฝ่ายวิชาการ', 222.5)}
      <DirectorOrder y={230} a={a('director')} holder={officials.director} options={false} signGap={10} />
    </article>
  );
}
