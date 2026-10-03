import "server-only";

import type { CarebaseContext } from "./context";

/**
 * Roles that operate across the whole hospital rather than a single department.
 * Everything else is treated as department-bound when the member belongs to at
 * least one department.
 */
const HOSPITAL_WIDE_ROLES = new Set(["OWNER", "ADMIN"]);

export function isHospitalWide(context: CarebaseContext) {
  return (
    HOSPITAL_WIDE_ROLES.has(context.role.name) ||
    context.role.permissions.includes("*")
  );
}

export function memberDepartmentIds(context: CarebaseContext) {
  return context.departments.map((department) => department.id);
}

/**
 * Prisma filter fragment that restricts a query to the caller's departments.
 *
 * - Hospital-wide roles (owner / admin) get `{}` → they see the whole hospital.
 * - Members with no department membership get `{}` → governed by their role scope.
 * - Department-bound members get `{ departmentId: { in: [...] } }`.
 *
 * This is applied on the server so a staff member can never read another
 * department's records, even by editing an id or URL.
 */
export function departmentScope(
  context: CarebaseContext
): { departmentId?: { in: string[] } } {
  if (isHospitalWide(context)) return {};
  const ids = memberDepartmentIds(context);
  if (!ids.length) return {};
  return { departmentId: { in: ids } };
}

/**
 * Standard hospital departments offered when creating a department.
 * A custom name can always be typed instead (§1 Department Management).
 */
export const DEPARTMENT_PRESETS: string[] = [
  "Emergency / Casualty",
  "Outpatient Department (OPD)",
  "Inpatient / Wards",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "General Medicine",
  "General Surgery",
  "Orthopedics",
  "Cardiology",
  "Neurology",
  "Psychiatry / Mental Health",
  "Dental",
  "Ophthalmology",
  "ENT",
  "Dermatology",
  "Urology",
  "Nephrology",
  "Oncology",
  "Radiology / Imaging",
  "Laboratory",
  "Pharmacy",
  "Physiotherapy",
  "Nutrition & Dietetics",
  "ICU / Critical Care",
  "Operating Theatre",
  "Maternity",
  "Blood Bank",
  "Mortuary",
  "Administration",
  "Medical Records",
  "Nursing",
  "Ambulance / Emergency Transport",
];

/** Diagnostic departments / modalities offered when creating a service. */
export const DIAGNOSTIC_DEPARTMENT_PRESETS: string[] = [
  "Laboratory",
  "Radiology / Imaging",
  "Ultrasound",
  "X-Ray",
  "CT Scan",
  "MRI",
  "ECG / Cardiology",
];

/**
 * Standard test & scan services offered when creating a diagnostic service.
 * `kind` mirrors the `DiagnosticKind` enum.
 */
export const DIAGNOSTIC_SERVICE_PRESETS: { name: string; kind: "TEST" | "SCAN" }[] = [
  { name: "Complete Blood Count (CBC)", kind: "TEST" },
  { name: "Blood Glucose", kind: "TEST" },
  { name: "Urinalysis", kind: "TEST" },
  { name: "Malaria RDT", kind: "TEST" },
  { name: "Culture & Sensitivity", kind: "TEST" },
  { name: "Lipid Profile", kind: "TEST" },
  { name: "Liver Function Test", kind: "TEST" },
  { name: "Kidney Function Test", kind: "TEST" },
  { name: "X-Ray", kind: "SCAN" },
  { name: "Ultrasound", kind: "SCAN" },
  { name: "CT Scan", kind: "SCAN" },
  { name: "MRI", kind: "SCAN" },
  { name: "ECG", kind: "SCAN" },
];