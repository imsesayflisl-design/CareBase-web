import { createHospitalRole, saveRolePermissions } from "@/app/actions/carebase-admin";
import { requireCarebasePermission } from "@/lib/carebase/context";
import { CAREBASE_PERMISSIONS } from "@/lib/carebase/permissions";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { FormSubmit, Panel } from "@/components/carebase/panel";
import { ShieldCheck, Users } from "lucide-react";

const GROUPS: Record<string, string[]> = {
  "Workspace": ["dashboard.read", "hospital.manage"],
  "People & departments": ["departments.read", "departments.manage", "staff.read", "staff.manage", "roles.manage"],
  "Patients & care": ["patients.read", "patients.manage", "clinical.read", "clinical.manage"],
  "Operations": ["appointments.read", "appointments.manage", "beds.read", "beds.manage", "diagnostics.read", "diagnostics.manage"],
  "Finance & reporting": ["attendance.read", "attendance.manage", "payments.read", "payments.manage", "reports.read"],
  "Communication & oversight": ["notices.read", "notices.manage", "notifications.read", "audit.read"],
};

export default async function AccessPage() {
  const context = await requireCarebasePermission("roles.manage");
  const roles = await db.hospitalRole.findMany({
    where: { hospitalId: context.hospital.id },
    include: { _count: { select: { members: true } } },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader title="Roles & permissions" description="Configure what each hospital role can view and manage. Permissions are enforced on the server." action={<div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-cyan-700" /> Hospital-scoped access</div>} />
      <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Create a custom role</summary>
        <form action={createHospitalRole} className="border-t border-cyan-100 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Role name</span><input name="name" required minLength={2} placeholder="e.g. Ward Coordinator" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" /></label><label className="block"><span className="mb-1 block text-xs font-semibold text-slate-700">Description</span><input name="description" placeholder="What this role is responsible for" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" /></label></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Object.entries(GROUPS).map(([group, permissions]) => <PermissionGroup key={group} title={group} permissions={permissions} />)}</div>
          <div className="mt-5"><FormSubmit>Create role</FormSubmit></div>
        </form>
      </details>

      <div className="grid gap-5 xl:grid-cols-2">
        {roles.map((role) => (
          <Panel key={role.id} title={role.name.replaceAll("_", " ")} description={role.description || (role.isSystem ? "Built-in hospital role" : "Custom hospital role")} action={<span className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600"><Users className="size-3" /> {role._count.members} members</span>}>
            {role.name === "OWNER" ? (
              <div className="rounded-xl bg-amber-50 p-4 text-xs leading-5 text-amber-800">Owner permissions are fixed to protect hospital ownership and recovery access.</div>
            ) : (
              <form action={saveRolePermissions}>
                <input type="hidden" name="roleId" value={role.id} />
                <div className="space-y-4">{Object.entries(GROUPS).map(([group, permissions]) => <PermissionGroup key={group} title={group} permissions={permissions} selected={role.permissions} />)}</div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><p className="text-[10px] text-slate-400">{role.permissions.length} permissions enabled</p><FormSubmit>Save permissions</FormSubmit></div>
              </form>
            )}
          </Panel>
        ))}
      </div>
      <p className="mt-5 text-[11px] leading-5 text-slate-400">Role changes take effect on the next server request. Existing sessions are checked against the current database role on each protected action.</p>
    </div>
  );
}

function PermissionGroup({ title, permissions, selected = [] }: { title: string; permissions: string[]; selected?: string[] }) {
  return (
    <fieldset className="rounded-xl border border-slate-100 p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {permissions.filter((permission) => CAREBASE_PERMISSIONS.includes(permission as typeof CAREBASE_PERMISSIONS[number])).map((permission) => (
          <label key={permission} className="flex items-center gap-2 text-[11px] text-slate-600">
            <input type="checkbox" name="permission" value={permission} defaultChecked={selected.includes(permission)} className="size-3.5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-600" />
            <span>{permission.replace(".", " · ").replaceAll("_", " ")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
