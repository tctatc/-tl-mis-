import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { StudentAcademicController } from './academic/student-academic.controller.js';
import { StudentAcademicService } from './academic/student-academic.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { ImportsController } from './imports/imports.controller.js';
import { StudentImportService } from './imports/student-import.service.js';
import { AcademicAdminController } from './academic/academic-admin.controller.js';
import { AcademicAdminService } from './academic/academic-admin.service.js';
import { AcademicImportService } from './imports/academic-import.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { SessionGuard } from './auth/session.guard.js';
import { AuditService } from './common/audit.service.js';
import { CsrfMiddleware } from './common/csrf.middleware.js';
import { PrismaService } from './common/prisma.service.js';
import { HealthController } from './health.controller.js';
import { RequestsController } from './requests/requests.controller.js';
import { RequestsService } from './requests/requests.service.js';

@Module({
  imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }])],
  controllers: [HealthController, AuthController, RequestsController, StudentAcademicController, AdminController, ImportsController, AcademicAdminController],
  providers: [
    PrismaService,
    AuditService,
    AuthService,
    RequestsService,
    StudentAcademicService,
    AdminService,
    StudentImportService,
    AcademicImportService,
    AcademicAdminService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
