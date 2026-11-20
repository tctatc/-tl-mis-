import type { Role } from '@csis/shared';

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด', ADMIN: 'ผู้ดูแลระบบ', REGISTRAR: 'งานทะเบียน', CURRICULUM_STAFF: 'งานหลักสูตร',
  ASSESSMENT_STAFF: 'งานวัดผล', TEACHER: 'ครู', ADVISOR: 'ครูที่ปรึกษา', STUDENT: 'นักเรียน',
};

const ACTIONS: Record<string, string> = {
  'request.create': 'ยื่นคำร้อง', 'request.approve': 'พิจารณาคำร้อง (เห็นควร)', 'request.reject': 'ไม่อนุมัติคำร้อง', 'request.return': 'ส่งคำร้องกลับแก้ไข',
  'request.resubmit': 'แก้ไขคำร้องแล้วส่งใหม่', 'request.cancel': 'ยกเลิกคำร้อง', 'user.create': 'เพิ่มผู้ใช้', 'user.update': 'แก้ไขผู้ใช้',
  'user.reset_password': 'รีเซ็ตรหัสผ่าน', 'user.unlock': 'ปลดล็อกบัญชี', 'user.password_change': 'เปลี่ยนรหัสผ่าน', 'position.update': 'เปลี่ยนผู้ลงนาม',
  'program.set_head': 'กำหนดหัวหน้าสาขา', 'student.create': 'เพิ่มนักเรียน', 'student.update': 'แก้ไขข้อมูลนักเรียน',
};
export const actionLabel = (a: string) => ACTIONS[a] ?? a;
