-- CreateEnum
CREATE TYPE "CareStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CareAppointmentStatus" AS ENUM ('REQUESTED', 'PENDING', 'CONFIRMED', 'REJECTED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DiagnosticKind" AS ENUM ('TEST', 'SCAN');

-- CreateEnum
CREATE TYPE "CareWorkflowStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "BedRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LEAVE');

-- CreateEnum
CREATE TYPE "AttendanceShift" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CarePaymentStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "Hospital" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Sierra Leone',
    "phone" TEXT,
    "email" TEXT,
    "emergencyContact" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Freetown',
    "currency" TEXT NOT NULL DEFAULT 'SLE',
    "openingHours" JSONB,
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hospital_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalRole" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalMember" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "title" TEXT,
    "photoUrl" TEXT,
    "status" "CareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "contact" TEXT,
    "operatingHours" JSONB,
    "status" "CareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentMember" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "departmentId" TEXT,
    "qualifications" TEXT,
    "specialty" TEXT,
    "subSpecialty" TEXT,
    "yearsExperience" INTEGER,
    "biography" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consultationType" TEXT,
    "consultationFee" DOUBLE PRECISION,
    "availabilityStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NurseDoctorAssignment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NurseDoctorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePatient" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "externalUserId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "medicalConditions" TEXT,
    "medicalHistory" TEXT,
    "insuranceProvider" TEXT,
    "insuranceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareAppointment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT,
    "assignedNurseId" TEXT,
    "departmentId" TEXT,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "time" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "reason" TEXT,
    "appointmentType" TEXT NOT NULL DEFAULT 'CONSULTATION',
    "status" "CareAppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "rejectionReason" TEXT,
    "rescheduledFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalEncounter" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "authorMemberId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "assessment" TEXT,
    "diagnosis" TEXT,
    "treatmentPlan" TEXT,
    "followUpPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalEncounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "authorMemberId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'CLINICAL',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "encounterId" TEXT,
    "authorMemberId" TEXT NOT NULL,
    "medication" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "instructions" TEXT,
    "prescribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticService" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "kind" "DiagnosticKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER,
    "preparationInstructions" TEXT,
    "homeServiceAvailable" BOOLEAN NOT NULL DEFAULT false,
    "status" "CareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticOrder" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "orderedByMemberId" TEXT NOT NULL,
    "completedByMemberId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "CareWorkflowStatus" NOT NULL DEFAULT 'REQUESTED',
    "result" TEXT,
    "reportUrl" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ward" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "status" "CareStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedRequest" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "wardId" TEXT,
    "bedId" TEXT,
    "requestedFor" TIMESTAMP(3),
    "reason" TEXT,
    "status" "BedRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalPayment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SLE',
    "method" TEXT,
    "status" "CarePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalTransaction" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "transactionId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "status" "CarePaymentStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "AttendanceShift" NOT NULL DEFAULT 'MORNING',
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalNotice" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HospitalNotification" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "memberId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HospitalNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clerkInvitationId" TEXT,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "actorMemberId" TEXT,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareEvent" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Hospital_slug_key" ON "Hospital"("slug");

-- CreateIndex
CREATE INDEX "Hospital_status_idx" ON "Hospital"("status");

-- CreateIndex
CREATE INDEX "HospitalRole_hospitalId_idx" ON "HospitalRole"("hospitalId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalRole_hospitalId_name_key" ON "HospitalRole"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "HospitalMember_hospitalId_status_idx" ON "HospitalMember"("hospitalId", "status");

-- CreateIndex
CREATE INDEX "HospitalMember_hospitalId_roleId_idx" ON "HospitalMember"("hospitalId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalMember_hospitalId_userId_key" ON "HospitalMember"("hospitalId", "userId");

-- CreateIndex
CREATE INDEX "Department_hospitalId_status_idx" ON "Department"("hospitalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_hospitalId_name_key" ON "Department"("hospitalId", "name");

-- CreateIndex
CREATE INDEX "DepartmentMember_hospitalId_memberId_idx" ON "DepartmentMember"("hospitalId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentMember_departmentId_memberId_key" ON "DepartmentMember"("departmentId", "memberId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_memberId_key" ON "DoctorProfile"("memberId");

-- CreateIndex
CREATE INDEX "DoctorProfile_hospitalId_departmentId_idx" ON "DoctorProfile"("hospitalId", "departmentId");

-- CreateIndex
CREATE INDEX "DoctorProfile_hospitalId_availabilityStatus_idx" ON "DoctorProfile"("hospitalId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "DoctorSchedule_hospitalId_doctorId_idx" ON "DoctorSchedule"("hospitalId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctorId_dayOfWeek_startTime_key" ON "DoctorSchedule"("doctorId", "dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "NurseDoctorAssignment_hospitalId_nurseId_idx" ON "NurseDoctorAssignment"("hospitalId", "nurseId");

-- CreateIndex
CREATE UNIQUE INDEX "NurseDoctorAssignment_doctorId_nurseId_key" ON "NurseDoctorAssignment"("doctorId", "nurseId");

-- CreateIndex
CREATE INDEX "CarePatient_hospitalId_firstName_lastName_idx" ON "CarePatient"("hospitalId", "firstName", "lastName");

-- CreateIndex
CREATE INDEX "CarePatient_hospitalId_phone_idx" ON "CarePatient"("hospitalId", "phone");

-- CreateIndex
CREATE INDEX "CarePatient_hospitalId_dateOfBirth_idx" ON "CarePatient"("hospitalId", "dateOfBirth");

-- CreateIndex
CREATE UNIQUE INDEX "CarePatient_hospitalId_patientCode_key" ON "CarePatient"("hospitalId", "patientCode");

-- CreateIndex
CREATE INDEX "CareAppointment_hospitalId_appointmentDate_status_idx" ON "CareAppointment"("hospitalId", "appointmentDate", "status");

-- CreateIndex
CREATE INDEX "CareAppointment_hospitalId_patientId_appointmentDate_idx" ON "CareAppointment"("hospitalId", "patientId", "appointmentDate");

-- CreateIndex
CREATE INDEX "CareAppointment_hospitalId_doctorId_appointmentDate_idx" ON "CareAppointment"("hospitalId", "doctorId", "appointmentDate");

-- CreateIndex
CREATE INDEX "ClinicalEncounter_hospitalId_patientId_occurredAt_idx" ON "ClinicalEncounter"("hospitalId", "patientId", "occurredAt");

-- CreateIndex
CREATE INDEX "ClinicalNote_hospitalId_patientId_createdAt_idx" ON "ClinicalNote"("hospitalId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Prescription_hospitalId_patientId_prescribedAt_idx" ON "Prescription"("hospitalId", "patientId", "prescribedAt");

-- CreateIndex
CREATE INDEX "DiagnosticService_hospitalId_kind_status_idx" ON "DiagnosticService"("hospitalId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiagnosticService_hospitalId_kind_name_key" ON "DiagnosticService"("hospitalId", "kind", "name");

-- CreateIndex
CREATE INDEX "DiagnosticOrder_hospitalId_status_createdAt_idx" ON "DiagnosticOrder"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticOrder_hospitalId_patientId_createdAt_idx" ON "DiagnosticOrder"("hospitalId", "patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Ward_hospitalId_status_idx" ON "Ward"("hospitalId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Ward_hospitalId_name_key" ON "Ward"("hospitalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Room_wardId_name_key" ON "Room"("wardId", "name");

-- CreateIndex
CREATE INDEX "Bed_status_idx" ON "Bed"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Bed_roomId_label_key" ON "Bed"("roomId", "label");

-- CreateIndex
CREATE INDEX "BedRequest_hospitalId_status_createdAt_idx" ON "BedRequest"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalPayment_appointmentId_key" ON "HospitalPayment"("appointmentId");

-- CreateIndex
CREATE INDEX "HospitalPayment_hospitalId_status_createdAt_idx" ON "HospitalPayment"("hospitalId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalPayment_hospitalId_receiptNumber_key" ON "HospitalPayment"("hospitalId", "receiptNumber");

-- CreateIndex
CREATE INDEX "StaffAttendance_hospitalId_date_status_idx" ON "StaffAttendance"("hospitalId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_memberId_date_shift_key" ON "StaffAttendance"("memberId", "date", "shift");

-- CreateIndex
CREATE INDEX "HospitalNotice_hospitalId_status_publishAt_idx" ON "HospitalNotice"("hospitalId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "HospitalNotification_hospitalId_memberId_readAt_createdAt_idx" ON "HospitalNotification"("hospitalId", "memberId", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tokenHash_key" ON "StaffInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvitation_hospitalId_status_expiresAt_idx" ON "StaffInvitation"("hospitalId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_hospitalId_createdAt_idx" ON "AuditEvent"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_hospitalId_entity_entityId_idx" ON "AuditEvent"("hospitalId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "CareEvent_hospitalId_createdAt_idx" ON "CareEvent"("hospitalId", "createdAt");

-- CreateIndex
CREATE INDEX "CareEvent_publishedAt_idx" ON "CareEvent"("publishedAt");

-- AddForeignKey
ALTER TABLE "HospitalRole" ADD CONSTRAINT "HospitalRole_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalMember" ADD CONSTRAINT "HospitalMember_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalMember" ADD CONSTRAINT "HospitalMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "HospitalRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentMember" ADD CONSTRAINT "DepartmentMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HospitalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HospitalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseDoctorAssignment" ADD CONSTRAINT "NurseDoctorAssignment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseDoctorAssignment" ADD CONSTRAINT "NurseDoctorAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseDoctorAssignment" ADD CONSTRAINT "NurseDoctorAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "HospitalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePatient" ADD CONSTRAINT "CarePatient_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAppointment" ADD CONSTRAINT "CareAppointment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAppointment" ADD CONSTRAINT "CareAppointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAppointment" ADD CONSTRAINT "CareAppointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAppointment" ADD CONSTRAINT "CareAppointment_assignedNurseId_fkey" FOREIGN KEY ("assignedNurseId") REFERENCES "HospitalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareAppointment" ADD CONSTRAINT "CareAppointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CareAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalEncounter" ADD CONSTRAINT "ClinicalEncounter_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "HospitalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "HospitalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "ClinicalEncounter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_authorMemberId_fkey" FOREIGN KEY ("authorMemberId") REFERENCES "HospitalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticService" ADD CONSTRAINT "DiagnosticService_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticService" ADD CONSTRAINT "DiagnosticService_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "DiagnosticService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CareAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_orderedByMemberId_fkey" FOREIGN KEY ("orderedByMemberId") REFERENCES "HospitalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticOrder" ADD CONSTRAINT "DiagnosticOrder_completedByMemberId_fkey" FOREIGN KEY ("completedByMemberId") REFERENCES "HospitalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ward" ADD CONSTRAINT "Ward_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bed" ADD CONSTRAINT "Bed_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedRequest" ADD CONSTRAINT "BedRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "HospitalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalPayment" ADD CONSTRAINT "HospitalPayment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalPayment" ADD CONSTRAINT "HospitalPayment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "CarePatient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalPayment" ADD CONSTRAINT "HospitalPayment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "CareAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalTransaction" ADD CONSTRAINT "HospitalTransaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "HospitalPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HospitalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNotice" ADD CONSTRAINT "HospitalNotice_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNotice" ADD CONSTRAINT "HospitalNotice_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "HospitalMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNotification" ADD CONSTRAINT "HospitalNotification_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalNotification" ADD CONSTRAINT "HospitalNotification_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "HospitalMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "HospitalRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorMemberId_fkey" FOREIGN KEY ("actorMemberId") REFERENCES "HospitalMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareEvent" ADD CONSTRAINT "CareEvent_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

