-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_doctor_id_fkey";

-- AlterTable
ALTER TABLE "StaffInvitation" ADD COLUMN     "linkedInvitationId" TEXT;

-- CreateIndex
CREATE INDEX "Hospital_createdByUserId_idx" ON "Hospital"("createdByUserId");

-- CreateIndex
CREATE INDEX "Hospital_email_idx" ON "Hospital"("email");

-- CreateIndex
CREATE INDEX "HospitalMember_userId_status_idx" ON "HospitalMember"("userId", "status");

-- CreateIndex
CREATE INDEX "StaffInvitation_linkedInvitationId_idx" ON "StaffInvitation"("linkedInvitationId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
