import { createDepartment, setDepartmentStatus } from "@/app/actions/carebase-admin";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { DepartmentPresetPicker } from "@/components/carebase/department-picker";
import { ExportMenu } from "@/components/carebase/export-button";
import { Building2, MapPin, Users } from "lucide-react";
import Link from "next/link";

export default async function DepartmentsPage() {
  const context = await requireCarebasePermission("departments.read");
  const canManage = await canAccess("departments.manage");
  const departments = await db.department.findMany({
    where: { hospitalId: context.hospital.id },
    include: {
      _count: { select: { members: true, doctors: true, appointments: true } },
      doctors: { include: { member: { select: { fullName: true } } }, take: 3 },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
  const [active, teamCount] = await Promise.all([
    db.department.count({ where: { hospitalId: context.hospital.id, status: "ACTIVE" } }),
    db.departmentMember.count({ where: { hospitalId: context.hospital.id } }),
  ]);

  return (
    <div>
      <PageHeader title="Departments" description="Organize care teams and services by department." action={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500"><Building2 className="size-4 text-cyan-700" /> {context.hospital.name}</div>
          <ExportMenu
            dataset="department"
            departments={departments.map((department) => ({ id: department.id, name: department.name }))}
            label="Export department Excel"
          />
        </div>
      } />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Departments" value={departments.length} icon={Building2} />
        <Metric label="Active" value={active} icon={MapPin} />
        <Metric label="Department assignments" value={teamCount} icon={Users} />
      </div>

      {canManage && (
        <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Add department <span className="ml-2 text-xs font-normal text-cyan-700">Create a department for this hospital</span></summary>
          <form action={createDepartment} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2">
            <DepartmentPresetPicker />
            <Field label="Location" name="location" placeholder="Building, floor or wing" />
            <Field label="Contact" name="contact" placeholder="Extension or phone" />
            <TextAreaField label="Description" name="description" rows={2} placeholder="Department focus and services" />
            <div className="md:col-span-2"><FormSubmit>Create department</FormSubmit></div>
          </form>
        </details>
      )}

      <Panel title="Department directory" description="Departments and their assigned care teams">
        {departments.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <article key={department.id} className="rounded-2xl border border-slate-200 p-5 transition hover:border-cyan-200 hover:shadow-sm">
              <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-50 p-2.5 text-cyan-800"><Building2 className="size-4" /></span><div><h3 className="text-sm font-semibold text-slate-900">{department.name}</h3><p className="mt-1 text-[11px] text-slate-500">{department.location || "Location not set"}</p></div></div><StatusBadge status={department.status} /></div>
              {department.description && <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">{department.description}</p>}
              <div className="mt-4 flex gap-4 border-t border-slate-100 pt-4 text-[11px] text-slate-500"><span><strong className="text-slate-800">{department._count.members}</strong> staff</span><span><strong className="text-slate-800">{department._count.doctors}</strong> doctors</span><span><strong className="text-slate-800">{department._count.appointments}</strong> visits</span></div>
              {department.doctors.length > 0 && <p className="mt-3 truncate text-[11px] text-slate-500">Doctors: {department.doctors.map((doctor) => doctor.member.fullName).join(", ")}</p>}
              {canManage && <form action={setDepartmentStatus} className="mt-4 border-t border-slate-100 pt-3"><input type="hidden" name="id" value={department.id} /><input type="hidden" name="status" value={department.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} /><button className="text-[11px] font-semibold text-cyan-700 hover:text-cyan-900">{department.status === "ACTIVE" ? "Deactivate department" : "Reactivate department"}</button></form>}
              <Link href={"/hospital/departments/" + department.id} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-700 hover:text-cyan-900">Open department dashboard →</Link>
            </article>
          ))}
        </div> : <EmptyState title="No departments yet" description="Create departments such as Cardiology, Pediatrics, Laboratory or Emergency." />}
      </Panel>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
