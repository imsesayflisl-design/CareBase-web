import { assignNurseToDoctor, inviteHospitalMember, resendHospitalInvitation, revokeHospitalInvitation, setMemberRole, setMemberStatus } from "@/app/actions/carebase-admin";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField } from "@/components/carebase/panel";
import { ExportMenu } from "@/components/carebase/export-button";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { BriefcaseMedical, MailPlus, ShieldCheck, Users } from "lucide-react";

export default async function StaffPage() {
  const context = await requireCarebasePermission("staff.read");
  const [canManage, canManageRoles] = await Promise.all([
    canAccess("staff.manage"),
    canAccess("roles.manage"),
  ]);
  const [members, roles, departments, invitations, doctors] = await Promise.all([
    db.hospitalMember.findMany({
      where: { hospitalId: context.hospital.id },
      include: {
        role: true,
        departmentMemberships: { include: { department: true } },
        doctorProfile: true,
      },
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
    }),
    db.hospitalRole.findMany({ where: { hospitalId: context.hospital.id }, orderBy: { name: "asc" } }),
    db.department.findMany({ where: { hospitalId: context.hospital.id, status: "ACTIVE" }, orderBy: { name: "asc" } }),
    db.staffInvitation.findMany({
      where: { hospitalId: context.hospital.id, status: { in: ["PENDING", "REVOKED"] } },
      include: { role: true, department: true },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.doctorProfile.findMany({
      where: { hospitalId: context.hospital.id, member: { status: "ACTIVE" } },
      include: { member: true },
      orderBy: { member: { fullName: "asc" } },
    }),
  ]);
  const activeCount = members.filter((member) => member.status === "ACTIVE").length;
  const pendingCount = invitations.filter((invitation) => invitation.status === "PENDING" && invitation.expiresAt > new Date()).length;

  return (
    <div>
      <PageHeader title="Staff & access" description="Invite colleagues, assign roles and connect nurses with the doctors they support." action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-cyan-700" /> Role-based access</div>
            <ExportMenu dataset="staff" departments={departments} />
          </div>
        } />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Team members" value={members.length} icon={Users} />
        <Metric label="Active members" value={activeCount} icon={BriefcaseMedical} />
        <Metric label="Open invitations" value={pendingCount} icon={MailPlus} />
      </div>

      {canManage && (
        <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Invite a team member <span className="ml-2 text-xs font-normal text-cyan-700">A time-limited invitation will be sent by email</span></summary>
          <form action={inviteHospitalMember} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Full name" name="fullName" required />
            <Field label="Work email" name="email" type="email" required />
            <SelectField label="Role" name="roleId" required options={roles.map((role) => ({ value: role.id, label: role.name.replaceAll("_", " ") }))} />
            <SelectField label="Department" name="departmentId" options={departments.map((department) => ({ value: department.id, label: department.name }))} />
            <div className="xl:col-span-4"><FormSubmit>Send invitation</FormSubmit></div>
          </form>
        </details>
      )}

      <Panel title="Hospital team" description="Each person only receives the permissions assigned to their hospital role.">
        {members.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Team member</th><th className="pb-3">Department</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3">Joined</th><th className="pb-3">Access</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((member) => (
                <tr key={member.id} className="text-xs">
                  <td className="py-3.5"><p className="font-semibold text-slate-800">{member.fullName}{member.id === context.membership.id ? <span className="ml-2 text-[10px] font-normal text-cyan-700">You</span> : null}</p><p className="mt-1 text-[10px] text-slate-500">{member.email}</p></td>
                  <td className="py-3.5 text-slate-600">{member.departmentMemberships.map((item) => item.department.name).join(", ") || "—"}</td>
                  <td className="py-3.5">
                    {canManageRoles && member.role.name !== "OWNER" ? <form action={setMemberRole} className="flex items-center gap-1"><input type="hidden" name="memberId" value={member.id} /><select name="roleId" defaultValue={member.roleId} className="max-w-36 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700">{roles.filter((role) => role.name !== "OWNER").map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><button className="text-[10px] font-semibold text-cyan-700">Save</button></form> : <span className="capitalize text-slate-600">{member.role.name.toLowerCase().replaceAll("_", " ")}</span>}
                  </td>
                  <td className="py-3.5"><StatusBadge status={member.status} /></td>
                  <td className="py-3.5 text-slate-500">{format(member.createdAt, "MMM d, yyyy")}</td>
                  <td className="py-3.5">{canManage && member.role.name !== "OWNER" && member.id !== context.membership.id && <form action={setMemberStatus}><input type="hidden" name="memberId" value={member.id} /><input type="hidden" name="status" value={member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} /><button className="text-[10px] font-semibold text-cyan-700">{member.status === "ACTIVE" ? "Deactivate" : "Reactivate"}</button></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyState title="Your team is ready to grow" description="Invite doctors, nurses, technicians and operations staff to give them access to this hospital." />}
      </Panel>

      {canManage && members.some((member) => member.role.name === "NURSE") && doctors.length > 0 && (
        <div className="mt-5">
          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800">Assign nurses to doctors</summary>
            <div className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-2">
              {members.filter((member) => member.role.name === "NURSE" && member.status === "ACTIVE").map((nurse) => (
                <form key={nurse.id} action={assignNurseToDoctor} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <span className="min-w-28 flex-1 text-xs font-semibold text-slate-700">{nurse.fullName}</span>
                  <input type="hidden" name="nurseId" value={nurse.id} />
                  <select name="doctorId" required className="h-9 min-w-40 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Select doctor</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.member.fullName}</option>)}</select>
                  <button className="rounded-lg bg-white px-3 py-2 text-[10px] font-semibold text-cyan-800 ring-1 ring-slate-200">Assign</button>
                </form>
              ))}
            </div>
          </details>
        </div>
      )}

      <div className="mt-5">
        <Panel title="Recent invitations" description="Invitations expire after seven days and can only be used by the invited email.">
          {invitations.length ? <div className="divide-y divide-slate-100">
            {invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><MailPlus className="size-4" /></span><div className="min-w-52 flex-1"><p className="text-xs font-semibold text-slate-800">{invitation.fullName} <span className="font-normal text-slate-500">· {invitation.email}</span></p><p className="mt-1 text-[10px] text-slate-500">{invitation.role.name} {invitation.department ? "· " + invitation.department.name : ""} · Expires {format(invitation.expiresAt, "MMM d")}</p></div><StatusBadge status={invitation.status === "PENDING" && invitation.expiresAt < new Date() ? "EXPIRED" : invitation.status} />{canManage && invitation.status === "PENDING" && invitation.expiresAt > new Date() && <form action={resendHospitalInvitation}><input type="hidden" name="id" value={invitation.id} /><button className="text-[10px] font-semibold text-cyan-700 hover:text-cyan-900">Resend</button></form>}{canManage && invitation.status === "PENDING" && invitation.expiresAt > new Date() && <form action={revokeHospitalInvitation}><input type="hidden" name="id" value={invitation.id} /><button className="text-[10px] font-semibold text-rose-600 hover:text-rose-800">Revoke</button></form>}</div>)}
          </div> : <p className="text-xs text-slate-500">No invitations have been sent.</p>}
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
