import type { Assignee, WorkflowStep } from './catalog.js';
import type { Decision, PositionKey, RequestStatus } from './model.js';

/**
 * กติกาการเดินคำร้อง (ฟังก์ชันล้วน ไม่แตะฐานข้อมูล — API เรียกใช้ภายใน transaction)
 *
 * pending  --approve(ขั้นสุดท้าย)--> approved
 * pending  --approve--> pending (ขั้นถัดไป)
 * pending  --reject--> rejected
 * pending  --return--> returned       (ส่งกลับให้นักศึกษาแก้)
 * returned --resubmit--> pending (ขั้นแรก, รอบใหม่)
 * pending  --cancel--> cancelled      (เจ้าของยกเลิกได้เฉพาะตอนยังไม่มีใครพิจารณาในรอบนี้)
 */

export interface FlowState { status: RequestStatus; currentStep: number; round: number }

export class FlowError extends Error {}

export function applyDecision(state: FlowState, steps: readonly WorkflowStep[], decision: Decision): FlowState {
  if (state.status !== 'pending') throw new FlowError('คำร้องนี้ไม่ได้อยู่ระหว่างพิจารณา');
  if (state.currentStep < 0 || state.currentStep >= steps.length) throw new FlowError('ขั้นตอนไม่ถูกต้อง');
  switch (decision) {
    case 'approve':
      return state.currentStep === steps.length - 1
        ? { ...state, status: 'approved' }
        : { ...state, currentStep: state.currentStep + 1 };
    case 'reject':
      return { ...state, status: 'rejected' };
    case 'return':
      return { ...state, status: 'returned' };
  }
}

export function resubmit(state: FlowState): FlowState {
  if (state.status !== 'returned') throw new FlowError('แก้ไขได้เฉพาะคำร้องที่ถูกส่งกลับ');
  return { status: 'pending', currentStep: 0, round: state.round + 1 };
}

export function canCancel(state: FlowState, decisionsThisRound: number): boolean {
  return (state.status === 'pending' && decisionsThisRound === 0) || state.status === 'returned';
}

export interface Actor { userId: string; positions: readonly PositionKey[] }
export interface Subject { submitterUserId: string; advisorUserId: string | null; programHeadUserId?: string | null }

/** ผู้ใช้คนนี้เป็นผู้พิจารณาขั้นนี้หรือไม่ — ผู้ยื่นพิจารณาคำร้องของตัวเองไม่ได้ */
export function isAssignee(actor: Actor, assignee: Assignee, subject: Subject): boolean {
  if (actor.userId === subject.submitterUserId) return false;
  if (assignee.kind === 'advisor') return subject.advisorUserId === actor.userId;
  if (assignee.kind === 'programHead') return !!subject.programHeadUserId && subject.programHeadUserId === actor.userId;
  return actor.positions.includes(assignee.position);
}

export const DECISION_LABEL: Record<Decision, string> = {
  approve: 'เห็นควรอนุมัติ',
  reject: 'ไม่อนุมัติ',
  return: 'ส่งกลับให้แก้ไข',
};

/** ข้อความที่ขั้นสุดท้าย (คำสั่งผู้อำนวยการ) ใช้แทน "เห็นควร" */
export const FINAL_DECISION_LABEL: Record<Decision, string> = {
  approve: 'อนุมัติ',
  reject: 'ไม่อนุมัติ',
  return: 'ส่งกลับให้แก้ไข',
};

/** เลขที่คำร้อง: R69-00001 (ปี พ.ศ. 2 หลักท้าย + ลำดับในปีนั้น) */
export function formatRequestNo(buddhistYear: number, seq: number): string {
  return `R${String(buddhistYear % 100).padStart(2, '0')}-${String(seq).padStart(5, '0')}`;
}
