/** ชนิดข้อมูลที่หน้าเว็บกับ API ใช้ร่วมกัน */

export type Level = 'pvc' | 'pvs';
export const LEVEL_LABEL: Record<Level, string> = { pvc: 'ปวช.', pvs: 'ปวส.' };

export const ROLES = [
  'SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'CURRICULUM_STAFF', 'ASSESSMENT_STAFF', 'TEACHER', 'ADVISOR', 'STUDENT',
] as const;
export type Role = (typeof ROLES)[number];

/**
 * ตำแหน่งที่ลงความเห็นในแบบคำร้อง (ตามช่องความเห็นที่พิมพ์ไว้ในกระดาษ)
 * ชื่อคนที่ดำรงตำแหน่งเก็บในฐานข้อมูล เปลี่ยนคนได้โดยไม่ต้องแก้โค้ด
 */
export const POSITIONS = {
  director: 'ผู้อำนวยการวิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์',
  deputy_resources: 'รองผู้อำนวยการฝ่ายบริหารทรัพยากร',
  deputy_academic: 'รองผู้อำนวยการฝ่ายวิชาการ',
  registrar_head: 'หัวหน้างานทะเบียน',
  finance_head: 'หัวหน้างานการเงิน',
  library_head: 'หัวหน้างานห้องสมุด',
  curriculum_head: 'หัวหน้างานพัฒนาหลักสูตรและการจัดการเรียนรู้',
  discipline_head: 'หัวหน้างานปกครอง',
} as const;
export type PositionKey = keyof typeof POSITIONS;

/** ข้อมูลนักศึกษา ณ วันที่ยื่นคำร้อง (แบบฟอร์มที่พิมพ์ต้องตรงกับวันที่ยื่น แม้ภายหลังข้อมูลจะเปลี่ยน) */
export interface StudentSnapshot {
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  level: Level;
  department: string;
  program: string;
  yearLevel: number;
  groupNo: string;
  fatherName: string;
  motherName: string;
  phone: string;
  /** ข้อมูลเพิ่มสำหรับฟอร์มเฉพาะ (ใบเก่าที่ยื่นก่อนเพิ่มช่องเหล่านี้จะไม่มี) */
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  advisorName?: string;
  programHeadName?: string;
  curriculumName?: string;
  entryYear?: number | null;
  prevSchool?: string;
  prevProvince?: string;
  prevLevel?: string;
  /** จังหวัดตามที่อยู่ทะเบียนบ้าน (ใช้แทนจังหวัดที่เกิดเมื่อยังไม่มีข้อมูล) */
  homeProvince?: string;
  /** รหัสกลุ่มเรียน เช่น 683190901 */
  classGroupCode?: string;
}

export type RequestStatus = 'pending' | 'returned' | 'approved' | 'rejected' | 'cancelled';
export const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'กำลังพิจารณา',
  returned: 'ส่งกลับให้แก้ไข',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิกแล้ว',
};

export type Decision = 'approve' | 'reject' | 'return';

export interface ApprovalRecord {
  id: string;
  round: number;
  stepIndex: number;
  stepKey: string;
  decision: Decision;
  comment: string;
  actorName: string;
  /** ตำแหน่งที่พิมพ์ใต้ชื่อในแบบฟอร์ม */
  actorTitle: string;
  decidedAt: string;
}

export interface StatusEvent {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  note: string;
  actorName: string;
  at: string;
}

export interface RequestSummary {
  id: string;
  requestNo: string;
  typeCode: string;
  status: RequestStatus;
  currentStep: number;
  round: number;
  submittedAt: string;
  updatedAt: string;
  studentCode: string;
  studentName: string;
  /** ชื่อขั้นตอนที่รออยู่ (ว่างเมื่อจบแล้ว) */
  waitingFor: string;
}

export interface RequestDetail extends RequestSummary {
  data: unknown;
  student: StudentSnapshot;
  /** นักศึกษาลงชื่อออนไลน์ (ชื่อ-สกุลในช่องลงชื่อ) — false = เว้นไว้เซ็นบนกระดาษ */
  studentSigned: boolean;
  approvals: ApprovalRecord[];
  history: StatusEvent[];
  /** ชื่อผู้ดำรงตำแหน่งปัจจุบัน ใช้พิมพ์ในวงเล็บใต้ช่องลงชื่อ */
  officials: Partial<Record<PositionKey, string>>;
  /** ผู้ที่เรียกดูทำอะไรกับคำร้องนี้ได้บ้าง */
  can: { act: boolean; edit: boolean; cancel: boolean };
}

export interface Me {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
  positions: PositionKey[];
  mustChangePassword: boolean;
  student: StudentSnapshot | null;
}

export const fullName = (s: Pick<StudentSnapshot, 'prefix' | 'firstName' | 'lastName'>) =>
  `${s.prefix}${s.firstName} ${s.lastName}`.trim();
