"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import {
  createCarebaseNotification,
  publishCarebaseEvent,
  recordCarebaseAudit,
} from "@/lib/carebase/audit";
import { requireCarebasePermission } from "@/lib/carebase/context";

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

function asCalendarDate(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid " + label + ".");
  const result = new Date(value + "T12:00:00.000Z");
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid " + label + ".");
  }
  return result;
}

export async function createCarePatient(formData: FormData) {
  const context = await requireCarebasePermission("patients.manage");
  const firstName = field(formData, "firstName");
  const lastName = field(formData, "lastName");
  const phone = field(formData, "phone");
  if (firstName.length < 2 || lastName.length < 2) {
    throw new Error("Enter the patient's first and last name.");
  }
  if (phone && phone.length < 6) throw new Error("Enter a valid phone number.");

  const nextNumber = (await db.carePatient.count({
    where: { hospitalId: context.hospital.id },
  })) + 1;
  const patientCode = "PAT-SL-" + new Date().getFullYear() + "-" + String(nextNumber).padStart(6, "0");
  const patient = await db.carePatient.create({
    data: {
      hospitalId: context.hospital.id,
      patientCode,
      firstName,
      lastName,
      phone: phone || null,
      email: field(formData, "email").toLowerCase() || null,
      gender: field(formData, "gender") || null,
      dateOfBirth: field(formData, "dateOfBirth")
        ? asCalendarDate(field(formData, "dateOfBirth"), "date of birth")
        : null,
      address: field(formData, "address") || null,
      emergencyContactName: field(formData, "emergencyContactName") || null,
      emergencyContactPhone: field(formData, "emergencyContactPhone") || null,
    },
  });
  await recordCarebaseAudit(context, "patient.created", "CarePatient", patient.id, {
    patientCode,
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    title: "Patient registered",
    body: patient.firstName + " " + patient.lastName + " was added to the patient directory.",
    category: "PATIENT",
    href: "/hospital/patients/" + patient.id,
  });
  await publishCarebaseEvent(context.hospital.id, "patient.created", "CarePatient", patient.id, {
    patientCode,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/patients");
}

export async function updateCarePatient(formData: FormData) {
  const context = await requireCarebasePermission("patients.manage");
  const id = field(formData, "id");
  const patient = await db.carePatient.findFirst({
    where: { id, hospitalId: context.hospital.id },
    select: { id: true },
  });
  if (!patient) throw new Error("Patient not found in this hospital.");
  const updated = await db.carePatient.update({
    where: { id: patient.id },
    data: {
      firstName: field(formData, "firstName"),
      lastName: field(formData, "lastName"),
      phone: field(formData, "phone") || null,
      email: field(formData, "email").toLowerCase() || null,
      address: field(formData, "address") || null,
      emergencyContactName: field(formData, "emergencyContactName") || null,
      emergencyContactPhone: field(formData, "emergencyContactPhone") || null,
    },
  });
  await recordCarebaseAudit(context, "patient.updated", "CarePatient", updated.id);
  revalidatePath("/hospital/patients");
  revalidatePath("/hospital/patients/" + updated.id);
}

export async function linkCarePatientAccount(formData: FormData) {
  const context = await requireCarebasePermission("patients.manage");
  const id = field(formData, "id");
  const patient = await db.carePatient.findFirst({
    where: { id, hospitalId: context.hospital.id },
    select: { id: true, email: true, externalUserId: true },
  });
  if (!patient) throw new Error("Patient not found in this hospital.");
  if (!patient.email) throw new Error("Add the patient's email address before linking an account.");

  const existingAccount = await db.patient.findFirst({
    where: { email: { equals: patient.email, mode: "insensitive" } },
    select: { id: true },
  });
  if (!existingAccount) throw new Error("No registered patient account uses this email address.");
  const client = await clerkClient();
  const account = await client.users.getUser(existingAccount.id);
  const verifiedMatch = account.emailAddresses.some(
    (address) =>
      address.emailAddress.toLowerCase() === patient.email?.toLowerCase() &&
      address.verification?.status === "verified"
  );
  if (!verifiedMatch) throw new Error("The matching Clerk account does not have a verified email address.");
  if (patient.externalUserId && patient.externalUserId !== account.id) {
    throw new Error("This patient is already linked to another account. Contact a hospital administrator to review it.");
  }
  const linkedElsewhere = await db.carePatient.findFirst({
    where: {
      hospitalId: context.hospital.id,
      externalUserId: account.id,
      id: { not: patient.id },
    },
    select: { id: true },
  });
  if (linkedElsewhere) throw new Error("This account is already linked to another patient in this hospital.");

  await db.carePatient.update({
    where: { id: patient.id },
    data: { externalUserId: account.id },
  });
  await recordCarebaseAudit(context, "patient.account_linked", "CarePatient", patient.id);
  await publishCarebaseEvent(context.hospital.id, "patient.account.linked", "CarePatient", patient.id);
  revalidatePath("/hospital/patients/" + patient.id);
  revalidatePath("/hospital/patients");
}

export async function createAppointment(formData: FormData) {
  const context = await requireCarebasePermission("appointments.manage");
  const patientId = field(formData, "patientId");
  const doctorId = field(formData, "doctorId");
  const date = asCalendarDate(field(formData, "appointmentDate"), "appointment date");
  const time = field(formData, "time");
  if (!time) throw new Error("Choose an appointment time.");

  const [patient, doctor, department] = await Promise.all([
    db.carePatient.findFirst({
      where: { id: patientId, hospitalId: context.hospital.id },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.doctorProfile.findFirst({
      where: { id: doctorId, hospitalId: context.hospital.id, member: { status: "ACTIVE" } },
      include: { member: true },
    }),
    field(formData, "departmentId")
      ? db.department.findFirst({
          where: { id: field(formData, "departmentId"), hospitalId: context.hospital.id, status: "ACTIVE" },
        })
      : Promise.resolve(null),
  ]);
  if (!patient) throw new Error("Choose a patient from this hospital.");
  if (!doctor) throw new Error("Choose a doctor from this hospital.");
  const collision = await db.careAppointment.findFirst({
    where: {
      hospitalId: context.hospital.id,
      doctorId,
      appointmentDate: date,
      time,
      status: { notIn: ["CANCELLED", "REJECTED", "NO_SHOW"] },
    },
    select: { id: true },
  });
  if (collision) throw new Error("This doctor already has an appointment at that time.");

  const appointment = await db.careAppointment.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      doctorId,
      departmentId: department?.id ?? doctor.departmentId,
      appointmentDate: date,
      time,
      durationMinutes: Math.max(10, Number(field(formData, "durationMinutes")) || 30),
      appointmentType: field(formData, "appointmentType") || "CONSULTATION",
      reason: field(formData, "reason") || null,
      status: "REQUESTED",
    },
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    memberId: doctor.memberId,
    title: "New appointment request",
    body: patient.firstName + " " + patient.lastName + " requested " + date.toLocaleDateString() + " at " + time + ".",
    category: "APPOINTMENT",
    href: "/hospital/appointments",
  });
  await recordCarebaseAudit(context, "appointment.created", "CareAppointment", appointment.id, {
    patientId,
    doctorId,
  });
  await publishCarebaseEvent(context.hospital.id, "appointment.requested", "CareAppointment", appointment.id, {
    patientId,
    doctorMemberId: doctor.memberId,
    appointmentDate: appointment.appointmentDate.toISOString(),
    time,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/appointments");
}

export async function updateAppointmentStatus(formData: FormData) {
  const context = await requireCarebasePermission("appointments.manage");
  const id = field(formData, "id");
  const status = field(formData, "status");
  const allowed = ["PENDING", "CONFIRMED", "REJECTED", "RESCHEDULED", "CANCELLED", "COMPLETED", "NO_SHOW"];
  if (!allowed.includes(status)) throw new Error("Choose a valid appointment status.");
  const appointment = await db.careAppointment.findFirst({
    where: { id, hospitalId: context.hospital.id },
    include: { patient: true, doctor: { include: { member: true } } },
  });
  if (!appointment) throw new Error("Appointment not found in this hospital.");

  const dateValue = field(formData, "appointmentDate");
  const timeValue = field(formData, "time");
  const updateData: {
    status: typeof appointment.status;
    rejectionReason?: string | null;
    appointmentDate?: Date;
    time?: string;
  } = {
    status: status as typeof appointment.status,
    rejectionReason: field(formData, "reason") || null,
  };
  if (status === "RESCHEDULED") {
    updateData.appointmentDate = asCalendarDate(dateValue, "appointment date");
    if (!timeValue) throw new Error("Choose a new appointment time.");
    updateData.time = timeValue;
  }
  const updated = await db.careAppointment.update({
    where: { id: appointment.id },
    data: updateData,
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    memberId: appointment.doctor?.memberId,
    title: "Appointment " + status.toLowerCase().replaceAll("_", " "),
    body: appointment.patient.firstName + " " + appointment.patient.lastName + " · " + updated.appointmentDate.toLocaleDateString() + " at " + updated.time,
    category: "APPOINTMENT",
    href: "/hospital/appointments",
  });
  await recordCarebaseAudit(context, "appointment." + status.toLowerCase(), "CareAppointment", id, {
    status,
    reason: updateData.rejectionReason,
  });
  await publishCarebaseEvent(context.hospital.id, "appointment." + status.toLowerCase(), "CareAppointment", id, {
    status,
    appointmentDate: updated.appointmentDate.toISOString(),
    time: updated.time,
    patientCode: appointment.patient.patientCode,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/appointments");
  revalidatePath("/hospital/records");
}

export async function createClinicalEncounter(formData: FormData) {
  const context = await requireCarebasePermission("clinical.manage");
  const patientId = field(formData, "patientId");
  const appointmentId = field(formData, "appointmentId") || null;
  const [patient, appointment] = await Promise.all([
    db.carePatient.findFirst({
      where: { id: patientId, hospitalId: context.hospital.id },
      select: { id: true },
    }),
    appointmentId
      ? db.careAppointment.findFirst({
          where: { id: appointmentId, hospitalId: context.hospital.id, patientId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!patient) throw new Error("Patient not found in this hospital.");
  if (appointmentId && !appointment) throw new Error("Appointment is not associated with this patient.");

  const diagnosis = field(formData, "diagnosis");
  const treatmentPlan = field(formData, "treatmentPlan");
  const encounter = await db.clinicalEncounter.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      appointmentId,
      authorMemberId: context.membership.id,
      reason: field(formData, "reason") || null,
      assessment: field(formData, "assessment") || null,
      diagnosis: diagnosis || null,
      treatmentPlan: treatmentPlan || null,
      followUpPlan: field(formData, "followUpPlan") || null,
      notes: field(formData, "note")
        ? {
            create: {
              hospitalId: context.hospital.id,
              patientId,
              authorMemberId: context.membership.id,
              category: "CONSULTATION",
              content: field(formData, "note"),
            },
          }
        : undefined,
    },
  });
  await recordCarebaseAudit(context, "clinical.encounter_created", "ClinicalEncounter", encounter.id, { patientId });
  await publishCarebaseEvent(context.hospital.id, "clinical.encounter.created", "ClinicalEncounter", encounter.id, {
    patientId,
  });
  revalidatePath("/hospital/patients/" + patientId);
  revalidatePath("/hospital/records");
}

export async function createPrescription(formData: FormData) {
  const context = await requireCarebasePermission("clinical.manage");
  const patientId = field(formData, "patientId");
  const encounterId = field(formData, "encounterId") || null;
  const patient = await db.carePatient.findFirst({
    where: { id: patientId, hospitalId: context.hospital.id },
    select: { id: true },
  });
  const encounter = encounterId
    ? await db.clinicalEncounter.findFirst({
        where: { id: encounterId, hospitalId: context.hospital.id, patientId },
        select: { id: true },
      })
    : null;
  if (!patient) throw new Error("Patient not found in this hospital.");
  if (encounterId && !encounter) throw new Error("Clinical encounter not found.");
  const medication = field(formData, "medication");
  const dosage = field(formData, "dosage");
  const frequency = field(formData, "frequency");
  const duration = field(formData, "duration");
  if (!medication || !dosage || !frequency || !duration) {
    throw new Error("Medication, dosage, frequency and duration are required.");
  }
  const prescription = await db.prescription.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      encounterId,
      authorMemberId: context.membership.id,
      medication,
      dosage,
      frequency,
      duration,
      instructions: field(formData, "instructions") || null,
    },
  });
  await recordCarebaseAudit(context, "clinical.prescription_created", "Prescription", prescription.id, { patientId });
  await publishCarebaseEvent(context.hospital.id, "prescription.created", "Prescription", prescription.id, {
    patientId,
  });
  revalidatePath("/hospital/patients/" + patientId);
  revalidatePath("/hospital/records");
}
