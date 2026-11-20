import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { PositionKey, Role } from '@csis/shared';

export const IS_PUBLIC = 'csis:public';
/** เส้นทางที่ไม่ต้องล็อกอิน */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ALLOW_PENDING_PASSWORD = 'csis:allow-pending-password';
/** ใช้ได้แม้ยังไม่ได้เปลี่ยนรหัสผ่านครั้งแรก (me, logout, change-password) */
export const AllowPendingPassword = () => SetMetadata(ALLOW_PENDING_PASSWORD, true);

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
  positions: PositionKey[];
  mustChangePassword: boolean;
  studentId: string | null;
  sessionId: string;
}

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user as AuthUser;
});

export const STAFF_ROLES: readonly Role[] = ['SUPER_ADMIN', 'ADMIN', 'REGISTRAR', 'CURRICULUM_STAFF', 'ASSESSMENT_STAFF', 'TEACHER', 'ADVISOR'];
export const isStaff = (user: AuthUser) => user.roles.some((r) => STAFF_ROLES.includes(r)) || user.positions.length > 0;
/** เห็นคำร้องทุกใบ (ไม่ใช่แค่ใบที่รอตัวเองพิจารณา) */
export const seesAllRequests = (user: AuthUser) => user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR');
