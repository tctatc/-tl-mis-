import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { parseOr400 } from '../common/zod.js';
import { StudentAcademicService } from './student-academic.service.js';

const termQuery = z.object({ termId: z.string().uuid().optional() });

const studentIdOf = (user: AuthUser) => {
  if (!user.studentId) throw new ForbiddenException('เฉพาะบัญชีนักศึกษา');
  return user.studentId;
};

@Controller('student')
export class StudentAcademicController {
  constructor(private readonly academic: StudentAcademicService) {}

  @Get('study-plan')
  studyPlan(@CurrentUser() user: AuthUser) {
    return this.academic.studyPlan(studentIdOf(user));
  }

  @Get('registration')
  registration(@CurrentUser() user: AuthUser, @Query() q: unknown) {
    return this.academic.registrationCard(studentIdOf(user), parseOr400(termQuery, q).termId);
  }

  @Get('schedule')
  schedule(@CurrentUser() user: AuthUser, @Query() q: unknown) {
    return this.academic.schedule(studentIdOf(user), parseOr400(termQuery, q).termId);
  }

  @Get('grades')
  grades(@CurrentUser() user: AuthUser) {
    return this.academic.grades(studentIdOf(user));
  }

  @Get('form-context')
  formContext(@CurrentUser() user: AuthUser) {
    return this.academic.formContext(studentIdOf(user));
  }

  @Get('subjects')
  subjects(@Query() q: unknown) {
    return this.academic.searchSubjects(parseOr400(z.object({ q: z.string().max(40).default('') }), q).q);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.academic.profile(studentIdOf(user));
  }

}
