-- CreateEnum
CREATE TYPE "AddressKind" AS ENUM ('home', 'current');

-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('midterm', 'final');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('registered', 'cancelled');

-- CreateEnum
CREATE TYPE "GradeStatus" AS ENUM ('draft', 'submitted', 'approved', 'published');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "bloodType" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "curriculumId" UUID,
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "entryTerm" INTEGER,
ADD COLUMN     "entryYear" INTEGER,
ADD COLUMN     "nationalId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "nationality" TEXT NOT NULL DEFAULT 'ไทย',
ADD COLUMN     "nickname" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prevGpa" DECIMAL(3,2),
ADD COLUMN     "prevLevel" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prevSchool" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "religion" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "student_addresses" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "kind" "AddressKind" NOT NULL,
    "houseNo" TEXT NOT NULL DEFAULT '',
    "moo" TEXT NOT NULL DEFAULT '',
    "road" TEXT NOT NULL DEFAULT '',
    "subdistrict" TEXT NOT NULL DEFAULT '',
    "district" TEXT NOT NULL DEFAULT '',
    "province" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "student_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "relation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "occupation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theory" INTEGER NOT NULL,
    "practice" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculums" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "programId" UUID NOT NULL,
    "minCredits" INTEGER NOT NULL,

    CONSTRAINT "curriculums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_plan_subjects" (
    "id" UUID NOT NULL,
    "curriculumId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "term" INTEGER NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "study_plan_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_sections" (
    "id" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "groupCode" TEXT NOT NULL,
    "teacherUserId" UUID,
    "capacity" INTEGER NOT NULL DEFAULT 40,

    CONSTRAINT "course_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_schedules" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT NOT NULL,

    CONSTRAINT "class_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_schedules" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "kind" "ExamKind" NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT NOT NULL,

    CONSTRAINT "exam_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'registered',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_subjects" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'regular',
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "registration_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_records" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "grade" TEXT NOT NULL,
    "status" "GradeStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_addresses_studentId_kind_key" ON "student_addresses"("studentId", "kind");

-- CreateIndex
CREATE INDEX "student_guardians_studentId_idx" ON "student_guardians"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_year_term_key" ON "academic_terms"("year", "term");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "curriculums_programId_year_key" ON "curriculums"("programId", "year");

-- CreateIndex
CREATE INDEX "study_plan_subjects_curriculumId_yearLevel_term_idx" ON "study_plan_subjects"("curriculumId", "yearLevel", "term");

-- CreateIndex
CREATE UNIQUE INDEX "study_plan_subjects_curriculumId_subjectId_key" ON "study_plan_subjects"("curriculumId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "course_sections_termId_subjectId_groupCode_key" ON "course_sections"("termId", "subjectId", "groupCode");

-- CreateIndex
CREATE INDEX "class_schedules_sectionId_idx" ON "class_schedules"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_schedules_sectionId_kind_key" ON "exam_schedules"("sectionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_studentId_termId_key" ON "registrations"("studentId", "termId");

-- CreateIndex
CREATE INDEX "registration_subjects_sectionId_idx" ON "registration_subjects"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_subjects_registrationId_sectionId_key" ON "registration_subjects"("registrationId", "sectionId");

-- CreateIndex
CREATE INDEX "grade_records_studentId_status_idx" ON "grade_records"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "grade_records_studentId_sectionId_key" ON "grade_records"("studentId", "sectionId");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculums"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_addresses" ADD CONSTRAINT "student_addresses_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculums" ADD CONSTRAINT "curriculums_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan_subjects" ADD CONSTRAINT "study_plan_subjects_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curriculums"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_plan_subjects" ADD CONSTRAINT "study_plan_subjects_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_schedules" ADD CONSTRAINT "class_schedules_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_schedules" ADD CONSTRAINT "exam_schedules_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_termId_fkey" FOREIGN KEY ("termId") REFERENCES "academic_terms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_subjects" ADD CONSTRAINT "registration_subjects_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_subjects" ADD CONSTRAINT "registration_subjects_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_records" ADD CONSTRAINT "grade_records_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "course_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
