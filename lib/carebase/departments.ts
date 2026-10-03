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