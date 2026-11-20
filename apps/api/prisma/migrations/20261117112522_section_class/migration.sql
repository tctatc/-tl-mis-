-- AlterTable
ALTER TABLE "course_sections" ADD COLUMN     "groupNo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "programId" UUID,
ADD COLUMN     "teacherName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "yearLevel" INTEGER;

-- AddForeignKey
ALTER TABLE "course_sections" ADD CONSTRAINT "course_sections_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
