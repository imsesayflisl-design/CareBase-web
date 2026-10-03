import { ROLE_LABELS } from "./permissions";
import { parseSpreadsheet } from "./spreadsheet";

export const STAFF_IMPORT_COLUMNS = [
  "Full name",
  "Email",
  "Role",
  "Department",
  "Phone",
  "Title",
] as const;

export const STAFF_IMPORT_MAX_ROWS = 500;

export type RoleOption = { id: string; name: string };
export type DepartmentOption = { id: string; name: string };

export type StaffImportRowResult = {
  rowNumber: number;
  fullName: string;
  email: string;
  role: string;
  roleId: string | null;
  department: string;
  departmentId: string | null;
  phone: string;
  title: string;
  status: "valid" | "warning" | "error";
  messages: string[];
};

export type StaffImportPreview = {
  total: number;
  valid: number;
  invalid: number;
  skipped: number;
  rows: StaffImportRowResult[];
};

export type StaffImportStagedRow = {
  rowNumber: number;
  fullName: string;
  email: string;
  roleId: string;
  departmentId: string | null;
  phone: string | null;
  title: string | null;
};

export type StaffImportFailure = {
  rowNumber: number;
  email: string;
  message: string;
};

/** Serializable state shared between the import server actions and the client form. */
export type StaffImportState = {
  status: "idle" | "ready" | "error" | "done";
  message?: string;
  batchId?: string;
  fileName?: string;
  preview?: StaffImportPreview;
  importedCount?: number;
  failedRows?: StaffImportFailure[];
};

export type StaffImportMapping = {
  error?: string;
  preview?: StaffImportPreview;
};

type ColumnKey = "fullName" | "email" | "role" | "department" | "phone" | "title";

const HEADER_ALIASES: Record<string, ColumnKey> = {
  fullname: "fullName",
  name: "fullName",
  staffname: "fullName",
  email: "email",
  emailaddress: "email",
  workemail: "email",
  role: "role",
  jobrole: "role",
  department: "department",
  dept: "department",
  phone: "phone",
  phonenumber: "phone",
  telephone: "phone",
  mobile: "phone",
  title: "title",
  jobtitle: "title",
  position: "title",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildRoleResolver(roles: RoleOption[]): Map<string, RoleOption> {
  const resolver = new Map<string, RoleOption>();
  for (const role of roles) {
    resolver.set(normalizeToken(role.name), role);
    const label = ROLE_LABELS[role.name];
    if (label) resolver.set(normalizeToken(label), role);
  }
  return resolver;
}

function buildDepartmentResolver(departments: DepartmentOption[]): Map<string, DepartmentOption> {
  const resolver = new Map<string, DepartmentOption>();
  for (const department of departments) {
    resolver.set(normalizeKey(department.name), department);
  }
  return resolver;
}

function csvCell(value: string): string {
  return '"' + value.replaceAll('"', '""') + '"';
}

/** A ready-to-fill, Excel-friendly template containing only the header row. */
export function buildStaffImportTemplateCsv(): string {
  return STAFF_IMPORT_COLUMNS.map((column) => csvCell(column)).join(",");
}

export function buildStaffImportExampleRow(roleName: string, departmentName: string): string {
  return [
    "Aminata Kamara",
    "aminata.kamara@example.com",
    roleName,
    departmentName,
    "+232 76 000000",
    "Senior Nurse",
  ]
    .map(csvCell)
    .join(",");
}

/** Reads an uploaded file and maps/validates every data row. */
export function mapStaffImportFile(args: {
  fileName: string;
  buffer: Buffer;
  roles: RoleOption[];
  departments: DepartmentOption[];
  existingEmails: Set<string>;
}): StaffImportMapping {
  let matrix: string[][];
  try {
    matrix = parseSpreadsheet(args.fileName, args.buffer);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not read that file." };
  }

  if (matrix.length < 2) {
    return { error: "The file has no data rows. Add staff rows below the header and try again." };
  }

  const header = matrix[0].map((cell) => normalizeKey(cell));
  const columnIndex = new Map<ColumnKey, number>();
  header.forEach((cell, index) => {
    const key = HEADER_ALIASES[cell];
    if (key && !columnIndex.has(key)) columnIndex.set(key, index);
  });

  const required: ColumnKey[] = ["fullName", "email", "role"];
  const missing = required.filter((key) => !columnIndex.has(key));
  if (missing.length) {
    const labels: Record<ColumnKey, string> = {
      fullName: "Full name",
      email: "Email",
      role: "Role",
      department: "Department",
      phone: "Phone",
      title: "Title",
    };
    return {
      error:
        "The file is missing required columns: " +
        missing.map((key) => labels[key]).join(", ") +
        ". Download the template to get the correct format.",
    };
  }

  const dataRows = matrix.slice(1);
  if (dataRows.length > STAFF_IMPORT_MAX_ROWS) {
    return {
      error:
        "This file has " + dataRows.length + " rows. Import at most " + STAFF_IMPORT_MAX_ROWS + " at a time.",
    };
  }

  const roleResolver = buildRoleResolver(args.roles);
  const departmentResolver = buildDepartmentResolver(args.departments);
  const seenEmails = new Set<string>();
  const rows: StaffImportRowResult[] = [];

  const cellAt = (cells: string[], key: ColumnKey): string => {
    const index = columnIndex.get(key);
    return index === undefined ? "" : (cells[index] ?? "").trim();
  };

  dataRows.forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const fullName = cellAt(cells, "fullName");
    const email = cellAt(cells, "email").toLowerCase();
    const roleInput = cellAt(cells, "role");
    const departmentInput = cellAt(cells, "department");
    const phone = cellAt(cells, "phone");
    const title = cellAt(cells, "title");
    const messages: string[] = [];

    if (fullName.length < 2) messages.push("Full name is required.");
    if (!email) {
      messages.push("Email is required.");
    } else if (!EMAIL_PATTERN.test(email)) {
      messages.push("Email \u201c" + email + "\u201d is not valid.");
    } else if (seenEmails.has(email)) {
      messages.push("Email appears more than once in this file.");
    }

    const role = roleInput ? roleResolver.get(normalizeToken(roleInput)) : undefined;
    if (!roleInput) {
      messages.push("Role is required.");
    } else if (!role) {
      messages.push("Role \u201c" + roleInput + "\u201d does not exist in this hospital.");
    }

    const department = departmentInput
      ? departmentResolver.get(normalizeKey(departmentInput))
      : undefined;
    if (departmentInput && !department) {
      messages.push("Department \u201c" + departmentInput + "\u201d was not found in this hospital.");
    }
    if (phone && phone.length < 6) messages.push("Phone number is too short.");

    if (email) seenEmails.add(email);

    const isDuplicateMember = !messages.length && args.existingEmails.has(email);
    if (isDuplicateMember) {
      messages.push("Already on the hospital team \u2014 this row will be skipped.");
    }

    rows.push({
      rowNumber,
      fullName,
      email,
      role: role ? role.name : roleInput,
      roleId: role ? role.id : null,
      department: department ? department.name : departmentInput,
      departmentId: department ? department.id : null,
      phone,
      title,
      status: messages.length ? (isDuplicateMember ? "warning" : "error") : "valid",
      messages,
    });
  });

  const invalid = rows.filter((row) => row.status === "error").length;
  const skipped = rows.filter((row) => row.status === "warning").length;
  return {
    preview: {
      total: rows.length,
      valid: rows.length - invalid - skipped,
      invalid,
      skipped,
      rows,
    },
  };
}

/** Extracts completed, validated rows that are ready to become members. */
export function toStagedRows(preview: StaffImportPreview): StaffImportStagedRow[] {
  return preview.rows
    .filter((row) => row.status === "valid" && row.roleId)
    .map((row) => ({
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      email: row.email,
      roleId: row.roleId as string,
      departmentId: row.departmentId,
      phone: row.phone || null,
      title: row.title || null,
    }));
}