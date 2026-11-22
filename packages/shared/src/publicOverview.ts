/**
 * ตัวเลขภาพรวมบนหน้าแรก (ก่อนเข้าสู่ระบบ) — เป็นยอดรวมเท่านั้น ห้ามมีชื่อ รหัส หรือข้อมูลรายคน
 * ใครเปิดเว็บก็เห็น จึงคัดเฉพาะตัวเลขที่วิทยาลัยประกาศได้
 */
export interface PublicOverview {
  students: { studying: number; pvc: number; pvs: number; programs: number; byDepartment: { name: string; count: number }[] };
  requests: {
    total: number;
    approved: number;
    /** รอพิจารณา + กำลังพิจารณา + ส่งกลับให้แก้ */
    open: number;
    /** วันเฉลี่ยตั้งแต่ยื่นจนได้ผล (null = ยังไม่มีคำร้องที่ปิดแล้ว) */
    avgDays: number | null;
    monthly: { month: string; count: number }[];
    topTypes: { code: string; name: string; total: number }[];
  };
  updatedAt: string;
}
