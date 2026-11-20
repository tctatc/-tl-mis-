'use client';

import type { CourseRow } from '@csis/shared';
import { Box } from '../parts';
import { COLLEGE, Fill, RequestNo, Row, Text, WrittenAt, fullNameOf, slashDate, step, str, type SheetProps } from '../blocks';
import type { ApprovalRecord } from '@csis/shared';

const tick = (on: boolean) => <Box checked={on} />;

function FormNo({ no, landscape = false }: { no: string; landscape?: boolean }) {
  return <p className="absolute border border-black px-[2mm] text-[11pt] italic" style={{ right: landscape ? '14mm' : '24mm', top: landscape ? '8mm' : '12mm' }}>{no}</p>;
}

/** กรอบความเห็นของ ทอ.02 (☐ ควรให้โอนได้ / ☐ ไม่ควรให้โอนเนื่องจาก) */
function TransferBox({ x, y, title, a, holder, checks = true }: { x: number; y: number; title: string; a?: ApprovalRecord; holder?: string; checks?: boolean }) {
  const yes = a?.decision === 'approve';
  const no = !!a && !yes;
  return (
    <div className="absolute border-[1.3px] border-black" style={{ left: `${x}mm`, top: `${y}mm`, width: '78.5mm', height: '44mm' }}>
      <div className="relative h-full">
        <Text x={3.5} y={6.5} bold wrap w={72} size={title.length > 40 ? 10.5 : undefined}>{title}</Text>
        {checks ? (
          <>
            <Row y={12} x={3.5} right={3}><span className="flex items-center gap-[1.5mm]">{tick(yes)} ควรให้โอนได้</span></Row>
            <Row y={17.6} x={3.5} right={3}><span className="flex items-center gap-[1.5mm]">{tick(no)} ไม่ควรให้โอนเนื่องจาก</span><Fill grow left>{no ? a?.comment ?? '' : ''}</Fill></Row>
            <Row y={23.4} x={3.5} right={3}><Fill grow left>{yes ? a?.comment ?? '' : ''}</Fill></Row>
          </>
        ) : (
          <>
            <Row y={12.5} x={3.5} right={3}><Fill grow left>{a ? (a.decision === 'approve' ? 'เห็นควรอนุมัติ' : 'ไม่อนุมัติ') : ''}</Fill></Row>
            <Row y={18} x={3.5} right={3}><Fill grow left>{a?.comment ?? ''}</Fill></Row>
            <Row y={23.5} x={3.5} right={3}><Fill grow left>{''}</Fill></Row>
          </>
        )}
        <Row y={31} x={3.5} right={10}><span>ลงชื่อ</span><Fill grow>{a ? `ลงนามออนไลน์ ${a.actorName}` : ''}</Fill></Row>
        <p className="absolute text-center" style={{ left: '12mm', width: '52mm', top: '32mm' }}>({holder || a?.actorName || ' '.repeat(40)})</p>
      </div>
    </div>
  );
}

/** แบบคำร้องขอเทียบโอนผลการเรียนรายวิชา/กลุ่มวิชา (ทอ.02, สแกน p02) */
export function TransferSheet({ student: s, data: d, submittedAt, requestNo, approvals, officials = {} }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const ev = (d.evidence as string[] | undefined) ?? [];
  return (
    <article className="sheet compact" aria-label="แบบคำร้องขอเทียบโอนผลการเรียน ทอ.02">
      <RequestNo requestNo={requestNo} right={45} />
      <FormNo no="ทอ. 02" />
      <Text x={0} w={210} y={27} center bold size={14.5}>{COLLEGE}</Text>
      <Text x={0} w={210} y={36} center bold>แบบคำร้องขอเทียบโอนผลการเรียนรายวิชา/กลุ่มวิชา</Text>
      <WrittenAt x={121} y={45} dateX={121} dateY={50.5} submittedAt={submittedAt} right={22} />
      <Text x={31.5} y={59}>เรื่อง ขอโอนผลการเรียน</Text>
      <Text x={31.5} y={64.5}>เรียน ผู้อำนวยการ{COLLEGE}</Text>
      <Row y={70} x={44} right={22}><span>ด้วยข้าพเจ้า (นาย/นาง/นางสาว)</span><Fill grow left>{fullNameOf(s)}</Fill><span>รหัสประจำตัว</span><Fill w={28}>{s.studentCode}</Fill></Row>

      <Text x={31.5} y={78.5} bold>ผู้ขอโอน</Text>
      <Text x={85.3} y={78.5} bold>หลักสูตร</Text>
      {([['student', 'นักเรียน'], ['collegian', 'นักศึกษา'], ['learner', 'ผู้เข้าเรียน']] as const).map(([k, label], i) => (
        <Text key={k} x={32.4} y={86.5 + i * 5.6}><span className="flex items-center gap-[1.5mm]">{tick(d.requester === k)} {label}</span></Text>
      ))}
      {([['pvc', 'ปวช.'], ['pvs', 'ปวส.'], ['cont', 'ปวส. (ต่อเนื่อง)']] as const).map(([k, label], i) => (
        <Text key={k} x={85.3} y={86.5 + i * 5.6}><span className="flex items-center gap-[1.5mm]">{tick(s.level === k)} {label} .......</span></Text>
      ))}
      <Row y={86.5} x={127} right={22}><span>ประเภทวิชา</span><Fill grow left>{str(d.subjectType)}</Fill></Row>
      <Row y={92.1} x={127} right={22}><span>กลุ่มอาชีพ</span><Fill grow left>{str(d.careerGroup)}</Fill></Row>
      <Row y={97.7} x={127} right={22}><span>สาขาวิชา</span><Fill grow left>{s.program}</Fill></Row>

      <Text x={31.5} y={106} bold>การจัดการเรียนการสอน</Text>
      <Text x={85.3} y={106} bold>หลักฐาน</Text>
      {([['normal', 'รูปแบบในระบบ (ปกติ)'], ['evening', 'รูปแบบนอกระบบ (สมทบ)'], ['dual', 'รูปแบบทวิภาคี']] as const).map(([k, label], i) => (
        <Text key={k} x={32.4} y={111.5 + i * 5.6}><span className="flex items-center gap-[1.5mm]">{tick(d.mode === k)} {label}</span></Text>
      ))}
      {([['transcript', 'ใบแสดงผลการเรียน'], ['cert', 'ใบรับรองผลการเรียนรายวิชา'], ['desc', 'คำอธิบายรายวิชา จุดประสงค์รายวิชา เนื้อหารายวิชา']] as const).map(([k, label], i) => (
        <Text key={k} x={85.3} y={111.5 + i * 5.6}><span className="flex items-center gap-[1.5mm]">{tick(ev.includes(k))} {label}</span></Text>
      ))}
      <Row y={128.3} x={85.3} right={60}><span className="flex items-center gap-[1.5mm]">{tick(ev.includes('other'))} อื่น ๆ</span><Fill grow left>{str(d.evidenceOther)}</Fill></Row>

      <Text x={43.5} y={136}>จึงเรียนมาเพื่อโปรดพิจารณา</Text>
      <Row y={144.5} x={103} right={null}><span>ลงชื่อ</span><Fill w={52}>{''}</Fill></Row>
      <Row y={150} x={109} right={null}><span>(</span><Fill w={50}>{fullNameOf(s)}</Fill><span>)</span></Row>
      <Text x={122} y={155.5}>ผู้ขอเทียบโอน</Text>

      <TransferBox x={25} y={169} title="ความเห็นครูที่ปรึกษา" a={a('advisor')} holder={s.advisorName} />
      <TransferBox x={107.2} y={169} title="ความเห็นหัวหน้างานทะเบียน" a={a('registrar')} holder={officials.registrar_head} />
      <TransferBox x={25} y={215} title="ความเห็นหัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้" a={a('curriculum')} holder={officials.curriculum_head} />
      <TransferBox x={107.2} y={215} title="ความเห็นรองผู้อำนวยการฝ่ายวิชาการ" a={a('deputy')} holder={officials.deputy_academic} checks={false} />

      <Text x={30.5} y={271} bold size={11.5}>หมายเหตุ : ผู้ขอเทียบโอน หมายถึง นักเรียน นักศึกษา ผู้เข้าเรียนที่มีความประสงค์ขอโอนผลการเรียน เทียบโอนผลการเรียน</Text>
      <Text x={46} y={277} bold size={11.5}>หรือเทียบโอนความรู้และประสบการณ์รายวิชา</Text>
    </article>
  );
}

const th = 'border border-black px-[1mm] text-center font-normal leading-tight';
const td = 'border border-black px-[1.2mm] align-middle';
const ROWS = 10;

/** แบบสรุปรายวิชาที่ขอเทียบโอนผลการเรียน (ทอ.02-2, สแกน p03 — แนวนอน) */
export function TransferListSheet({ student: s, data: d, approvals, officials = {} }: SheetProps) {
  const a = (k: string) => step(approvals, k);
  const rows = ((d.courses as CourseRow[] | undefined) ?? []).slice(0, ROWS);
  const dir = a('director');
  const [dd, mm, yy] = slashDate(dir?.decidedAt);
  const signer = (x: number, y: number, role: string, holder?: string, ap?: ApprovalRecord, w = 92) => (
    <>
      <Row y={y} x={x} right={null} style={{ width: `${w}mm` }}><span>ลงชื่อ</span><Fill grow>{ap ? `ลงนามออนไลน์ ${ap.actorName}` : ''}</Fill><span className={role.length > 30 ? 'text-[10pt]' : undefined}>{role}</span></Row>
      <p className="absolute text-center" style={{ left: `${x + 6}mm`, width: '55mm', top: `${y + 1}mm` }}>({holder || ' '.repeat(40)})</p>
    </>
  );
  return (
    <article className="sheet sheet-landscape compact" aria-label="แบบสรุปรายวิชาที่ขอเทียบโอนผลการเรียน ทอ.02-2">
      <FormNo no="ทอ. 02-2" landscape />
      <Text x={0} w={297} y={16} center bold size={14.5}>{COLLEGE}</Text>
      <Text x={0} w={297} y={23} center bold>แบบสรุปรายวิชาที่ขอเทียบโอนผลการเรียน</Text>
      <Row y={31} x={20} right={60}><span>ชื่อ (นาย/นาง/นางสาว)</span><Fill grow left>{fullNameOf(s)}</Fill><span>รหัสประจำตัว</span><Fill w={40}>{s.studentCode}</Fill></Row>
      <Text x={20} y={38} bold>ผู้ขอเทียบโอนหลักสูตร</Text>
      <Text x={90} y={38} bold>หลักสูตร</Text>
      <Text x={160} y={38} bold>การจัดการเรียนการสอน</Text>
      {([['student', 'นักเรียน'], ['collegian', 'นักศึกษา'], ['learner', 'ผู้เข้าเรียน']] as const).map(([k, label], i) => (
        <Text key={k} x={20} y={43.5 + i * 5}><span className="flex items-center gap-[1.5mm]">{tick(d.requester === k)} {label}</span></Text>
      ))}
      {([['pvc', 'ปวช. ......'], ['pvs', 'ปวส. ......'], ['cont', 'ปวส. (ต่อเนื่อง) ......']] as const).map(([k, label], i) => (
        <Text key={k} x={90} y={43.5 + i * 5}><span className="flex items-center gap-[1.5mm]">{tick(s.level === k)} {label}</span></Text>
      ))}
      {([['normal', 'รูปแบบในระบบ (ปกติ)'], ['evening', 'รูปแบบนอกระบบ (สมทบ)'], ['dual', 'รูปแบบทวิภาคี']] as const).map(([k, label], i) => (
        <Text key={k} x={160} y={43.5 + i * 5}><span className="flex items-center gap-[1.5mm]">{tick(d.mode === k)} {label}</span></Text>
      ))}

      <table className="absolute text-[11pt]" style={{ left: '14mm', top: '57mm', width: '269mm', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>{[50, 30, 85, 20, 20, 16, 16, 16, 16].map((w, i) => <col key={i} style={{ width: `${w}mm` }} />)}</colgroup>
        <thead>
          <tr>
            <th className={th} rowSpan={2}>หมวดวิชา</th>
            <th className={th} colSpan={2}>รายวิชาที่ขอเทียบโอนผลการเรียน</th>
            <th className={th} rowSpan={2}>หน่วยกิต</th>
            <th className={th} rowSpan={2}>ผลการเรียน</th>
            <th className={th} colSpan={2}>ผลการพิจารณา</th>
            <th className={th} colSpan={2}>ผลการเรียนใหม่</th>
          </tr>
          <tr><th className={th}>รหัสวิชา</th><th className={th}>ชื่อวิชา</th><th className={th}>ผ่าน</th><th className={th}>ไม่ผ่าน</th><th className={th}>ผ่าน</th><th className={th}>ไม่ผ่าน</th></tr>
        </thead>
        <tbody className="text-[#0b2a8a] print:text-black">
          {Array.from({ length: ROWS }, (_, i) => rows[i]).map((r, i) => (
            <tr key={i} style={{ height: '6.4mm' }}>
              <td className={`${td} truncate text-[10pt]`}>{r?.category}</td>
              <td className={`${td} text-center`}>{r?.code}</td>
              <td className={`${td} truncate`}>{r?.name}</td>
              <td className={`${td} text-center`}>{r?.credits ?? ''}</td>
              <td className={`${td} text-center`}>{r?.grade}</td>
              <td className={td} /><td className={td} /><td className={td} /><td className={td} />
            </tr>
          ))}
        </tbody>
      </table>

      <Row y={150} x={200} right={null}><span>ลงชื่อ</span><Fill w={52}>{''}</Fill><span>ผู้ขอเทียบโอน</span></Row>
      <p className="absolute text-center" style={{ left: '206mm', width: '55mm', top: '151mm' }}>({fullNameOf(s)})</p>
      {signer(14, 166, 'หัวหน้าแผนกวิชา')}
      {signer(118, 166, 'หัวหน้างานวัดผลและประเมินผล', undefined, undefined, 82)}
      {signer(14, 182, 'หัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้', officials.curriculum_head, a('curriculum'), 100)}
      {signer(118, 182, 'รองผู้อำนวยการฝ่ายวิชาการ', officials.deputy_academic, a('deputy'), 82)}
      <Text x={205} y={163} bold>อนุมัติ</Text>
      <Row y={170} x={205} right={14}><span>ลงชื่อ</span><Fill grow>{dir ? `ลงนามออนไลน์ ${dir.actorName}` : ''}</Fill></Row>
      <p className="absolute text-center" style={{ left: '205mm', width: '78mm', top: '171mm' }}>({officials.director})</p>
      <p className="absolute text-center text-[11pt]" style={{ left: '200mm', width: '88mm', top: '177mm' }}>ผู้อำนวยการ{COLLEGE}</p>
      <Row y={189} x={225} right={null} style={{ gap: 0 }}><Fill w={10}>{dd}</Fill><span>/</span><Fill w={10}>{mm}</Fill><span>/</span><Fill w={13}>{yy}</Fill></Row>
      <Text x={14} y={197} bold size={10.5}>หมายเหตุ : การอนุมัติผล เสนอคณะกรรมการบริหารสถานศึกษา และเสนอหัวหน้าสถานศึกษาเพื่ออนุมัติ ผลการโอนผลการเรียน</Text>
      <Text x={26} y={202.5} size={10.5}>: ผู้ขอเทียบโอน หมายถึง นักเรียน นักศึกษา ผู้เข้าเรียนที่มีความประสงค์ขอโอนผลการเรียน เทียบโอนผลการเรียน หรือเทียบโอนความรู้และประสบการณ์รายวิชา</Text>
    </article>
  );
}
