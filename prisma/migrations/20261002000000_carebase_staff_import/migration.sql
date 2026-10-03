-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('REVIEW', 'COMPLETED', 'DISCARDED', 'FAILED');

-- CreateTable
CREATE TABLE "StaffImportBatch" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'REVIEW',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "rows" JSONB,
    "errors" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdByMemberId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffImportBatch_hospitalId_status_createdAt_idx" ON "StaffImportBatch"("hospitalId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "StaffImportBatch" ADD CONSTRAINT "StaffImportBatch_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffImportBatch" ADD CONSTRAINT "StaffImportBatch_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "HospitalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;