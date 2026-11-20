-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "studentSignature" TEXT;

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "signature" TEXT,
ADD COLUMN     "signatureUpdatedAt" TIMESTAMP(3);
