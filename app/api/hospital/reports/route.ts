import { endOfDay } from "date-fns";
import { NextResponse } from "next/server";
import { getCarebaseContext } from "@/lib/carebase/context";
import db from "@/lib/db";

type CsvRow = (string | number | null | undefined)[];

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""').replace(/\r?\n/g, " ") + '"';
}

function csvResponse(rows: CsvRow[], filename: string) {
  const content = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response("\uFEFF" + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

export async function GET(request: Request) {
  const context = await getCarebaseContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.role.permissions.includes("reports.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const fromValue = url.searchParams.get("from");
  const toValue = url.searchParams.get("to");
  const start = fromValue ? new Date(fromValue + "T00:00:00") : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = toValue ? endOfDay(new Date(toValue + "T00:00:00")) : endOfDay(new Date());
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }
  const hospitalId = context.hospital.id;

  if (type === "patients") {
    const rows = await db.carePatient.findMany({
      where: { hospitalId, createdAt: { gte: start, lte: end } },
      select: { patientCode: true, firstName: true, lastName: true, dateOfBirth: true, gender: true, phone: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    return csvResponse(
      [["Patient ID", "First name", "Last name", "Date of birth", "Gender", "Phone", "Email", "Registered at"], ...rows.map((row) => [
        row.patientCode,
        row.firstName,
        row.lastName,
        row.dateOfBirth?.toISOString().slice(0, 10),
        row.gender,
        row.phone,
        row.email,
        row.createdAt.toISOString(),
      ])],
      "carebase-patients.csv"
    );
  }

  if (type === "appointments") {
    const rows = await db.careAppointment.findMany({
      where: { hospitalId, appointmentDate: { gte: start, lte: end } },
      include: { patient: true, doctor: { include: { member: true } }, department: true },
      orderBy: { appointmentDate: "asc" },
      take: 10000,
    });
    const includeReason = context.role.permissions.includes("clinical.read");
    return csvResponse(
      [["Appointment ID", "Patient ID", "Patient", "Doctor", "Department", "Date", "Time", "Status", ...(includeReason ? ["Reason"] : [])], ...rows.map((row) => [
        row.id,
        row.patient.patientCode,
        row.patient.firstName + " " + row.patient.lastName,
        row.doctor?.member.fullName,
        row.department?.name,
        row.appointmentDate.toISOString().slice(0, 10),
        row.time,
        row.status,
        ...(includeReason ? [row.reason] : []),
      ])],
      "carebase-appointments.csv"
    );
  }

  if (type === "diagnostics") {
    if (!context.role.permissions.includes("diagnostics.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await db.diagnosticOrder.findMany({
      where: { hospitalId, createdAt: { gte: start, lte: end } },
      include: { patient: true, service: true, orderedBy: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    return csvResponse(
      [["Patient ID", "Patient", "Kind", "Service", "Status", "Ordered by", "Created at", "Result"], ...rows.map((row) => [
        row.patient.patientCode,
        row.patient.firstName + " " + row.patient.lastName,
        row.service.kind,
        row.service.name,
        row.status,
        row.orderedBy.fullName,
        row.createdAt.toISOString(),
        row.result,
      ])],
      "carebase-diagnostics.csv"
    );
  }

  if (type === "payments") {
    if (!context.role.permissions.includes("payments.read")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await db.hospitalPayment.findMany({
      where: { hospitalId, createdAt: { gte: start, lte: end } },
      include: { patient: true },
      orderBy: { createdAt: "desc" },
      take: 10000,
    });
    return csvResponse(
      [["Receipt", "Patient ID", "Patient", "Service", "Amount", "Currency", "Method", "Status", "Created at"], ...rows.map((row) => [
        row.receiptNumber,
        row.patient.patientCode,
        row.patient.firstName + " " + row.patient.lastName,
        row.serviceName,
        row.amount,
        row.currency,
        row.method,
        row.status,
        row.createdAt.toISOString(),
      ])],
      "carebase-payments.csv"
    );
  }

  if (type === "attendance") {
    const dateStart = new Date(start.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const dateEnd = new Date(end.toISOString().slice(0, 10) + "T00:00:00.000Z");
    const rows = await db.staffAttendance.findMany({
      where: { hospitalId, date: { gte: dateStart, lte: dateEnd } },
      include: { member: { include: { role: true } } },
      orderBy: [{ date: "desc" }, { member: { fullName: "asc" } }],
      take: 10000,
    });
    return csvResponse(
      [["Staff member", "Email", "Role", "Date", "Shift", "Status", "Check in", "Check out", "Location"], ...rows.map((row) => [
        row.member.fullName,
        row.member.email,
        row.member.role.name,
        row.date.toISOString().slice(0, 10),
        row.shift,
        row.status,
        row.checkInAt?.toISOString(),
        row.checkOutAt?.toISOString(),
        row.location,
      ])],
      "carebase-attendance.csv"
    );
  }

  return NextResponse.json(
    { error: "Unknown report type. Supported reports: patients, appointments, diagnostics, payments, attendance." },
    { status: 400 }
  );
}
