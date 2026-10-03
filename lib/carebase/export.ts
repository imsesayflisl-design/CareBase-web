import "server-only";

import { format } from "date-fns";
import db from "@/lib/db";
import type { CarebaseContext } from "./context";
import { departmentScope, isHospitalWide, memberDepartmentIds } from "./departments";
import { BOLD, HEADER, buildXlsx, type Cell, type Sheet } from "./xlsx";

export const EXPORT_DATASETS = [
  "patients",
  "staff",
  "attendance",
  "diagnostics",
  "hospital",
  "department",
] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

/** Minimum permission required to download each dataset. */
export const EXPORT_PERMISSIONS: Record<ExportDataset, string> = {
  patients: "patients.read",
  staff: "staff.read",
  attendance: "attendance.read",
  diagnostics: "diagnostics.read",
  hospital: "reports.read",
  department: "reports.read",
};

export type ExportFilters = {
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  memberId?: string;
  doctorId?: string;
  patientId?: string;
  kind?: string;
  status?: string;
  shift?: string;
};

export type ExportResult = { fileName: string; buffer: Buffer };

const MAX_EXPORT_ROWS = 20000;

function dayStart(value?: string): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function dayEnd(value?: string): Date | undefined {
  const start = dayStart(value);
  if (!start) return undefined;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

function dateRange(filters: ExportFilters): { gte?: Date; lt?: Date } {
  const gte = dayStart(filters.dateFrom);
  const lt = dayEnd(filters.dateTo);
  return { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) };
}

/**
 * Validates the requested department against the caller's own access, then
 * returns a department id (or null for "all departments the caller may see").
 * A department-bound member can never export another department.
 */
export function resolveExportDepartment(
  context: CarebaseContext,
  requested?: string
): { departmentId: string | null } {
  if (!requested) {
    if (isHospitalWide(context)) return { departmentId: null };
    const ids = memberDepartmentIds(context);
    return { departmentId: ids.length === 1 ? ids[0] : null };
  }
  const allowed = isHospitalWide(context)
    ? true
    : memberDepartmentIds(context).includes(requested);
  if (!allowed) throw new Error("You cannot export data for that department.");
  return { departmentId: requested };
}

/** Builds a sheet with hospital name, export date and a styled column header. */
function sheet(
  hospitalName: string,
  title: string,
  columns: string[],
  rows: (string | number | null)[][],
  filterSummary = ""
): Sheet {
  return {
    name: title.slice(0, 31),
    rows: [
      [{ value: hospitalName, style: BOLD }],
      [{ value: title, style: BOLD }],
      [
        {
          value:
            "Exported " +
            format(new Date(), "yyyy-MM-dd HH:mm") +
            (filterSummary ? "  |  " + filterSummary : ""),
          style: BOLD,
        },
      ],
      [],
      columns.map((column) => ({ value: column, style: HEADER })),
      ...rows.map((row) => row as Cell[]),
    ],
  };
}

function describeFilters(filters: ExportFilters): string {
  const parts: string[] = [];
  if (filters.dateFrom || filters.dateTo) {
    parts.push("dates " + (filters.dateFrom ?? "…") + " → " + (filters.dateTo ?? "…"));
  }
  if (filters.status) parts.push("status " + filters.status);
  if (filters.shift) parts.push("shift " + filters.shift);
  if (filters.kind) parts.push("type " + filters.kind);
  if (filters.memberId) parts.push("staff filter");
  if (filters.doctorId) parts.push("doctor filter");
  if (filters.patientId) parts.push("patient filter");
  return parts.join(", ");
}

const emptyDateRange = { gte: undefined, lt: undefined } as const;

export { dateRange, MAX_EXPORT_ROWS, describeFilters, sheet, dayStart, dayEnd, emptyDateRange };

const joinSet = (values: Set<string>) =>
  values.size ? Array.from(values).filter(Boolean).sort().join(", ") : "";

async function buildPatientsSheet(
  context: CarebaseContext,
  filters: ExportFilters
): Promise<Sheet> {
  const range = dateRange(filters);
  const patients = await db.carePatient.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(filters.patientId ? { id: filters.patientId } : {}),
      // A patient belongs to a department through their appointments.
      ...(filters.departmentId
        ? { appointments: { some: { departmentId: filters.departmentId } } }
        : {}),
      ...(Object.keys(range).length ? { createdAt: range } : {}),
    },
    include: { _count: { select: { appointments: true, encounters: true } } },
    orderBy: { createdAt: "asc" },
    take: MAX_EXPORT_ROWS,
  });

  const patientIds = patients.map((patient) => patient.id);
  const [appointments, orders, encounters] = await Promise.all([
    patientIds.length
      ? db.careAppointment.findMany({
          where: { hospitalId: context.hospital.id, patientId: { in: patientIds } },
          select: {
            patientId: true,
            department: { select: { name: true } },
            doctor: { select: { member: { select: { fullName: true } } } },
          },
          take: MAX_EXPORT_ROWS,
        })
      : Promise.resolve([]),
    patientIds.length
      ? db.diagnosticOrder.findMany({
          where: { hospitalId: context.hospital.id, patientId: { in: patientIds } },
          select: { patientId: true, service: { select: { name: true } }, status: true },
          take: MAX_EXPORT_ROWS,
        })
      : Promise.resolve([]),
    patientIds.length
      ? db.clinicalEncounter.findMany({
          where: { hospitalId: context.hospital.id, patientId: { in: patientIds } },
          select: { patientId: true, diagnosis: true },
          take: MAX_EXPORT_ROWS,
        })
      : Promise.resolve([]),
  ]);

  const departmentsByPatient = new Map<string, Set<string>>();
  const doctorsByPatient = new Map<string, Set<string>>();
  for (const appointment of appointments) {
    const departments = departmentsByPatient.get(appointment.patientId) ?? new Set<string>();
    if (appointment.department) departments.add(appointment.department.name);
    departmentsByPatient.set(appointment.patientId, departments);
    if (appointment.doctor) {
      const doctors = doctorsByPatient.get(appointment.patientId) ?? new Set<string>();
      doctors.add(appointment.doctor.member.fullName);
      doctorsByPatient.set(appointment.patientId, doctors);
    }
  }
  const testsByPatient = new Map<string, Set<string>>();
  for (const order of orders) {
    const tests = testsByPatient.get(order.patientId) ?? new Set<string>();
    tests.add(order.service.name + " (" + order.status + ")");
    testsByPatient.set(order.patientId, tests);
  }
  const diagnosesByPatient = new Map<string, Set<string>>();
  for (const encounter of encounters) {
    if (!encounter.diagnosis) continue;
    const diagnoses = diagnosesByPatient.get(encounter.patientId) ?? new Set<string>();
    diagnoses.add(encounter.diagnosis);
    diagnosesByPatient.set(encounter.patientId, diagnoses);
  }

  const rows = patients.map((patient) => [
    patient.patientCode,
    patient.firstName + " " + patient.lastName,
    patient.gender ?? "",
    patient.dateOfBirth ? format(patient.dateOfBirth, "yyyy-MM-dd") : "",
    patient.phone ?? "",
    patient.email ?? "",
    patient.address ?? "",
    joinSet(departmentsByPatient.get(patient.id) ?? new Set()),
    joinSet(doctorsByPatient.get(patient.id) ?? new Set()),
    patient._count.appointments,
    joinSet(testsByPatient.get(patient.id) ?? new Set()),
    joinSet(diagnosesByPatient.get(patient.id) ?? new Set()),
    format(patient.createdAt, "yyyy-MM-dd"),
  ]);

  return sheet(
    context.hospital.name,
    "Patient records",
    [
      "Patient ID",
      "Name",
      "Gender",
      "Date of birth",
      "Phone",
      "Email",
      "Address",
      "Department(s)",
      "Doctor(s)",
      "Appointments",
      "Tests & scans",
      "Diagnoses",
      "Registered",
    ],
    rows,
    describeFilters(filters)
  );
}

async function buildStaffSheet(
  context: CarebaseContext,
  filters: ExportFilters
): Promise<Sheet> {
  const members = await db.hospitalMember.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(filters.departmentId
        ? { departmentMemberships: { some: { departmentId: filters.departmentId } } }
        : {}),
      ...(filters.memberId ? { id: filters.memberId } : {}),
    },
    include: {
      role: true,
      departmentMemberships: { include: { department: { select: { name: true } } } },
    },
    orderBy: { fullName: "asc" },
    take: MAX_EXPORT_ROWS,
  });

  const rows = members.map((member) => [
    member.fullName,
    member.role.name,
    member.title ?? "",
    member.email,
    member.phone ?? "",
    joinSet(
      new Set(
        member.departmentMemberships.map((item) => item.department.name)
      )
    ),
    member.status,
    format(member.createdAt, "yyyy-MM-dd"),
  ]);

  return sheet(
    context.hospital.name,
    "Staff records",
    [
      "Name",
      "Role",
      "Title",
      "Email",
      "Phone",
      "Department(s)",
      "Status",
      "Joined",
    ],
    rows,
    describeFilters(filters)
  );
}

async function buildAttendanceSheet(
  context: CarebaseContext,
  filters: ExportFilters
): Promise<Sheet> {
  const range = dateRange(filters);
  const entries = await db.staffAttendance.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.memberId ? { memberId: filters.memberId } : {}),
      ...(filters.status
        ? { status: filters.status as "PRESENT" | "ABSENT" | "LATE" | "LEAVE" }
        : {}),
      ...(filters.shift
        ? { shift: filters.shift as "MORNING" | "EVENING" }
        : {}),
      ...(Object.keys(range).length
        ? range.gte || range.lt
          ? { date: range as { gte?: Date; lt?: Date } }
          : {}
        : {}),
    },
    include: { member: { select: { fullName: true, role: { select: { name: true } } } } },
    orderBy: [{ date: "desc" }, { member: { fullName: "asc" } }],
    take: MAX_EXPORT_ROWS,
  });

  const rows = entries.map((entry) => [
    format(entry.date, "yyyy-MM-dd"),
    entry.member.fullName,
    entry.member.role.name,
    entry.shift,
    entry.status,
    entry.checkInAt ? format(entry.checkInAt, "HH:mm") : "",
    entry.checkOutAt ? format(entry.checkOutAt, "HH:mm") : "",
    entry.location ?? "",
    entry.notes ?? "",
    entry.updatedByMemberId ? "Modified" : "Original",
    format(entry.createdAt, "yyyy-MM-dd HH:mm"),
  ]);

  return sheet(
    context.hospital.name,
    "Attendance records",
    [
      "Date",
      "Staff member",
      "Role",
      "Shift",
      "Status",
      "Check-in",
      "Check-out",
      "Location",
      "Notes",
      "Record state",
      "Created",
    ],
    rows,
    describeFilters(filters)
  );
}

async function buildDiagnosticsSheet(
  context: CarebaseContext,
  filters: ExportFilters
): Promise<Sheet> {
  const range = dateRange(filters);
  const orders = await db.diagnosticOrder.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
      ...(filters.departmentId
        ? { service: { departmentId: filters.departmentId } }
        : {}),
      ...(filters.kind && (filters.kind === "TEST" || filters.kind === "SCAN")
        ? { service: { kind: filters.kind } }
        : {}),
      ...(filters.status
        ? {
            status: filters.status as
              | "REQUESTED"
              | "SCHEDULED"
              | "IN_PROGRESS"
              | "COMPLETED"
              | "CANCELLED",
          }
        : {}),
      ...(Object.keys(range).length ? { createdAt: range } : {}),
    },
    include: {
      patient: { select: { patientCode: true, firstName: true, lastName: true } },
      service: { select: { name: true, kind: true, department: { select: { name: true } } } },
      orderedBy: { select: { fullName: true } },
      completedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
  });

  const rows = orders.map((order) => [
    order.patient.patientCode,
    order.patient.firstName + " " + order.patient.lastName,
    order.service.kind,
    order.service.name,
    order.service.department?.name ?? "",
    order.status,
    order.result ?? "",
    order.notes ?? "",
    order.orderedBy.fullName,
    order.completedBy?.fullName ?? "",
    format(order.createdAt, "yyyy-MM-dd HH:mm"),
    order.completedAt ? format(order.completedAt, "yyyy-MM-dd HH:mm") : "",
  ]);

  return sheet(
    context.hospital.name,
    "Tests & scans records",
    [
      "Patient ID",
      "Patient",
      "Type",
      "Service",
      "Department",
      "Status",
      "Result",
      "Clinical notes",
      "Ordered by",
      "Performed by",
      "Ordered",
      "Completed",
    ],
    rows,
    describeFilters(filters)
  );
}

async function buildAppointmentsSheet(
  context: CarebaseContext,
  filters: ExportFilters,
  departmentId: string | null
): Promise<Sheet> {
  const range = dateRange(filters);
  const departmentFilter = departmentScope(context);
  const appointments = await db.careAppointment.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(departmentId
        ? { departmentId }
        : departmentFilter.departmentId
        ? departmentFilter
        : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
      ...(filters.doctorId ? { doctorId: filters.doctorId } : {}),
      ...(Object.keys(range).length
        ? range.gte || range.lt
          ? { appointmentDate: range as { gte?: Date; lt?: Date } }
          : {}
        : {}),
    },
    include: {
      patient: { select: { patientCode: true, firstName: true, lastName: true } },
      department: { select: { name: true } },
      doctor: { select: { member: { select: { fullName: true } } } },
    },
    orderBy: [{ appointmentDate: "desc" }, { time: "asc" }],
    take: MAX_EXPORT_ROWS,
  });

  const rows = appointments.map((appointment) => [
    format(appointment.appointmentDate, "yyyy-MM-dd"),
    appointment.time,
    appointment.patient.patientCode,
    appointment.patient.firstName + " " + appointment.patient.lastName,
    appointment.department?.name ?? "",
    appointment.doctor?.member.fullName ?? "",
    appointment.appointmentType,
    appointment.status,
    appointment.reason ?? "",
  ]);

  return sheet(
    context.hospital.name,
    departmentId ? "Department appointments" : "Appointment records",
    ["Date", "Time", "Patient ID", "Patient", "Department", "Doctor", "Type", "Status", "Reason"],
    rows,
    describeFilters(filters)
  );
}

async function buildDepartmentsSheet(
  context: CarebaseContext,
  departmentId: string | null
): Promise<Sheet> {
  const departments = await db.department.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(departmentId ? { id: departmentId } : {}),
    },
    include: { _count: { select: { members: true, doctors: true, appointments: true } } },
    orderBy: { name: "asc" },
  });

  const rows = departments.map((department) => [
    department.name,
    department.description ?? "",
    department.location ?? "",
    department.contact ?? "",
    department.status,
    department._count.members,
    department._count.doctors,
    department._count.appointments,
    format(department.createdAt, "yyyy-MM-dd"),
  ]);

  return sheet(
    context.hospital.name,
    "Departments",
    ["Department", "Description", "Location", "Contact", "Status", "Staff", "Doctors", "Appointments", "Created"],
    rows
  );
}

async function buildBedsSheet(context: CarebaseContext): Promise<Sheet> {
  const beds = await db.bed.findMany({
    where: { room: { ward: { hospitalId: context.hospital.id } } },
    include: { room: { select: { name: true, ward: { select: { name: true } } } } },
    orderBy: [{ room: { ward: { name: "asc" } } }, { room: { name: "asc" } }],
    take: MAX_EXPORT_ROWS,
  });

  const rows = beds.map((bed) => [
    bed.room.ward.name,
    bed.room.name,
    bed.label,
    bed.status,
  ]);

  return sheet(context.hospital.name, "Bed records", ["Ward", "Room", "Bed", "Status"], rows);
}

/**
 * Builds the workbook for a dataset.
 *
 * Tenant isolation and permission checks are the caller's responsibility
 * (`api/hospital/export` enforces both); within this function every query is
 * additionally pinned to `context.hospital.id` and to `departmentScope(context)`,
 * so a department-bound member cannot export outside their own departments.
 */
export async function buildExport(
  dataset: ExportDataset,
  context: CarebaseContext,
  filters: ExportFilters
): Promise<ExportResult> {
  let sheets: Sheet[];
  let label: string;

  switch (dataset) {
    case "patients":
      sheets = [await buildPatientsSheet(context, filters)];
      label = "patient-records";
      break;

    case "staff":
      sheets = [await buildStaffSheet(context, filters)];
      label = "staff-records";
      break;

    case "attendance":
      sheets = [await buildAttendanceSheet(context, filters)];
      label = "attendance-records";
      break;

    case "diagnostics":
      sheets = [await buildDiagnosticsSheet(context, filters)];
      label = "tests-scans";
      break;

    case "hospital":
      sheets = [
        await buildDepartmentsSheet(context, null),
        await buildStaffSheet(context, filters),
        await buildPatientsSheet(context, filters),
        await buildAppointmentsSheet(context, filters, null),
        await buildDiagnosticsSheet(context, filters),
        await buildBedsSheet(context),
        await buildAttendanceSheet(context, filters),
      ];
      label = "hospital-records";
      break;

    case "department": {
      const { departmentId } = resolveExportDepartment(context, filters.departmentId);
      sheets = [
        await buildDepartmentsSheet(context, departmentId),
        await buildStaffSheet(context, { ...filters, departmentId: departmentId ?? undefined }),
        await buildPatientsSheet(context, filters),
        await buildAppointmentsSheet(context, filters, departmentId),
        await buildDiagnosticsSheet(context, {
          ...filters,
          departmentId: departmentId ?? undefined,
        }),
        await buildAttendanceSheet(context, {
          ...filters,
          departmentId: departmentId ?? undefined,
        }),
      ];
      label = departmentId ? "department-records" : "all-departments";
      break;
    }

    default:
      throw new Error("Unknown export dataset.");
  }

  const hospitalSlug =
    context.hospital.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "hospital";

  return {
    fileName: `${hospitalSlug}-${label}-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    buffer: buildXlsx(sheets),
  };
}

