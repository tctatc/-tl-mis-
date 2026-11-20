import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, isStaff, type AuthUser } from '../auth/decorators.js';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { RequestsService } from './requests.service.js';
import { ForbiddenException } from '@nestjs/common';

const createSchema = z.object({
  typeCode: z.string().regex(/^[A-D]\d{2}$/),
  data: z.unknown(),
  idempotencyKey: z.string().uuid(),
  useSignature: z.boolean().optional(),
});
const resubmitSchema = z.object({ data: z.unknown(), useSignature: z.boolean().optional() });
const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject', 'return']),
  comment: z.string().max(300, 'ไม่เกิน 300 ตัวอักษร').default(''),
  expectedStep: z.number().int().min(0),
  expectedRound: z.number().int().min(1),
});
const listSchema = z.object({
  box: z.enum(['todo', 'done', 'all']).default('todo'),
  status: z.enum(['pending', 'returned', 'approved', 'rejected', 'cancelled']).optional(),
  q: z.string().max(60).optional(),
  page: z.coerce.number().int().min(0).max(10_000).default(0),
});

@Controller()
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get('requests/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.requests.listMine(user);
  }

  @Get('requests/officials')
  officials() {
    return this.requests.officials();
  }

  @Post('requests')
  create(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    return this.requests.create(user, parseOr400(createSchema, body), clientIp(req));
  }

  @Get('requests/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.requests.detail(user, id);
  }

  @Put('requests/:id')
  async resubmit(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    const b = parseOr400(resubmitSchema, body);
    await this.requests.resubmit(user, id, b.data, clientIp(req), b.useSignature);
    return { ok: true };
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    await this.requests.cancel(user, id, clientIp(req));
    return { ok: true };
  }

  @Post('requests/:id/decision')
  @HttpCode(200)
  decide(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: unknown, @Req() req: Request) {
    return this.requests.decide(user, id, parseOr400(decisionSchema, body), clientIp(req));
  }

  @Get('staff/requests')
  staffList(@CurrentUser() user: AuthUser, @Query() query: unknown) {
    if (!isStaff(user)) throw new ForbiddenException('เฉพาะเจ้าหน้าที่');
    return this.requests.listStaff(user, parseOr400(listSchema, query));
  }
}
