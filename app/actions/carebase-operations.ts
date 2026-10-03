"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import {
  createCarebaseNotification,
  publishCarebaseEvent,
  recordCarebaseAudit,
} from "@/lib/carebase/audit";
import { requireCarebasePermission } from "@/lib/carebase/context";

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();

export async function createWard(formData: FormData) {
  const context = await requireCarebasePermission("beds.manage");
  const name = field(formData, "name");
  const roomName = field(formData, "roomName") || "Room 1";
  const bedCount = Number(field(formData, "bedCount")) || 1;
  if (name.length < 2) throw new Error("Enter a ward name.");
  if (!Number.isInteger(bedCount) || bedCount < 1 || bedCount > 100) {
    throw new Error("Bed count must be from 1 to 100.");
  }
  const ward = await db.ward.create({
    data: {
      hospitalId: context.hospital.id,
      name,
      description: field(formData, "description") || null,
      location: field(formData, "location") || null,
      rooms: {
        create: {
          name: roomName,
          floor: field(formData, "floor") || null,
          beds: {
            create: Array.from({ length: bedCount }, (_, index) => ({
              label: "Bed " + String(index + 1).padStart(2, "0"),
            })),
          },
        },
      },
    },
  });
  await recordCarebaseAudit(context, "beds.ward_created", "Ward", ward.id, { name, bedCount });
  revalidatePath("/hospital");
  revalidatePath("/hospital/beds");
}

export async function updateBedStatus(formData: FormData) {
  const context = await requireCarebasePermission("beds.manage");
  const id = field(formData, "bedId");
  const status = field(formData, "status");
  const allowed = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "UNAVAILABLE"];
  if (!allowed.includes(status)) throw new Error("Choose a valid bed status.");
  const bed = await db.bed.findFirst({
    where: { id, room: { ward: { hospitalId: context.hospital.id } } },
    select: { id: true, status: true },
  });
  if (!bed) throw new Error("Bed not found in this hospital.");
  await db.bed.update({ where: { id }, data: { status: status as typeof bed.status } });
  await recordCarebaseAudit(context, "beds.status_changed", "Bed", id, { status });
  revalidatePath("/hospital");
  revalidatePath("/hospital/beds");
}

export async function createBedRequest(formData: FormData) {
  const context = await requireCarebasePermission("beds.manage");
  const patientId = field(formData, "patientId");
  const wardId = field(formData, "wardId") || null;
  const patient = await db.carePatient.findFirst({
    where: { id: patientId, hospitalId: context.hospital.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) throw new Error("Choose a patient from this hospital.");
  const ward = wardId
    ? await db.ward.findFirst({
        where: { id: wardId, hospitalId: context.hospital.id, status: "ACTIVE" },
      })
    : null;
  if (wardId && !ward) throw new Error("Choose a ward from this hospital.");
  const request = await db.bedRequest.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      wardId,
      requestedFor: field(formData, "requestedFor")
        ? new Date(field(formData, "requestedFor"))
        : null,
      reason: field(formData, "reason") || null,
    },
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    title: "New bed request",
    body: patient.firstName + " " + patient.lastName + " needs an inpatient bed.",
    category: "BED_REQUEST",
    href: "/hospital/bed-requests",
  });
  await recordCarebaseAudit(context, "beds.request_created", "BedRequest", request.id, { patientId });
  await publishCarebaseEvent(context.hospital.id, "bed.requested", "BedRequest", request.id, {
    patientId,
    wardId,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/bed-requests");
}

export async function reviewBedRequest(formData: FormData) {
  const context = await requireCarebasePermission("beds.manage");
  const id = field(formData, "requestId");
  const status = field(formData, "status");
  if (!["APPROVED", "REJECTED"].includes(status)) throw new Error("Choose approve or reject.");
  const request = await db.bedRequest.findFirst({
    where: { id, hospitalId: context.hospital.id, status: "REQUESTED" },
    include: { patient: true },
  });
  if (!request) throw new Error("Open bed request not found.");

  let chosenBedId: string | null = null;
  if (status === "APPROVED") {
    const requestedBedId = field(formData, "bedId");
    const bed = requestedBedId
      ? await db.bed.findFirst({
          where: {
            id: requestedBedId,
            status: "AVAILABLE",
            room: { ward: { hospitalId: context.hospital.id } },
          },
        })
      : await db.bed.findFirst({
          where: {
            status: "AVAILABLE",
            room: {
              ward: {
                hospitalId: context.hospital.id,
                ...(request.wardId ? { id: request.wardId } : {}),
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });
    if (!bed) throw new Error("No available bed matches this request.");
    chosenBedId = bed.id;
  }

  await db.$transaction(async (tx) => {
    if (chosenBedId) {
      const claimed = await tx.bed.updateMany({
        where: { id: chosenBedId, status: "AVAILABLE" },
        data: { status: "RESERVED" },
      });
      if (!claimed.count) throw new Error("That bed was just reserved. Refresh and choose another.");
    }
    await tx.bedRequest.update({
      where: { id },
      data: {
        status: status as "APPROVED" | "REJECTED",
        bedId: chosenBedId,
        reviewedById: context.membership.id,
        reviewedAt: new Date(),
        reviewNote: field(formData, "reviewNote") || null,
      },
    });
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    title: "Bed request " + status.toLowerCase(),
    body: request.patient.firstName + " " + request.patient.lastName + " · " + (field(formData, "reviewNote") || "Request reviewed by the hospital team."),
    category: "BED_REQUEST",
    href: "/hospital/bed-requests",
  });
  await recordCarebaseAudit(context, "beds.request_" + status.toLowerCase(), "BedRequest", id, {
    bedId: chosenBedId,
  });
  await publishCarebaseEvent(context.hospital.id, "bed.request." + status.toLowerCase(), "BedRequest", id, {
    patientId: request.patientId,
    bedId: chosenBedId,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/beds");
  revalidatePath("/hospital/bed-requests");
}

export async function createDiagnosticService(formData: FormData) {
  const context = await requireCarebasePermission("diagnostics.manage");
  const kind = field(formData, "kind");
  const name = field(formData, "name");
  const departmentId = field(formData, "departmentId") || null;
  const price = Number(field(formData, "price")) || 0;
  if (!["TEST", "SCAN"].includes(kind)) throw new Error("Choose test or scan.");
  if (name.length < 2) throw new Error("Enter the service name.");
  if (price < 0) throw new Error("Price cannot be negative.");
  if (departmentId) {
    const department = await db.department.findFirst({
      where: { id: departmentId, hospitalId: context.hospital.id },
      select: { id: true },
    });
    if (!department) throw new Error("Choose a department from this hospital.");
  }
  const service = await db.diagnosticService.create({
    data: {
      hospitalId: context.hospital.id,
      kind: kind as "TEST" | "SCAN",
      name,
      departmentId,
      description: field(formData, "description") || null,
      price,
      durationMinutes: Number(field(formData, "durationMinutes")) || null,
      preparationInstructions: field(formData, "preparationInstructions") || null,
      homeServiceAvailable: field(formData, "homeServiceAvailable") === "on",
    },
  });
  await recordCarebaseAudit(context, "diagnostics.service_created", "DiagnosticService", service.id, { kind, name });
  revalidatePath("/hospital/diagnostics");
}

export async function createDiagnosticOrder(formData: FormData) {
  const context = await requireCarebasePermission("diagnostics.manage");
  const patientId = field(formData, "patientId");
  const serviceId = field(formData, "serviceId");
  const appointmentId = field(formData, "appointmentId") || null;
  const [patient, service, appointment] = await Promise.all([
    db.carePatient.findFirst({
      where: { id: patientId, hospitalId: context.hospital.id },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.diagnosticService.findFirst({
      where: { id: serviceId, hospitalId: context.hospital.id, status: "ACTIVE" },
    }),
    appointmentId
      ? db.careAppointment.findFirst({
          where: { id: appointmentId, hospitalId: context.hospital.id, patientId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!patient || !service) throw new Error("Choose a patient and service from this hospital.");
  if (appointmentId && !appointment) throw new Error("Appointment not found for this patient.");
  const order = await db.diagnosticOrder.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      serviceId,
      appointmentId,
      orderedByMemberId: context.membership.id,
      scheduledAt: field(formData, "scheduledAt")
        ? new Date(field(formData, "scheduledAt"))
        : null,
      notes: field(formData, "notes") || null,
    },
  });
  await createCarebaseNotification({
    hospitalId: context.hospital.id,
    title: "Diagnostic order received",
    body: patient.firstName + " " + patient.lastName + " · " + service.name,
    category: service.kind,
    href: "/hospital/diagnostics",
  });
  await recordCarebaseAudit(context, "diagnostics.order_created", "DiagnosticOrder", order.id, {
    patientId,
    serviceId,
  });
  await publishCarebaseEvent(context.hospital.id, "diagnostic.requested", "DiagnosticOrder", order.id, {
    patientId,
    kind: service.kind,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/diagnostics");
  revalidatePath("/hospital/patients/" + patientId);
}

export async function updateDiagnosticOrder(formData: FormData) {
  const context = await requireCarebasePermission("diagnostics.manage");
  const id = field(formData, "orderId");
  const status = field(formData, "status");
  if (!["REQUESTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(status)) {
    throw new Error("Choose a valid diagnostic status.");
  }
  const existing = await db.diagnosticOrder.findFirst({
    where: { id, hospitalId: context.hospital.id },
    include: { patient: true, service: true },
  });
  if (!existing) throw new Error("Diagnostic order not found.");
  const completed = status === "COMPLETED";
  const updated = await db.diagnosticOrder.update({
    where: { id },
    data: {
      status: status as "REQUESTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
      result: field(formData, "result") || existing.result,
      notes: field(formData, "notes") || existing.notes,
      completedByMemberId: completed ? context.membership.id : existing.completedByMemberId,
      completedAt: completed ? new Date() : existing.completedAt,
    },
  });
  await recordCarebaseAudit(context, "diagnostics.order_" + status.toLowerCase(), "DiagnosticOrder", id, {
    patientId: existing.patientId,
  });
  await publishCarebaseEvent(context.hospital.id, "diagnostic." + status.toLowerCase(), "DiagnosticOrder", id, {
    patientId: existing.patientId,
    result: completed ? updated.result : undefined,
  });
  revalidatePath("/hospital/diagnostics");
  revalidatePath("/hospital/patients/" + existing.patientId);
}

export async function saveAttendance(formData: FormData) {
  const context = await requireCarebasePermission("attendance.manage");
  const memberId = field(formData, "memberId");
  const dateValue = field(formData, "date");
  const shift = field(formData, "shift");
  const status = field(formData, "status");
  if (!dateValue || !["MORNING", "EVENING"].includes(shift)) {
    throw new Error("Choose a date and shift.");
  }
  if (!["PRESENT", "ABSENT", "LEAVE"].includes(status)) throw new Error("Choose a valid attendance status.");
  const member = await db.hospitalMember.findFirst({
    where: { id: memberId, hospitalId: context.hospital.id, status: "ACTIVE" },
    select: { id: true },
  });
  if (!member) throw new Error("Choose a staff member from this hospital.");
  const date = new Date(dateValue + "T00:00:00.000Z");
  if (Number.isNaN(date.getTime())) throw new Error("Choose a valid attendance date.");
  const checkInValue = field(formData, "checkIn");
  const checkOutValue = field(formData, "checkOut");
  const record = await db.staffAttendance.upsert({
    where: { memberId_date_shift: { memberId, date, shift: shift as "MORNING" | "EVENING" } },
    create: {
      hospitalId: context.hospital.id,
      memberId,
      date,
      shift: shift as "MORNING" | "EVENING",
      status: status as "PRESENT" | "ABSENT" | "LEAVE",
      checkInAt: checkInValue ? new Date(dateValue + "T" + checkInValue + ":00") : null,
      checkOutAt: checkOutValue ? new Date(dateValue + "T" + checkOutValue + ":00") : null,
      location: field(formData, "location") || null,
      notes: field(formData, "notes") || null,
    },
    update: {
      status: status as "PRESENT" | "ABSENT" | "LEAVE",
      checkInAt: checkInValue ? new Date(dateValue + "T" + checkInValue + ":00") : null,
      checkOutAt: checkOutValue ? new Date(dateValue + "T" + checkOutValue + ":00") : null,
      location: field(formData, "location") || null,
      notes: field(formData, "notes") || null,
    },
  });
  await recordCarebaseAudit(context, "attendance.saved", "StaffAttendance", record.id, { memberId, status });
  revalidatePath("/hospital/attendance");
  revalidatePath("/hospital/reports");
}

export async function createHospitalPayment(formData: FormData) {
  const context = await requireCarebasePermission("payments.manage");
  const patientId = field(formData, "patientId");
  const amount = Number(field(formData, "amount"));
  const patient = await db.carePatient.findFirst({
    where: { id: patientId, hospitalId: context.hospital.id },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!patient) throw new Error("Choose a patient from this hospital.");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a payment amount greater than zero.");
  const status = field(formData, "status");
  if (!["PENDING", "PAID", "PARTIAL"].includes(status)) throw new Error("Choose a valid payment status.");
  const receiptNumber = "REC-SL-" + new Date().getFullYear() + "-" + randomUUID().slice(0, 7).toUpperCase();
  const method = field(formData, "method") || "CASH";
  const payment = await db.hospitalPayment.create({
    data: {
      hospitalId: context.hospital.id,
      patientId,
      receiptNumber,
      serviceName: field(formData, "serviceName") || "Hospital service",
      amount,
      currency: context.hospital.currency,
      method,
      status: status as "PENDING" | "PAID" | "PARTIAL",
      paidAt: status === "PAID" ? new Date() : null,
      notes: field(formData, "notes") || null,
      transactions: {
        create: {
          amount,
          method,
          status: status as "PENDING" | "PAID" | "PARTIAL",
          notes: field(formData, "notes") || null,
        },
      },
    },
  });
  await recordCarebaseAudit(context, "payments.created", "HospitalPayment", payment.id, {
    amount,
    receiptNumber,
  });
  await publishCarebaseEvent(context.hospital.id, "payment.created", "HospitalPayment", payment.id, {
    patientId,
    receiptNumber,
    amount,
    status,
  });
  revalidatePath("/hospital");
  revalidatePath("/hospital/payments");
  revalidatePath("/hospital/patients/" + patient.id);
}

export async function updatePaymentStatus(formData: FormData) {
  const context = await requireCarebasePermission("payments.manage");
  const id = field(formData, "paymentId");
  const status = field(formData, "status");
  if (!["PENDING", "PAID", "PARTIAL", "FAILED", "REFUNDED"].includes(status)) {
    throw new Error("Choose a valid payment status.");
  }
  const payment = await db.hospitalPayment.findFirst({
    where: { id, hospitalId: context.hospital.id },
    select: { id: true },
  });
  if (!payment) throw new Error("Payment not found in this hospital.");
  const updated = await db.hospitalPayment.update({
    where: { id },
    data: {
      status: status as "PENDING" | "PAID" | "PARTIAL" | "FAILED" | "REFUNDED",
      paidAt: status === "PAID" ? new Date() : undefined,
    },
  });
  await db.hospitalTransaction.create({
    data: {
      paymentId: id,
      amount: updated.amount,
      method: updated.method || "MANUAL",
      status: status as "PENDING" | "PAID" | "PARTIAL" | "FAILED" | "REFUNDED",
      notes: "Status updated by " + context.membership.fullName,
    },
  });
  await recordCarebaseAudit(context, "payments.status_changed", "HospitalPayment", id, { status });
  revalidatePath("/hospital/payments");
  revalidatePath("/hospital/reports");
}

export async function createHospitalNotice(formData: FormData) {
  const context = await requireCarebasePermission("notices.manage");
  const title = field(formData, "title");
  const body = field(formData, "body");
  if (title.length < 3 || body.length < 8) throw new Error("Add a title and notice details.");
  const audience = formData.getAll("audience").map(String);
  const validRoles = await db.hospitalRole.findMany({
    where: { hospitalId: context.hospital.id, name: { in: audience } },
    select: { name: true },
  });
  const audienceRoles = validRoles.map((role) => role.name);
  const publishNow = field(formData, "publish") === "on";
  const notice = await db.hospitalNotice.create({
    data: {
      hospitalId: context.hospital.id,
      authorId: context.membership.id,
      title,
      body,
      audience: audienceRoles,
      status: publishNow ? "PUBLISHED" : "DRAFT",
      publishAt: publishNow ? new Date() : null,
      expiresAt: field(formData, "expiresAt") ? new Date(field(formData, "expiresAt")) : null,
    },
  });
  if (publishNow) {
    if (audienceRoles.length) {
      const recipients = await db.hospitalMember.findMany({
        where: {
          hospitalId: context.hospital.id,
          status: "ACTIVE",
          role: { name: { in: audienceRoles } },
        },
        select: { id: true },
      });
      if (recipients.length) {
        await db.hospitalNotification.createMany({
          data: recipients.map((member) => ({
            hospitalId: context.hospital.id,
            memberId: member.id,
            title: "Hospital notice: " + title,
            body,
            category: "NOTICE",
            href: "/hospital/notices",
          })),
        });
      }
    } else {
      await createCarebaseNotification({
        hospitalId: context.hospital.id,
        title: "Hospital notice: " + title,
        body,
        category: "NOTICE",
        href: "/hospital/notices",
      });
    }
    await publishCarebaseEvent(context.hospital.id, "notice.published", "HospitalNotice", notice.id, { title });
  }
  await recordCarebaseAudit(context, publishNow ? "notice.published" : "notice.created", "HospitalNotice", notice.id);
  revalidatePath("/hospital/notices");
  revalidatePath("/hospital/notifications");
}

export async function markNotificationRead(formData: FormData) {
  const context = await requireCarebasePermission("notifications.read");
  const id = field(formData, "notificationId");
  const notification = await db.hospitalNotification.findFirst({
    where: {
      id,
      hospitalId: context.hospital.id,
      OR: [{ memberId: null }, { memberId: context.membership.id }],
    },
    select: { id: true },
  });
  if (!notification) throw new Error("Notification not found.");
  await db.hospitalNotification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/hospital/notifications");
}

export async function updateHospitalSettings(formData: FormData) {
  const context = await requireCarebasePermission("hospital.manage");
  const name = field(formData, "name");
  if (name.length < 2) throw new Error("Hospital name is required.");
  const currency = field(formData, "currency");
  if (!["SLE", "USD", "LRD", "GNF"].includes(currency)) throw new Error("Choose a supported currency.");
  const updated = await db.hospital.update({
    where: { id: context.hospital.id },
    data: {
      name,
      type: field(formData, "type") || null,
      description: field(formData, "description") || null,
      address: field(formData, "address") || null,
      city: field(formData, "city") || null,
      region: field(formData, "region") || null,
      country: field(formData, "country") || "Sierra Leone",
      phone: field(formData, "phone") || null,
      email: field(formData, "email").toLowerCase() || null,
      emergencyContact: field(formData, "emergencyContact") || null,
      website: field(formData, "website") || null,
      currency,
    },
  });
  await recordCarebaseAudit(context, "hospital.settings_updated", "Hospital", updated.id);
  revalidatePath("/hospital");
  revalidatePath("/hospital/settings");
}
