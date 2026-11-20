-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "headUserId" UUID;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_headUserId_fkey" FOREIGN KEY ("headUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
