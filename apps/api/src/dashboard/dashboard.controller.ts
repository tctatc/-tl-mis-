import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, seesAllRequests, type AuthUser } from '../auth/decorators.js';
import { parseOr400 } from '../common/zod.js';
import { DashboardService } from './dashboard.service.js';

/** แดชบอร์ดผู้บริหาร: ผู้ดูแลระบบ + งานทะเบียน (ข้อมูลรายคนมีชื่อนักเรียน จึงไม่เปิดให้ครูทั่วไป) */
const requireViewer = (u: AuthUser) => { if (!seesAllRequests(u)) throw new ForbiddenException('เฉพาะผู้ดูแลระบบและงานทะเบียน'); };

const listQuery = z.object({
  q: z.string().max(60).optional(),
  type: z.string().regex(/^[A-Z]\d{2}$/).optional(),
  stage: z.enum(['waiting', 'in_progress', 'returned', 'approved', 'rejected', 'cancelled']).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dash: DashboardService) {}

  @Get('students')
  students(@CurrentUser() u: AuthUser) { requireViewer(u); return this.dash.students(); }

  @Get('requests')
  requests(@CurrentUser() u: AuthUser) { requireViewer(u); return this.dash.requests(); }

  @Get('requests/list')
  requestList(@CurrentUser() u: AuthUser, @Query() q: unknown) { requireViewer(u); return this.dash.requestList(parseOr400(listQuery, q)); }
}
