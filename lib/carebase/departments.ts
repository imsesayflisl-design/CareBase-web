import "server-only";

import db from "@/lib/db";
import { recordCarebaseAudit } from "./audit";
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

export {
  DEPARTMENT_PRESETS,
  DIAGNOSTIC_DEPARTMENT_PRESETS,
  DIAGNOSTIC_SERVICE_PRESETS,
} from "./presets";

/**
 * Resolves a department from either an existing id or a typed name.
 *
 * Used by the tests & scans and attendance forms so staff can pick a known
 * department or type a new one. A typed name is created inside the caller's
 * hospital when it does not exist yet (and audited). Returns `null` when
 * neither was supplied.
 */
export async function resolveDepartmentId(
  context: CarebaseContext,
  departmentId: string | null | undefined,
  departmentName: string | null | undefined
): Promise<string | null> {
  const name = (departmentName ?? "").trim();

  if (departmentId) {
    const department = await db.department.findFirst({
      where: { id: departmentId, hospitalId: context.hospital.id },
      select: { id: true },
    });
    if (!department) throw new Error("Choose a department from this hospital.");
    return department.id;
  }

  if (!name) return null;
  if (name.length < 2) throw new Error("Enter a valid department name.");

  const existing = await db.department.findFirst({
    where: { hospitalId: context.hospital.id, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const department = await db.department.create({
    data: { hospitalId: context.hospital.id, name },
  });
  await recordCarebaseAudit(
    context,
    "department.created",
    "Department",
    department.id,
    { name, source: "form" }
  );
  return department.id;
}