-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('uploaded', 'previewed', 'committing', 'committed', 'failed');

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'uploaded',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "headers" JSONB NOT NULL,
    "rawRows" JSONB NOT NULL,
    "mapping" JSONB,
    "options" JSONB,
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_job_rows" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "issues" JSONB NOT NULL,

    CONSTRAINT "import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_jobs_kind_createdAt_idx" ON "import_jobs"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "import_job_rows_jobId_rowNo_idx" ON "import_job_rows"("jobId", "rowNo");

-- AddForeignKey
ALTER TABLE "import_job_rows" ADD CONSTRAINT "import_job_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
