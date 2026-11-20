/*
  Warnings:

  - You are about to drop the column `studentSignature` on the `requests` table. All the data in the column will be lost.
  - You are about to drop the column `signature` on the `students` table. All the data in the column will be lost.
  - You are about to drop the column `signatureUpdatedAt` on the `students` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "requests" DROP COLUMN "studentSignature",
ADD COLUMN     "studentSigned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "students" DROP COLUMN "signature",
DROP COLUMN "signatureUpdatedAt";
