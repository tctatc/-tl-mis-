-- AlterTable
ALTER TABLE "students" ADD COLUMN     "classGroupId" UUID,
ADD COLUMN     "graduationDate" DATE;

-- CreateTable
CREATE TABLE "class_groups" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "programId" UUID NOT NULL,
    "entryYear" INTEGER NOT NULL,
    "groupNo" TEXT NOT NULL,
    "yearLevel" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_batches" (
    "id" UUID NOT NULL,
    "academicYear" INTEGER NOT NULL,
    "byId" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    "undoneById" UUID,
    "items" JSONB NOT NULL,

    CONSTRAINT "promotion_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_groups_code_key" ON "class_groups"("code");

-- CreateIndex
CREATE UNIQUE INDEX "class_groups_programId_entryYear_groupNo_key" ON "class_groups"("programId", "entryYear", "groupNo");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_classGroupId_fkey" FOREIGN KEY ("classGroupId") REFERENCES "class_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
