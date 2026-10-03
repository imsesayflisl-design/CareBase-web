-- Add "LATE" to the attendance status enum.
ALTER TYPE "AttendanceStatus" ADD VALUE 'LATE';

-- Attendance gains department attribution plus creator/modifier audit columns.
ALTER TABLE "StaffAttendance" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "StaffAttendance" ADD COLUMN "createdByMemberId" TEXT;
ALTER TABLE "StaffAttendance" ADD COLUMN "updatedByMemberId" TEXT;

-- CreateIndex
CREATE INDEX "StaffAttendance_hospitalId_departmentId_date_idx" ON "StaffAttendance"("hospitalId", "departmentId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_hospitalId_shift_date_idx" ON "StaffAttendance"("hospitalId", "shift", "date");