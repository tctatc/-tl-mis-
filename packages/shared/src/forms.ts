/**
 * เครื่องสร้างฟอร์มจากข้อมูล: แต่ละแบบฟอร์มประกาศรายการช่องครั้งเดียว
 * → หน้าเว็บสร้างช่องกรอกเอง, ตรวจข้อมูลด้วยกติกาเดียวกันทั้งหน้าเว็บและ API, เติมค่าเริ่มต้นจากทะเบียน
 * (แบบคำร้องทั่วไปใช้ zod ของตัวเองใน general.ts)
 */
import type { RequestTypeDef, TemplateKey } from './catalog.js';
import type { StudentSnapshot } from './model.js';
import { LEVEL_LABEL } from './model.js';

export type FormData = Record<string, unknown>;
type Show = (d: FormData) => boolean;
interface Base { key: string; label: string; hint?: string; required?: boolean; showIf?: Show }
export interface Option { value: string; label: string }

export type CourseExtra = 'amount' | 'dayTime' | 'teacher' | 'category' | 'grade';
export interface CourseRow {
  code: string; name: string; periods: number | null; credits: number | null;
  amount: string; dayTime: string; teacher: string; category: string; grade: string;
}

export type FieldDef =
  | (Base & { kind: 'text'; max: number; placeholder?: string; inputMode?: 'tel' | 'text'; chips?: readonly string[] | 'purposes' })
  | (Base & { kind: 'textarea'; max: number; chips?: readonly string[] | 'purposes' })
  | (Base & { kind: 'choice'; options: Option[] })
  | (Base & { kind: 'multi'; options: Option[]; min?: number })
  | (Base & { kind: 'number'; min: number; max: number; suffix?: string })
  | (Base & { kind: 'date' })
  | (Base & { kind: 'courses'; maxRows: number; minRows: number; extra: CourseExtra[] })
  | { kind: 'heading'; key: string; label: string; hint?: string; showIf?: Show; required?: undefined };

export interface FormContext {
  student: StudentSnapshot;
  current: { year: number; term: number };
  /** คาบ/สัปดาห์ที่ลงทะเบียนในภาคปัจจุบัน */
  registeredPeriods?: number;
}

const TERM_OPTIONS: Option[] = [{ value: '1', label: 'ภาคเรียนที่ 1' }, { value: '2', label: 'ภาคเรียนที่ 2' }, { value: '3', label: 'ภาคฤดูร้อน' }];
const has = (key: string, value: string): Show => (d) => Array.isArray(d[key]) && (d[key] as unknown[]).includes(value);
const is = (key: string, value: string): Show => (d) => d[key] === value;

export const FORM_FIELDS: Partial<Record<TemplateKey, FieldDef[]>> = {
  resign: [
    { kind: 'textarea', key: 'reason', label: 'เหตุผลที่ขอลาออก (ระบุรายละเอียด)', max: 160, required: true, chips: 'purposes' },
    { kind: 'text', key: 'guardianName', label: 'ชื่อผู้ปกครอง (ลงชื่อร่วมในแบบฟอร์ม)', max: 60, required: true },
    { kind: 'text', key: 'phone', label: 'เบอร์โทรศัพท์ที่ติดต่อได้', max: 20, required: true, inputMode: 'tel' },
  ],
  leave: [
    { kind: 'choice', key: 'term', label: 'ขอลาพักในภาคเรียน', options: TERM_OPTIONS, required: true },
    { kind: 'number', key: 'year', label: 'ปีการศึกษา', min: 2560, max: 2600, required: true },
    { kind: 'textarea', key: 'reason', label: 'เนื่องจาก (ระบุเหตุผล)', max: 150, required: true, chips: 'purposes' },
    { kind: 'heading', key: 'h1', label: 'จะกลับมาเรียน', hint: 'ต้องมาแจ้งความจำนงขอกลับเข้าเรียนก่อนลงทะเบียนทุกครั้ง' },
    { kind: 'choice', key: 'returnTerm', label: 'ภาคเรียนที่จะกลับมา', options: TERM_OPTIONS, required: true },
    { kind: 'number', key: 'returnYear', label: 'ปีการศึกษาที่จะกลับมา', min: 2560, max: 2600, required: true },
  ],
  return: [
    { kind: 'choice', key: 'cause', label: 'เนื่องจากสาเหตุ', required: true, options: [{ value: 'retain', label: 'รักษาสภาพ' }, { value: 'leave', label: 'ลาพักการเรียน' }, { value: 'other', label: 'อื่น ๆ' }] },
    { kind: 'text', key: 'causeOther', label: 'ระบุสาเหตุ', max: 40, required: true, showIf: is('cause', 'other') },
    { kind: 'choice', key: 'causeTerm', label: 'เมื่อภาคเรียนที่', options: TERM_OPTIONS, required: true },
    { kind: 'number', key: 'causeYear', label: 'ปีการศึกษา', min: 2550, max: 2600, required: true },
    { kind: 'heading', key: 'h1', label: 'ขอกลับเข้าเรียน' },
    { kind: 'choice', key: 'returnTerm', label: 'ในภาคเรียนที่', options: TERM_OPTIONS, required: true },
    { kind: 'number', key: 'returnYear', label: 'ปีการศึกษา', min: 2560, max: 2600, required: true },
    { kind: 'text', key: 'withLevel', label: 'ซึ่งจะต้องเรียนกับ ระดับชั้น/แผนก', max: 60, required: true },
    { kind: 'number', key: 'termsLeft', label: 'ต้องเรียนอีก (ภาคเรียน) จึงจะจบหลักสูตร', min: 1, max: 10, required: true, suffix: 'ภาคเรียน' },
  ],
  graduate: [
    { kind: 'number', key: 'year', label: 'ขอจบการศึกษาในปีการศึกษา', min: 2560, max: 2600, required: true },
    { kind: 'choice', key: 'registeredAll', label: 'ได้ลงทะเบียนเรียน', required: true, options: [{ value: 'yes', label: 'ครบ' }, { value: 'no', label: 'ไม่ครบ' }],
      hint: 'กรณีลงทะเบียนไม่ครบ กรุณาติดต่องานทะเบียนโดยทันที (หากไม่ติดต่อจะอนุมัติจบการศึกษาไม่ได้)' },
    { kind: 'text', key: 'phone', label: 'เบอร์โทรศัพท์', max: 20, required: true, inputMode: 'tel' },
  ],
  transcript2: [
    { kind: 'text', key: 'nameEn', label: 'ชื่อ-สกุล ภาษาอังกฤษ', max: 60, required: true, placeholder: 'Mr. Somchai Rabobdee' },
    { kind: 'text', key: 'birthProvince', label: 'จังหวัดที่เกิด', max: 30, required: true },
    { kind: 'number', key: 'entryYear', label: 'เริ่มเข้าเรียนเมื่อปีการศึกษา', min: 2540, max: 2600, required: true },
    { kind: 'text', key: 'graduatedWhen', label: 'สำเร็จการศึกษาเมื่อ', max: 40, required: true, placeholder: 'ปีการศึกษา 2568' },
    { kind: 'text', key: 'purpose', label: 'มีความประสงค์ขอหลักฐานราชการข้างต้น เพื่อนำไป', max: 60, required: true, chips: 'purposes' },
    { kind: 'text', key: 'reason', label: 'เนื่องจาก สำเนา รบ. ชุดที่ 1', max: 50, required: true, chips: ['สูญหาย', 'ชำรุด', 'ส่งให้หน่วยงานไปแล้ว'] },
  ],
  conduct: [
    { kind: 'text', key: 'track', label: 'สาขางาน', max: 40 },
    { kind: 'text', key: 'prevSchool', label: 'สถานศึกษาเดิม', max: 60, required: true },
    { kind: 'text', key: 'prevProvince', label: 'จังหวัด', max: 30, required: true },
    { kind: 'text', key: 'prevLevel', label: 'ชั้นเรียนสุดท้าย', max: 30, required: true },
    { kind: 'textarea', key: 'purpose', label: 'ขอหลักฐานเพื่อใช้ (ระบุวัตถุประสงค์ให้ชัดเจน)', max: 140, required: true, chips: 'purposes' },
  ],
  course_change: [
    { kind: 'choice', key: 'studentKind', label: 'สถานะ', required: true, options: [{ value: 'regular', label: 'นักศึกษาปกติ' }, { value: 'backlog', label: 'นักเรียนตกค้าง' }] },
    { kind: 'number', key: 'backlogYear', label: 'ปีการศึกษา (นักเรียนตกค้าง)', min: 2550, max: 2600, required: true, showIf: is('studentKind', 'backlog') },
    { kind: 'multi', key: 'actions', label: 'มีความประสงค์ขอลงทะเบียน', min: 1, required: true, options: [
      { value: 'repeat0', label: 'เรียนซ้ำรายวิชาที่ติด 0 (ศูนย์)' }, { value: 'regrade', label: 'เรียนซ้ำเพื่อปรับระดับคะแนน (รีเกรด)' },
      { value: 'replace0', label: 'เรียนแทนรายวิชาที่ติด 0 (ศูนย์)' }, { value: 'add', label: 'เพิ่มรายวิชาเพื่อให้ครบหลักสูตร' },
      { value: 'withdraw', label: 'ถอนรายวิชา' }, { value: 'audit', label: 'เรียนโดยไม่คิดหน่วยกิต' },
    ] },
    { kind: 'text', key: 'withdrawReason', label: 'ถอนรายวิชา เนื่องจาก', max: 40, required: true, showIf: has('actions', 'withdraw') },
    { kind: 'courses', key: 'courses', label: 'รายวิชา', minRows: 1, maxRows: 5, extra: ['amount', 'dayTime', 'teacher'], required: true },
    { kind: 'number', key: 'regularPeriods', label: 'ในภาคเรียนนี้ลงทะเบียนเรียนปกติ', min: 0, max: 60, required: true, suffix: 'คาบ/สัปดาห์', hint: 'ระบบนับจากบัตรลงทะเบียนให้แล้ว' },
  ],
  course_desc: [
    { kind: 'text', key: 'phone', label: 'เบอร์โทรศัพท์', max: 20, required: true, inputMode: 'tel' },
    { kind: 'text', key: 'purpose', label: 'ขอคำอธิบายรายวิชา เพื่อ', max: 60, required: true, chips: 'purposes' },
    { kind: 'courses', key: 'courses', label: 'รายวิชาที่ขอ', minRows: 1, maxRows: 5, extra: [], required: true },
  ],
  defer_fee: [
    { kind: 'heading', key: 'h0', label: 'ผู้ปกครองเป็นผู้ยื่น', hint: 'กรอกในนามผู้ปกครอง ผู้ปกครองต้องลงชื่อในแบบฟอร์มที่พิมพ์' },
    { kind: 'text', key: 'guardianName', label: 'ชื่อผู้ปกครอง', max: 60, required: true },
    { kind: 'text', key: 'guardianPhone', label: 'เบอร์โทรศัพท์ผู้ปกครอง', max: 20, required: true, inputMode: 'tel' },
    { kind: 'text', key: 'relation', label: 'เกี่ยวข้องเป็น', max: 20, required: true, chips: ['บิดา', 'มารดา', 'ผู้ปกครอง'] },
    { kind: 'choice', key: 'term', label: 'ขอผ่อนผันการชำระเงินภาคเรียนที่', options: TERM_OPTIONS, required: true },
    { kind: 'number', key: 'year', label: 'ปีการศึกษา', min: 2560, max: 2600, required: true },
    { kind: 'heading', key: 'h1', label: 'ชำระงวดแรก' },
    { kind: 'number', key: 'creditUnits', label: 'ค่าหน่วยกิต (หน่วยกิต)', min: 0, max: 60, required: true },
    { kind: 'number', key: 'creditAmount', label: 'เป็นเงิน (บาท)', min: 0, max: 100000, required: true },
    { kind: 'number', key: 'materialUnits', label: 'ค่าวัสดุฝึกงาน (หน่วยกิต)', min: 0, max: 60 },
    { kind: 'number', key: 'materialAmount', label: 'เป็นเงิน (บาท)', min: 0, max: 100000 },
    { kind: 'heading', key: 'h2', label: 'ค้างชำระ งวดที่ 2' },
    { kind: 'number', key: 'oweCreditUnits', label: 'ค่าหน่วยกิต (หน่วยกิต)', min: 0, max: 60, required: true },
    { kind: 'number', key: 'oweCreditAmount', label: 'เป็นเงิน (บาท)', min: 0, max: 100000, required: true },
    { kind: 'number', key: 'oweMaterialUnits', label: 'ค่าวัสดุฝึกงาน (หน่วยกิต)', min: 0, max: 60 },
    { kind: 'number', key: 'oweMaterialAmount', label: 'เป็นเงิน (บาท)', min: 0, max: 100000 },
    { kind: 'date', key: 'payDate', label: 'จะนำเงินงวดที่ 2 มาชำระภายในวันที่', required: true },
    { kind: 'text', key: 'reason', label: 'เหตุผลในการขอผ่อนผัน', max: 80, required: true, chips: 'purposes' },
  ],
  transfer: [
    { kind: 'choice', key: 'requester', label: 'ผู้ขอโอน', required: true, options: [{ value: 'student', label: 'นักเรียน' }, { value: 'collegian', label: 'นักศึกษา' }, { value: 'learner', label: 'ผู้เข้าเรียน' }] },
    { kind: 'text', key: 'subjectType', label: 'ประเภทวิชา', max: 40, required: true, placeholder: 'อุตสาหกรรม' },
    { kind: 'text', key: 'careerGroup', label: 'กลุ่มอาชีพ', max: 40, placeholder: 'ไม่มีให้เว้นว่าง' },
    { kind: 'choice', key: 'mode', label: 'การจัดการเรียนการสอน', required: true, options: [{ value: 'normal', label: 'รูปแบบในระบบ (ปกติ)' }, { value: 'evening', label: 'รูปแบบนอกระบบ (สมทบ)' }, { value: 'dual', label: 'รูปแบบทวิภาคี' }] },
    { kind: 'multi', key: 'evidence', label: 'หลักฐาน', min: 1, required: true, options: [
      { value: 'transcript', label: 'ใบแสดงผลการเรียน' }, { value: 'cert', label: 'ใบรับรองผลการเรียนรายวิชา' },
      { value: 'desc', label: 'คำอธิบายรายวิชา จุดประสงค์รายวิชา เนื้อหารายวิชา' }, { value: 'other', label: 'อื่น ๆ' },
    ] },
    { kind: 'text', key: 'evidenceOther', label: 'หลักฐานอื่น ๆ', max: 50, required: true, showIf: has('evidence', 'other') },
    { kind: 'courses', key: 'courses', label: 'รายวิชาที่ขอเทียบโอน (แบบ ทอ.02-2)', minRows: 1, maxRows: 10, extra: ['category', 'grade'], required: true },
  ],
};

export const COURSE_GRADES = ['4', '3.5', '3', '2.5', '2', '1.5', '1', 'ผ'] as const;
export const emptyCourse = (): CourseRow => ({ code: '', name: '', periods: null, credits: null, amount: '', dayTime: '', teacher: '', category: '', grade: '' });

const nextTerm = (c: FormContext['current']) => (c.term >= 2 ? { term: 1, year: c.year + 1 } : { term: 2, year: c.year });

/** ค่าเริ่มต้นของฟอร์ม — ทุกอย่างที่รู้จากทะเบียนเติมให้แล้ว นักศึกษากรอกเฉพาะที่ระบบไม่รู้ */
export function formDefaults(type: RequestTypeDef, ctx: FormContext): FormData {
  const s = ctx.student;
  const cur = ctx.current;
  const nt = nextTerm(cur);
  switch (type.template) {
    case 'resign': return { reason: '', guardianName: s.guardianName ?? '', phone: s.phone };
    case 'leave': return { term: String(cur.term), year: cur.year, reason: '', returnTerm: String(nt.term), returnYear: nt.year };
    case 'return': return { cause: 'leave', causeOther: '', causeTerm: String(cur.term === 1 ? 2 : 1), causeYear: cur.term === 1 ? cur.year - 1 : cur.year, returnTerm: String(cur.term), returnYear: cur.year, withLevel: `${LEVEL_LABEL[s.level]} ${s.yearLevel} ${s.department}`, termsLeft: 2 };
    case 'graduate': return { year: cur.year, registeredAll: 'yes', phone: s.phone };
    case 'transcript2': return { nameEn: '', birthProvince: s.homeProvince ?? '', entryYear: s.entryYear ?? cur.year, graduatedWhen: '', purpose: '', reason: '' };
    case 'conduct': return { track: '', prevSchool: s.prevSchool ?? '', prevProvince: s.prevProvince ?? s.homeProvince ?? '', prevLevel: s.prevLevel ?? '', purpose: '' };
    case 'course_change': return {
      studentKind: 'regular', backlogYear: cur.year, actions: type.code === 'B03' ? ['withdraw'] : [], withdrawReason: '',
      courses: [emptyCourse()], regularPeriods: ctx.registeredPeriods ?? 0,
    };
    case 'course_desc': return { phone: s.phone, purpose: '', courses: [emptyCourse()] };
    case 'defer_fee': return {
      guardianName: s.guardianName ?? '', guardianPhone: s.guardianPhone ?? '', relation: s.guardianRelation ?? '', term: String(cur.term), year: cur.year,
      creditUnits: 0, creditAmount: 0, materialUnits: 0, materialAmount: 0, oweCreditUnits: 0, oweCreditAmount: 0, oweMaterialUnits: 0, oweMaterialAmount: 0, payDate: '', reason: '',
    };
    case 'transfer': return { requester: s.level === 'pvc' ? 'student' : 'collegian', subjectType: '', careerGroup: '', mode: 'normal', evidence: ['transcript'], evidenceOther: '', courses: [emptyCourse()] };
    default: return {};
  }
}

export type FormResult = { ok: true; data: FormData } | { ok: false; errors: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max * 2) : typeof v === 'number' ? String(v) : '');
const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

function cleanCourse(raw: unknown, extra: CourseExtra[]): CourseRow {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (k: string) => { const v = num(r[k]); return Number.isFinite(v) ? Math.max(0, Math.min(99, Math.trunc(v))) : null; };
  return {
    code: str(r.code, 20).slice(0, 20), name: str(r.name, 80).slice(0, 80), periods: n('periods'), credits: n('credits'),
    amount: extra.includes('amount') ? str(r.amount, 12).slice(0, 12) : '',
    dayTime: extra.includes('dayTime') ? str(r.dayTime, 30).slice(0, 30) : '',
    teacher: extra.includes('teacher') ? str(r.teacher, 40).slice(0, 40) : '',
    category: extra.includes('category') ? str(r.category, 40).slice(0, 40) : '',
    grade: extra.includes('grade') ? str(r.grade, 4).slice(0, 4) : '',
  };
}

/** ตรวจและทำความสะอาดข้อมูล: เก็บเฉพาะช่องที่ประกาศไว้, ช่องที่ซ่อนอยู่ถูกล้าง, ข้อความยาวเกินถูกปฏิเสธ */
export function validateForm(template: TemplateKey, raw: unknown): FormResult {
  const defs = FORM_FIELDS[template];
  if (!defs) return { ok: false, errors: { _: 'แบบฟอร์มนี้ยังไม่เปิดให้ยื่นออนไลน์' } };
  const input = (raw && typeof raw === 'object' ? raw : {}) as FormData;
  const data: FormData = {};
  const errors: Record<string, string> = {};

  for (const def of defs) {
    if (def.kind === 'heading') continue;
    const visible = !def.showIf || def.showIf(input);
    const v = input[def.key];
    switch (def.kind) {
      case 'text':
      case 'textarea': {
        const s = visible ? str(v, def.max) : '';
        if (s.length > def.max) errors[def.key] = `ไม่เกิน ${def.max} ตัวอักษร`;
        else if (visible && def.required && s.length === 0) errors[def.key] = `กรอก${def.label.replace(/\s*\(.*\)$/, '')}`;
        data[def.key] = s;
        break;
      }
      case 'choice': {
        const s = typeof v === 'string' ? v : '';
        if (visible && def.required && !def.options.some((o) => o.value === s)) errors[def.key] = 'เลือก 1 ข้อ';
        data[def.key] = visible && def.options.some((o) => o.value === s) ? s : '';
        break;
      }
      case 'multi': {
        const list = Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && def.options.some((o) => o.value === x)))] : [];
        if (visible && list.length < (def.min ?? 0)) errors[def.key] = 'เลือกอย่างน้อย 1 ข้อ';
        data[def.key] = visible ? list : [];
        break;
      }
      case 'number': {
        const n = num(v);
        if (!visible) { data[def.key] = null; break; }
        if (!Number.isFinite(n)) { if (def.required) errors[def.key] = 'กรอกตัวเลข'; data[def.key] = null; break; }
        if (n < def.min || n > def.max) errors[def.key] = `ระหว่าง ${def.min}–${def.max}`;
        data[def.key] = Math.round(n * 100) / 100;
        break;
      }
      case 'date': {
        const s = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
        if (visible && def.required && !s) errors[def.key] = 'เลือกวันที่';
        data[def.key] = visible ? s : '';
        break;
      }
      case 'courses': {
        const rows = (Array.isArray(v) ? v : []).slice(0, def.maxRows).map((r) => cleanCourse(r, def.extra)).filter((r) => r.code || r.name);
        const bad = rows.findIndex((r) => !r.code || !r.name);
        if (visible && rows.length < def.minRows) errors[def.key] = 'เพิ่มรายวิชาอย่างน้อย 1 วิชา';
        else if (bad >= 0) errors[def.key] = `แถวที่ ${bad + 1}: กรอกรหัสวิชาและชื่อวิชาให้ครบ`;
        else if (new Set(rows.map((r) => r.code)).size !== rows.length) errors[def.key] = 'มีรหัสวิชาซ้ำกัน';
        data[def.key] = visible ? rows : [];
        break;
      }
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}

export const visibleFields = (template: TemplateKey, data: FormData) => (FORM_FIELDS[template] ?? []).filter((f) => !f.showIf || f.showIf(data));
