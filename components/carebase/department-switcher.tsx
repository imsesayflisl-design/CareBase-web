"use client";

import { setActiveDepartment } from "@/app/actions/carebase-context";

/**
 * Controlled department selector. It is only rendered when the member belongs
 * to more than one department; ordinary staff can never switch hospitals.
 */
export function DepartmentSwitcher({
  departments,
  activeDepartmentId,
}: {
  departments: { id: string; name: string }[];
  activeDepartmentId: string | null;
}) {
  if (departments.length < 2) return null;

  return (
    <form action={setActiveDepartment} className="hidden sm:block">
      <label htmlFor="active-department" className="sr-only">
        Active department
      </label>
      <select
        id="active-department"
        name="departmentId"
        defaultValue={activeDepartmentId ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-9 max-w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-cyan-500"
      >
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {department.name}
          </option>
        ))}
      </select>
    </form>
  );
}