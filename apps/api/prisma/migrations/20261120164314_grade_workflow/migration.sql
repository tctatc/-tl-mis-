-- CreateEnum
CREATE TYPE "SectionGradeStatus" AS ENUM ('none', 'draft', 'submitted', 'returned', 'approved', 'published');

-- AlterTable
ALTER TABLE "academic_terms" ADD COLUMN     "gradeDueAt" DATE,
ADD COLUMN     "gradeOpenAt" DATE;

-- AlterTable
ALTER TABLE "course_sections" ADD COLUMN     "approvalDate" DATE,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "gradeStatus" "SectionGradeStatus" NOT NULL DEFAULT 'none',
ADD COLUMN     "publishDocDate" DATE,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedById" UUID,
ADD COLUMN     "returnNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "submittedById" UUID;

-- AlterTable
ALTER TABLE "grade_records" ADD COLUMN     "score" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "grade_changes" (
    "id" UUID NOT NULL,
    "gradeRecordId" UUID NOT NULL,
    "fromGrade" TEXT NOT NULL,
    "toGrade" TEXT NOT NULL,
    "fromScore" DECIMAL(5,2),
    "toScore" DECIMAL(5,2),
    "reason" TEXT NOT NULL,
    "changedById" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "grade_changes_gradeRecordId_at_idx" ON "grade_changes"("gradeRecordId", "at");

-- CreateIndex
CREATE INDEX "course_sections_termId_gradeStatus_idx" ON "course_sections"("termId", "gradeStatus");

-- CreateIndex
CREATE INDEX "course_sections_teacherUserId_termId_idx" ON "course_sections"("teacherUserId", "termId");

-- AddForeignKey
ALTER TABLE "grade_changes" ADD CONSTRAINT "grade_changes_gradeRecordId_fkey" FOREIGN KEY ("gradeRecordId") REFERENCES "grade_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ตั้งสถานะวิชาจากเกรดที่มีอยู่เดิม (ข้อมูลก่อนมีขั้นตอนส่งผล)
-- ทุกคนประกาศแล้ว → published · มีอนุมัติ/ประกาศปนกัน → approved (ไม่แตะเกรดรายคน ไม่เผยเกรดเพิ่ม)
UPDATE "course_sections" s SET
  "gradeStatus" = CASE
    WHEN NOT EXISTS (SELECT 1 FROM "grade_records" g WHERE g."sectionId" = s.id) THEN 'none'
    WHEN NOT EXISTS (SELECT 1 FROM "grade_records" g WHERE g."sectionId" = s.id AND g.status <> 'published') THEN 'published'
    WHEN EXISTS (SELECT 1 FROM "grade_records" g WHERE g."sectionId" = s.id AND g.status IN ('approved', 'published')) THEN 'approved'
    WHEN NOT EXISTS (SELECT 1 FROM "grade_records" g WHERE g."sectionId" = s.id AND g.status = 'draft') THEN 'submitted'
    ELSE 'draft'
  END::"SectionGradeStatus",
  "publishedAt" = (SELECT max(g."publishedAt") FROM "grade_records" g WHERE g."sectionId" = s.id AND g.status = 'published');
