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
