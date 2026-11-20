-- AlterTable
ALTER TABLE "grade_changes" ADD COLUMN     "requestId" UUID;

-- AddForeignKey
ALTER TABLE "grade_changes" ADD CONSTRAINT "grade_changes_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
