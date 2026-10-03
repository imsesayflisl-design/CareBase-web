import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import db from "@/lib/db";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function localDateTime(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Unauthorized", 401);
  const hospitalId = new URL(request.url).searchParams.get("hospitalId") ?? "";
  if (!hospitalId) return jsonError("hospitalId is required", 400);

  const patient = await db.carePatient.findFirst({
    where: { hospitalId, externalUserId: userId, hospital: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (!patient) return jsonError("Hospital patient record not found", 404);

  const appointments = await db.careAppointment.findMany({
    where: { hospitalId, patientId: patient.id },
    select: {
      id: true,
      appointmentDate: true,
      time: true,
      durationMinutes: true,
      reason: true,
      appointmentType: true,
      status: true,
      rejectionReason: true,
      doctor: { select: { specialty: true, member: { select: { fullName: true } } } },
      department: { select: { name: true } },
    },
    orderBy: [{ appointmentDate: "desc" }, { time: "desc" }],
    take: 100,
  });
  return NextResponse.json(
    { appointments },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Send a valid JSON request", 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonError("Send a valid JSON request", 400);
  }
  const input = body as Record<string, unknown>;
  const hospitalId = typeof input.hospitalId === "string" ? input.hospitalId.trim() : "";
  const doctorId = typeof input.doctorId === "string" ? input.doctorId.trim() : "";
  const departmentId = typeof input.departmentId === "string" ? input.departmentId.trim() : "";
  const dateValue = typeof input.date === "string" ? input.date : "";
  const time = typeof input.time === "string" ? input.time : "";
  const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 1000) : "";
  const appointmentType = typeof input.appointmentType === "string" ? input.appointmentType : "CONSULTATION";
  if (!hospitalId) return jsonError("hospitalId is required", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return jsonError("Choose a valid appointment date", 400);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return jsonError("Choose a valid appointment time", 400);
  if (!["CONSULTATION", "FOLLOW_UP", "DIAGNOSTIC", "EMERGENCY"].includes(appointmentType)) {
    return jsonError("Choose a valid appointment type", 400);
  }
  const appointmentDate = new Date(dateValue + "T12:00:00.000Z");
  if (Number.isNaN(appointmentDate.getTime()) || appointmentDate.toISOString().slice(0, 10) !== dateValue) {
    return jsonError("Choose a valid appointment date", 400);
  }

  const patient = await db.carePatient.findFirst({
    where: { hospitalId, externalUserId: userId, hospital: { status: "ACTIVE" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hospital: { select: { timezone: true } },
    },
  });
  if (!patient) return jsonError("Hospital patient record not found", 404);
  let hospitalNow: { date: string; time: string };
  try {
    hospitalNow = localDateTime(patient.hospital.timezone);
  } catch {
    return jsonError("The hospital has an invalid timezone setting", 500);
  }
  if (dateValue < hospitalNow.date || (dateValue === hospitalNow.date && time <= hospitalNow.time)) {
    return jsonError("Choose a future appointment time", 400);
  }

  const [doctor, department] = await Promise.all([
    doctorId
      ? db.doctorProfile.findFirst({
          where: { id: doctorId, hospitalId, member: { status: "ACTIVE" } },
          include: { member: { select: { id: true, fullName: true } } },
        })
      : Promise.resolve(null),
    departmentId
      ? db.department.findFirst({ where: { id: departmentId, hospitalId, status: "ACTIVE" } })
      : Promise.resolve(null),
  ]);
  if (doctorId && !doctor) return jsonError("Choose a doctor from this hospital", 400);
  if (departmentId && !department) return jsonError("Choose a department from this hospital", 400);
  if (doctor && department && doctor.departmentId && doctor.departmentId !== department.id) {
    return jsonError("The selected doctor does not belong to that department", 400);
  }

  const collisionWhere: Prisma.CareAppointmentWhereInput = {
    hospitalId,
    appointmentDate,
    time,
    status: { notIn: ["CANCELLED", "REJECTED", "NO_SHOW"] },
  };
  const collision = await db.careAppointment.findFirst({
    where: {
      ...collisionWhere,
      OR: [
        { patientId: patient.id },
        ...(doctor ? [{ doctorId: doctor.id }] : []),
      ],
    },
    select: { id: true, patientId: true },
  });
  if (collision?.patientId === patient.id) return jsonError("You already have an appointment at that time", 409);
  if (collision) return jsonError("That doctor already has an appointment at that time", 409);

  const appointment = await db.$transaction(async (tx) => {
    const created = await tx.careAppointment.create({
      data: {
        hospitalId,
        patientId: patient.id,
        doctorId: doctor?.id,
        departmentId: department?.id ?? doctor?.departmentId,
        appointmentDate,
        time,
        appointmentType,
        reason: reason || null,
        status: "REQUESTED",
      },
      select: { id: true, appointmentDate: true, time: true, status: true },
    });
    await tx.hospitalNotification.create({
      data: {
        hospitalId,
        memberId: doctor?.member.id,
        title: "Patient appointment request",
        body: patient.firstName + " " + patient.lastName + " requested " + dateValue + " at " + time + ".",
        category: "APPOINTMENT",
        href: "/hospital/appointments",
      },
    });
    await tx.auditEvent.create({
      data: {
        hospitalId,
        actorUserId: userId,
        actorName: patient.firstName + " " + patient.lastName,
        action: "appointment.requested_by_patient",
        entity: "CareAppointment",
        entityId: created.id,
        details: { patientId: patient.id, appointmentDate: dateValue, time },
      },
    });
    await tx.careEvent.create({
      data: {
        hospitalId,
        type: "appointment.requested",
        entity: "CareAppointment",
        entityId: created.id,
        payload: { patientId: patient.id, doctorId: doctor?.id, appointmentDate: dateValue, time },
      },
    });
    return created;
  });

  return NextResponse.json({ appointment }, { status: 201, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
