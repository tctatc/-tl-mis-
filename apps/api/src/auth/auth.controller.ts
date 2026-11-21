import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { RateLimit } from '../common/rate-limit.js';
import type { Request, Response } from 'express';
import { passwordProblem } from '@csis/shared';
import { z } from 'zod';
import { clientIp } from '../common/request-ip.js';
import { parseOr400 } from '../common/zod.js';
import { AuthService } from './auth.service.js';
import { AllowPendingPassword, CurrentUser, Public, type AuthUser } from './decorators.js';
import { SESSION_COOKIE, cookieOptions } from './session.js';

const loginSchema = z.object({
  username: z.string().trim().min(1, 'กรอกชื่อผู้ใช้').max(64),
  password: z.string().min(1, 'กรอกรหัสผ่าน').max(128),
});

const changeSchema = z.object({
  current: z.string().min(1, 'กรอกรหัสผ่านปัจจุบัน').max(128),
  next: z.string().superRefine((v, ctx) => { const p = passwordProblem(v); if (p) ctx.addIssue({ code: 'custom', message: p }); }),
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @RateLimit(10, 60_000)
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { username, password } = parseOr400(loginSchema, body);
    const { token, expiresAt } = await this.auth.login(username, password, clientIp(req), req.get('user-agent') ?? '');
    res.cookie(SESSION_COOKIE, token, cookieOptions(expiresAt.getTime() - Date.now(), req.get('origin')));
    return { ok: true };
  }

  @AllowPendingPassword()
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user.sessionId);
    res.clearCookie(SESSION_COOKIE, cookieOptions(undefined, req.get('origin')));
    return { ok: true };
  }

  @AllowPendingPassword()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @AllowPendingPassword()
  @RateLimit(10, 60_000)
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    const { current, next } = parseOr400(changeSchema, body);
    await this.auth.changePassword(user, current, next, clientIp(req));
    return { ok: true };
  }
}
