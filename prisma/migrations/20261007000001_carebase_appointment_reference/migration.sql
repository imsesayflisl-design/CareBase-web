-- AlterTable
ALTER TABLE "CareAppointment" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CareAppointment_reference_key" ON "CareAppointment"("reference");

