-- CreateEnum
CREATE TYPE "StaffKind" AS ENUM ('teacher', 'support');

-- CreateEnum
CREATE TYPE "StaffWorkStatus" AS ENUM ('active', 'on_leave', 'transferred', 'retired', 'resigned');

-- CreateTable
CREATE TABLE "staff_profiles" (
    "userId" UUID NOT NULL,
    "staffCode" TEXT,
    "prefix" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "kind" "StaffKind" NOT NULL DEFAULT 'teacher',
    "positionTitle" TEXT NOT NULL DEFAULT '',
    "employment" TEXT NOT NULL DEFAULT '',
    "departmentId" UUID,
    "programId" UUID,
    "workStatus" "StaffWorkStatus" NOT NULL DEFAULT 'active',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_staffCode_key" ON "staff_profiles"("staffCode");

-- CreateIndex
CREATE INDEX "staff_profiles_departmentId_idx" ON "staff_profiles"("departmentId");

-- CreateIndex
CREATE INDEX "staff_profiles_programId_idx" ON "staff_profiles"("programId");

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
