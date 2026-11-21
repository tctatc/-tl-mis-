import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { StudentAcademicController } from './academic/student-academic.controller.js';
import { StudentAcademicService } from './academic/student-academic.service.js';
import { AdminController } from './admin/admin.controller.js';
import { AdminService } from './admin/admin.service.js';
import { ImportsController } from './imports/imports.controller.js';
import { StudentImportService } from './imports/student-import.service.js';
import { AcademicAdminController } from './academic/academic-admin.controller.js';
import { AcademicAdminService } from './academic/academic-admin.service.js';
import { AcademicImportService } from './imports/academic-import.service.js';
import { GradingAdminController, TeachController } from './grading/grading.controller.js';
import { GradingService } from './grading/grading.service.js';
import { RegistryController } from './registry/registry.controller.js';
import { RegistryService } from './registry/registry.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { SessionGuard } from './auth/session.guard.js';
import { AuditService } from './common/audit.service.js';
import { CsrfMiddleware } from './common/csrf.middleware.js';
import { RateLimitGuard } from './common/rate-limit.js';
import { PrismaService } from './common/prisma.service.js';
import { DashboardController } from './dashboard/dashboard.controller.js';
import { DashboardService } from './dashboard/dashboard.service.js';
import { HealthController } from './health.controller.js';
import { RequestsController } from './requests/requests.controller.js';
import { RequestsService } from './requests/requests.service.js';

@Module({
  controllers: [HealthController, AuthController, RequestsController, StudentAcademicController, AdminController, ImportsController, AcademicAdminController, TeachController, GradingAdminController, RegistryController, DashboardController],
  providers: [
    PrismaService,
    AuditService,
    GradingService,
    RegistryService,
    AuthService,
    RequestsService,
    StudentAcademicService,
    AdminService,
    StudentImportService,
    AcademicImportService,
    AcademicAdminService,
    DashboardService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
