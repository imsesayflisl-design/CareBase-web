-- AlterTable
ALTER TABLE "StaffInvitation" ADD COLUMN     "pairedNurseMemberId" TEXT;

-- CreateIndex
CREATE INDEX "StaffInvitation_pairedNurseMemberId_idx" ON "StaffInvitation"("pairedNurseMemberId");
