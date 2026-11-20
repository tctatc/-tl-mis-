import type { PositionKey } from './model.js';

/**
 * แค็ตตาล็อกประเภทคำร้อง
 *
 * template = แบบฟอร์มกระดาษที่ใช้พิมพ์ ประเภทที่ไม่มีฟอร์มเฉพาะของวิทยาลัยใช้ "แบบคำร้องทั่วไป"
 * workflow = ลำดับผู้ลงความเห็น ตามช่องความเห็นที่พิมพ์ไว้ในฟอร์มนั้น (ขั้นสุดท้ายคือคำสั่งผู้อำนวยการ)
 */

export type CategoryCode = 'A' | 'B' | 'C' | 'D';
export const CATEGORIES: Record<CategoryCode, { name: string; hint: string }> = {
  A: { name: 'งานทะเบียน', hint: 'เอกสารรับรอง สถานภาพ ลาออก ลาพัก' },
  B: { name: 'การลงทะเบียน', hint: 'เปลี่ยนแปลงรายวิชา เทียบโอน คำอธิบายรายวิชา' },
  C: { name: 'วัดผลและประเมินผล', hint: 'ตรวจสอบหรือแก้ไขผลการเรียน' },
  D: { name: 'ทั่วไป', hint: 'เรื่องอื่น ๆ ผ่อนผันค่าหน่วยกิต' },
};

export type TemplateKey = 'general' | 'resign' | 'leave' | 'return' | 'graduate' | 'transcript2' | 'conduct' | 'course_change' | 'course_desc' | 'defer_fee' | 'transfer';

/** ข้อที่ติ๊กในแบบคำร้องทั่วไป ("มีความประสงค์จะขอ") */
export type GeneralWant = 'student_cert' | 'transcript' | 'other';

export type Assignee = { kind: 'position'; position: PositionKey } | { kind: 'advisor' } | { kind: 'programHead' };

export interface WorkflowStep {
  key: string;
  /** หัวช่องความเห็นตามที่พิมพ์ในฟอร์ม */
  title: string;
  assignee: Assignee;
}

export interface RequestTypeDef {
  code: string;
  category: CategoryCode;
  name: string;
  /** คำอธิบายสั้นบนปุ่ม */
  hint: string;
  template: TemplateKey;
  /** ใช้งานได้แล้วหรือยัง (ฟอร์มเฉพาะที่ยังไม่ได้ทำจะขึ้นว่า "กำลังจัดทำ") */
  ready: boolean;
  /** ค่าเริ่มต้นของแบบคำร้องทั่วไป: ติ๊กข้อไหนไว้ให้ และเรื่องที่ขอ */
  preset?: { want: GeneralWant; other?: string };
  /** เอกสารที่ต้องนำมาด้วย แสดงก่อนกดยื่น */
  bring?: string;
  /** มาจากแบบฟอร์มของวิทยาลัย (ไม่มีใน spec เดิม) */
  collegeOnly?: boolean;
  /**
   * ซ่อนจากหน้ายื่นคำร้อง (ยื่นใหม่ไม่ได้) แต่ยังเปิดดูคำร้องเก่าได้
   * ใช้กับเรื่องที่วิทยาลัยไม่มีแบบฟอร์มกระดาษ (ตามแบบฟอร์มที่ส่งมา 17 พ.ย. 2569)
   */
  hidden?: boolean;
  /** ศิษย์เก่า (จบแล้ว) ยื่นได้ */
  allowAlumni?: boolean;
  /** เหตุผลที่ใช้บ่อยของเรื่องนี้ กดแล้วเติมช่อง "สาเหตุที่ขอเพื่อ" ให้ */
  purposes: readonly string[];
}

/** เหตุผลสำเร็จรูปแยกตามเรื่อง (ไม่มีในรายการ = ใช้ DEFAULT_PURPOSES) */
const PURPOSES: Record<string, readonly string[]> = {
  A01: ['ยื่นขอทุนการศึกษา', 'ยื่นกู้ยืมเงิน กยศ.', 'ยื่นขอสวัสดิการผู้ปกครอง', 'ยื่นผ่อนผันการตรวจเลือกทหาร', 'ใช้เป็นหลักฐานทางราชการ'],
  A02: ['สมัครเรียนต่อ', 'สมัครงาน', 'ยื่นขอทุนการศึกษา', 'ยื่นกู้ยืมเงิน กยศ.', 'ใช้ประกอบการเทียบโอนผลการเรียน'],
  A03: ['ชื่อ-นามสกุลสะกดไม่ถูกต้อง', 'วันเดือนปีเกิดไม่ถูกต้อง', 'เลขประจำตัวประชาชนไม่ถูกต้อง', 'ย้ายที่อยู่ใหม่', 'เปลี่ยนข้อมูลผู้ปกครอง'],
  A04: ['เปลี่ยนชื่อตามทะเบียนราษฎร', 'เปลี่ยนนามสกุลตามทะเบียนราษฎร', 'เปลี่ยนทั้งชื่อและนามสกุล'],
  A06: ['ย้ายไปศึกษาต่อที่อื่น', 'ต้องการประกอบอาชีพ', 'ปัญหาค่าใช้จ่ายของครอบครัว', 'ปัญหาสุขภาพ'],
  A07: ['ปัญหาสุขภาพ ต้องรักษาตัว', 'ปัญหาค่าใช้จ่ายของครอบครัว', 'ต้องช่วยงานครอบครัว'],
  A11: ['สมัครงาน', 'สมัครเรียนต่อ', 'ยื่นขอทุนการศึกษา', 'ใช้เป็นหลักฐานทางราชการ'],
  A10: ['สมัครงาน', 'สมัครเรียนต่อ', 'ใช้เป็นหลักฐานทางราชการ'],
  B06: ['ใช้ประกอบการเทียบโอนผลการเรียน', 'สมัครเรียนต่อ'],
  D05: ['ครอบครัวมีรายได้ไม่พอในช่วงนี้', 'ผู้ปกครองรอรับเงินเดือน', 'ผู้ปกครองประสบปัญหาทางการเงิน'],
  A05: ['ย้ายตามผู้ปกครอง', 'ย้ายที่อยู่ เดินทางไม่สะดวก', 'ต้องการเรียนสาขาที่วิทยาลัยไม่ได้เปิดสอน'],
  B01: ['เจ็บป่วยในช่วงลงทะเบียน', 'ชำระเงินไม่ทันกำหนด', 'ติดธุระจำเป็นของครอบครัว', 'ระบบลงทะเบียนมีปัญหา'],
  B04: ['เวลาเรียนชนกับวิชาอื่น', 'ต้องการเรียนพร้อมกลุ่มเดิม', 'ติดฝึกงานหรือทำงานในช่วงเวลานั้น'],
  C01: ['เกรดในระบบไม่ตรงกับที่ครูแจ้ง', 'ไม่พบผลการเรียนบางรายวิชา', 'คะแนนเก็บบันทึกไม่ครบ'],
  C02: ['ขอแก้ผลการเรียน 0', 'ขอแก้ผลการเรียน ร', 'ขอแก้ผลการเรียน มส', 'ส่งงานที่ค้างครบแล้ว'],
  C03: ['เจ็บป่วยในวันสอบ', 'ติดภารกิจเป็นตัวแทนวิทยาลัย', 'ญาติสายตรงเสียชีวิต', 'ประสบเหตุสุดวิสัย'],
  C04: ['ผลประเมินไม่ตรงกับคะแนนจริง', 'คะแนนภาคปฏิบัติไม่ถูกบันทึก', 'คะแนนจิตพิสัยไม่ถูกต้อง'],
  C05: ['ขอดูคะแนนสอบปลายภาค', 'คะแนนรวมไม่ตรงกับที่คำนวณ', 'ขอให้ตรวจข้อสอบใหม่'],
  D01: ['ขอแก้ไขข้อมูลส่วนตัว', 'ขอเปลี่ยนชื่อ-นามสกุล', 'ใช้เป็นหลักฐานทางราชการ', 'สมัครงาน'],
  D02: ['เข้าสู่ระบบไม่ได้', 'ข้อมูลในระบบไม่แสดง', 'พิมพ์แบบฟอร์มไม่ได้'],
  D03: ['สอบถามเรื่องการลงทะเบียน', 'สอบถามเรื่องเอกสาร', 'ขอนัดพบเจ้าหน้าที่ทะเบียน'],
  D04: ['เสนอแนะการใช้งานระบบออนไลน์', 'เสนอแนะการให้บริการของงานทะเบียน'],
};
export const DEFAULT_PURPOSES: readonly string[] = ['ใช้เป็นหลักฐานทางราชการ', 'สมัครงาน', 'สมัครเรียนต่อ'];

const pos = (position: PositionKey): Assignee => ({ kind: 'position', position });

export const WORKFLOWS: Record<TemplateKey, WorkflowStep[]> = {
  general: [
    { key: 'registrar', title: 'ความเห็นงานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นของรองผู้อำนวยการฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง', assignee: pos('director') },
  ],
  resign: [
    { key: 'advisor', title: 'ความเห็นของครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'programHead', title: 'ความเห็นของหัวหน้าสาขาวิชา', assignee: { kind: 'programHead' } },
    { key: 'library', title: 'ความเห็นหัวหน้างานห้องสมุด', assignee: pos('library_head') },
    { key: 'finance', title: 'ความเห็นหน้างานการเงิน', assignee: pos('finance_head') },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  leave: [
    { key: 'advisor', title: 'ความเห็นของครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'finance', title: 'หัวหน้างานการเงิน', assignee: pos('finance_head') },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  return: [
    { key: 'advisor', title: 'ความเห็นของครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'programHead', title: 'ความเห็นของหัวหน้าสาขาวิชา', assignee: { kind: 'programHead' } },
    { key: 'finance', title: 'หัวหน้างานการเงิน', assignee: pos('finance_head') },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  graduate: [
    { key: 'advisor', title: 'ความเห็นครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'programHead', title: 'ความเห็นหัวหน้าสาขาวิชา', assignee: { kind: 'programHead' } },
    { key: 'library', title: 'ความเห็นหัวหน้าห้องสมุด', assignee: pos('library_head') },
    { key: 'finance', title: 'ความเห็นหัวหน้าการเงิน', assignee: pos('finance_head') },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  transcript2: [
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'finance', title: 'หัวหน้างานการเงิน', assignee: pos('finance_head') },
    { key: 'deputy', title: 'ความเห็นของรอง ฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  conduct: [
    { key: 'advisor', title: 'ความเห็นของครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'discipline', title: 'ความเห็นของฝ่ายปกครอง', assignee: pos('discipline_head') },
    { key: 'registrar', title: 'ความเห็นฝ่ายหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการ ฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  course_change: [
    { key: 'advisor', title: 'ความเห็นครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'curriculum', title: 'ความเห็นหัวหน้างานหลักสูตร', assignee: pos('curriculum_head') },
    { key: 'finance', title: 'ความเห็นหัวหน้างานการเงิน', assignee: pos('finance_head') },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการฝ่ายวิชาการ', assignee: pos('deputy_academic') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  course_desc: [
    { key: 'curriculum', title: 'ความเห็นงานพัฒนาหลักสูตรและการจัดการเรียนรู้', assignee: pos('curriculum_head') },
    { key: 'deputy', title: 'ความเห็นของรองผู้อำนวยการฝ่ายวิชาการ', assignee: pos('deputy_academic') },
    { key: 'director', title: 'คำสั่ง ผู้อำนวยการ', assignee: pos('director') },
  ],
  defer_fee: [
    { key: 'advisor', title: 'ความเห็นของครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการฝ่ายบริหารทรัพยากร', assignee: pos('deputy_resources') },
    { key: 'director', title: 'คำสั่งอนุมัติ', assignee: pos('director') },
    { key: 'finance', title: 'หัวหน้างานการเงิน (รับเงินงวดแรก)', assignee: pos('finance_head') },
  ],
  transfer: [
    { key: 'advisor', title: 'ความเห็นครูที่ปรึกษา', assignee: { kind: 'advisor' } },
    { key: 'registrar', title: 'ความเห็นหัวหน้างานทะเบียน', assignee: pos('registrar_head') },
    { key: 'curriculum', title: 'ความเห็นหัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้', assignee: pos('curriculum_head') },
    { key: 'deputy', title: 'ความเห็นรองผู้อำนวยการฝ่ายวิชาการ', assignee: pos('deputy_academic') },
    { key: 'director', title: 'อนุมัติ ผู้อำนวยการ', assignee: pos('director') },
  ],
};

const general = (code: string, category: CategoryCode, name: string, hint: string, want: GeneralWant, extra: Partial<RequestTypeDef> = {}): RequestTypeDef => ({
  code, category, name, hint, template: 'general', ready: true,
  preset: want === 'other' ? { want, other: name } : { want },
  purposes: PURPOSES[code] ?? DEFAULT_PURPOSES,
  ...extra,
});

const special = (code: string, category: CategoryCode, name: string, hint: string, template: TemplateKey, extra: Partial<RequestTypeDef> = {}): RequestTypeDef => ({
  code, category, name, hint, template, ready: true, purposes: PURPOSES[code] ?? DEFAULT_PURPOSES, ...extra,
});

const PHOTO_NOTE = 'บัตรประจำตัวนักศึกษา และรูปถ่าย 1 นิ้ว ตามจำนวนที่ขอ';

export const REQUEST_TYPES: readonly RequestTypeDef[] = [
  general('A01', 'A', 'ใบรับรองการเป็นนักศึกษา', 'ใช้ยื่นทุน ยื่นงาน ยื่นหน่วยงาน', 'student_cert', { bring: PHOTO_NOTE }),
  general('A02', 'A', 'ใบแสดงผลการเรียน', 'ระเบียนแสดงผลการเรียน (รบ.)', 'transcript', { bring: PHOTO_NOTE }),
  general('A03', 'A', 'ขอแก้ไขข้อมูลส่วนตัว', 'ข้อมูลในทะเบียนไม่ถูกต้อง', 'other', { hidden: true, bring: 'สำเนาเอกสารที่ใช้ยืนยันข้อมูลที่ถูกต้อง' }),
  general('A04', 'A', 'ขอเปลี่ยนชื่อ–นามสกุล', 'หลังเปลี่ยนชื่อที่อำเภอแล้ว', 'other', { hidden: true, bring: 'สำเนาใบเปลี่ยนชื่อ–สกุล และสำเนาบัตรประชาชน' }),
  general('A05', 'A', 'ขอย้ายสถานศึกษา', 'ย้ายไปเรียนที่อื่น', 'other', { hidden: true }),
  special('A06', 'A', 'ขอลาออก', 'ลาออกจากสถานศึกษา', 'resign'),
  special('A07', 'A', 'ขอลาพักการเรียน', 'ลาพักและรักษาสภาพ', 'leave'),
  special('A08', 'A', 'ขอกลับเข้าเรียน', 'หลังลาพักหรือรักษาสภาพ', 'return'),
  special('A09', 'A', 'ขอจบการศึกษา', 'เรียนครบตามหลักสูตรแล้ว', 'graduate', { collegeOnly: true, bring: 'รูปถ่าย 1 นิ้ว 8 รูป (เขียนชื่อ-นามสกุลและรหัสประจำตัวหลังรูป)' }),
  special('A10', 'A', 'ขอ Transcript ชุดที่ 2', 'สำหรับศิษย์เก่า', 'transcript2', { collegeOnly: true, allowAlumni: true, bring: 'รูปถ่าย 1 นิ้ว 2 รูป (เขียนชื่อหลังรูป)' }),
  special('A11', 'A', 'ขอใบรับรองความประพฤติ', 'ใช้สมัครงาน สมัครเรียนต่อ', 'conduct', { collegeOnly: true }),

  general('B01', 'B', 'ขอลงทะเบียนล่าช้า', 'เลยกำหนดลงทะเบียน', 'other', { hidden: true }),
  special('B02', 'B', 'ขอเปลี่ยนแปลงรายวิชาเรียน', 'เรียนซ้ำ รีเกรด เพิ่ม ถอน', 'course_change'),
  special('B03', 'B', 'ขอถอนรายวิชา', 'ถอนรายวิชาที่ลงไว้', 'course_change', { hidden: true }),
  general('B04', 'B', 'ขอเปลี่ยนกลุ่มเรียน', 'ย้ายกลุ่มในรายวิชาเดิม', 'other', { hidden: true }),
  special('B05', 'B', 'ขอเทียบโอนผลการเรียน', 'แบบ ทอ.02 + ทอ.02-2', 'transfer', { bring: 'ใบแสดงผลการเรียนจากสถานศึกษาเดิม และคำอธิบายรายวิชา' }),
  special('B06', 'B', 'ขอคำอธิบายรายวิชา', 'ใช้ประกอบการเทียบโอน', 'course_desc', { collegeOnly: true, bring: 'ใบระเบียนแสดงผลการเรียน (รบ.) และสำเนาใบเปลี่ยนชื่อ-สกุล (ถ้ามี)' }),

  general('C01', 'C', 'ขอให้ตรวจสอบผลการเรียน', 'สงสัยว่าเกรดไม่ถูกต้อง', 'other', { hidden: true }),
  general('C02', 'C', 'ขอแก้ไขผลการเรียน', 'แก้ 0 ร มส.', 'other', { hidden: true }),
  general('C03', 'C', 'ขอสอบกรณีพิเศษ', 'ขาดสอบด้วยเหตุจำเป็น', 'other', { hidden: true }),
  general('C04', 'C', 'ขอแก้ไขผลการประเมิน', 'ผลการประเมินไม่ถูกต้อง', 'other', { hidden: true }),
  general('C05', 'C', 'ขอทบทวนผลการเรียน', 'ขอให้พิจารณาผลใหม่', 'other', { hidden: true }),

  general('D01', 'D', 'แบบคำร้องทั่วไป (เรื่องอื่น ๆ)', 'เรื่องที่ไม่มีแบบฟอร์มเฉพาะ', 'other'),
  general('D02', 'D', 'แจ้งปัญหาการใช้งาน', 'ระบบมีปัญหา เข้าใช้งานไม่ได้', 'other', { hidden: true }),
  general('D03', 'D', 'ติดต่อเจ้าหน้าที่ทะเบียน', 'สอบถามหรือนัดหมาย', 'other', { hidden: true }),
  general('D04', 'D', 'ส่งข้อเสนอแนะ', 'ความคิดเห็นถึงวิทยาลัย', 'other', { hidden: true }),
  special('D05', 'D', 'ขอผ่อนผันค่าหน่วยกิต', 'ผู้ปกครองเป็นผู้ยื่น', 'defer_fee', { collegeOnly: true }),
];

const byCode = new Map(REQUEST_TYPES.map((t) => [t.code, t]));

export function getRequestType(code: string): RequestTypeDef | undefined {
  return byCode.get(code);
}

/** เรื่องที่แสดงในหน้ายื่นคำร้อง */
export const VISIBLE_REQUEST_TYPES = REQUEST_TYPES.filter((t) => !t.hidden);

export function workflowOf(code: string): WorkflowStep[] {
  const type = byCode.get(code);
  return type ? WORKFLOWS[type.template] : [];
}
