import { Controller, Get } from '@nestjs/common';
import type { PublicOverview } from '@csis/shared';
import { Public } from '../auth/decorators.js';
import { RateLimit } from '../common/rate-limit.js';
import { DashboardService } from '../dashboard/dashboard.service.js';

const TTL_MS = 5 * 60_000;

/**
 * ภาพรวมสาธารณะสำหรับหน้าแรก — คำนวณจากแดชบอร์ดผู้บริหาร แล้วตัดเหลือยอดรวม (ไม่มีรายชื่อ/รายการคำร้อง)
 * แคชในหน่วยความจำ 5 นาที: หน้าแรกถูกเปิดบ่อย ไม่ควรยิงฐานข้อมูลทุกครั้ง
 */
@Controller('public')
export class PublicController {
  private cache: { at: number; value: PublicOverview } | null = null;
  constructor(private readonly dash: DashboardService) {}

  @Public()
  @RateLimit(60, 60_000)
  @Get('overview')
  async overview(): Promise<PublicOverview> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.value;
    const [s, r] = await Promise.all([this.dash.students(), this.dash.requests()]);
    const studying = s.byLevelYear.reduce((a, x) => a + x.count, 0);
    const value: PublicOverview = {
      students: {
        studying,
        pvc: s.byLevelYear.filter((x) => x.level === 'pvc').reduce((a, x) => a + x.count, 0),
        pvs: s.byLevelYear.filter((x) => x.level === 'pvs').reduce((a, x) => a + x.count, 0),
        programs: s.byProgram.length,
        byDepartment: s.byDepartment.map((d) => ({ name: d.name, count: d.pvc + d.pvs })),
      },
      requests: {
        total: r.total - r.stages.cancelled,
        approved: r.stages.approved,
        open: r.stages.waiting + r.stages.in_progress + r.stages.returned,
        avgDays: r.avgDays,
        monthly: r.monthly.slice(-6),
        topTypes: r.byType.slice(0, 5).map((t) => ({ code: t.code, name: t.name, total: t.total })),
      },
      updatedAt: new Date().toISOString(),
    };
    this.cache = { at: Date.now(), value };
    return value;
  }
}
