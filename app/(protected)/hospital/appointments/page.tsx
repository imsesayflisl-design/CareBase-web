import { createAppointment, updateAppointmentStatus } from "@/app/actions/carebase-clinical";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import { departmentScope } from "@/lib/carebase/departments";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import type { CareAppointmentStatus } from "@prisma/client";
import { format } from "date-fns";
import { CalendarCheck2, CalendarClock, CalendarDays, ClipboardList } from "lucide-react";
import Link from "next/link";

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const context = await requireCarebasePermission("appointments.read");
  const canManage = await canAccess("appointments.manage");
  const { status: statusFilter = "", q = "" } = await searchParams;
  const allowedStatus = ["REQUESTED", "PENDING", "CONFIRMED", "REJECTED", "RESCHEDULED", "CANCELLED", "COMPLETED", "NO_SHOW"];
  const status = allowedStatus.includes(statusFilter)
    ? (statusFilter as CareAppointmentStatus)
    : undefined;
  const search = q.trim();
  const roleScope =
    context.role.name === "DOCTOR"
      ? { doctor: { memberId: context.membership.id } }
      : context.role.name === "NURSE"
      ? { assignedNurseId: context.membership.id }
      : {};
  const searchFilter = search
    ? {
        OR: [
          { patient: { patientCode: { contains: search, mode: "insensitive" as const } } },
          { patient: { firstName: { contains: search, mode: "insensitive" as const } } },
          { patient: { lastName: { contains: search, mode: "insensitive" as const } } },
          { doctor: { member: { fullName: { contains: search, mode: "insensitive" as const } } } },
        ],
      }
    : {};
  const departmentFilter = departmentScope(context);
  const where = { hospitalId: context.hospital.id, ...roleScope, ...departmentFilter, ...(status ? { status } : {}), ...searchFilter };
  const [appointments, requested, confirmed, completed, patients, doctors, departments] = await Promise.all([
    db.careAppointment.findMany({
      where,
      include: { patient: true, doctor: { include: { member: true } }, department: true, assignedNurse: true },
      orderBy: [{ appointmentDate: "asc" }, { time: "asc" }],
      take: 100,
    }),
    db.careAppointment.count({ where: { hospitalId: context.hospital.id, status: { in: ["REQUESTED", "PENDING"] }, ...roleScope, ...departmentFilter } }),
    db.careAppointment.count({ where: { hospitalId: context.hospital.id, status: "CONFIRMED", appointmentDate: { gte: new Date() }, ...roleScope, ...departmentFilter } }),
    db.careAppointment.count({ where: { hospitalId: context.hospital.id, status: "COMPLETED", ...roleScope, ...departmentFilter } }),
    canManage ? db.carePatient.findMany({ where: { hospitalId: context.hospital.id }, select: { id: true, patientCode: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" }, take: 200 }) : Promise.resolve([]),
    canManage ? db.doctorProfile.findMany({ where: { hospitalId: context.hospital.id, member: { status: "ACTIVE" } }, include: { member: true }, orderBy: { member: { fullName: "asc" } } }) : Promise.resolve([]),
    canManage ? db.department.findMany({ where: { hospitalId: context.hospital.id, status: "ACTIVE" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Appointments" description="Review requests, coordinate schedules and keep the patient journey moving." action={<div className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays className="size-4 text-cyan-700" /> {appointments.length} shown</div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Awaiting review" value={requested} icon={ClipboardList} />
        <Metric label="Upcoming confirmed" value={confirmed} icon={CalendarCheck2} />
        <Metric label="Completed visits" value={completed} icon={CalendarClock} />
      </div>

      {canManage && (
        <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Schedule an appointment <span className="ml-2 text-xs font-normal text-cyan-700">Create a patient visit in this hospital</span></summary>
          <form action={createAppointment} className="grid gap-4 border-t border-cyan-100 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
            <SelectField label="Patient" name="patientId" required options={patients.map((patient) => ({ value: patient.id, label: patient.firstName + " " + patient.lastName + " · " + patient.patientCode }))} />
            <SelectField label="Doctor" name="doctorId" required options={doctors.map((doctor) => ({ value: doctor.id, label: doctor.member.fullName + (doctor.specialty ? " · " + doctor.specialty : "") }))} />
            <SelectField label="Department" name="departmentId" options={departments.map((department) => ({ value: department.id, label: department.name }))} />
            <SelectField label="Visit type" name="appointmentType" defaultValue="CONSULTATION" options={[{ label: "Consultation", value: "CONSULTATION" }, { label: "Follow-up", value: "FOLLOW_UP" }, { label: "Diagnostic", value: "DIAGNOSTIC" }, { label: "Emergency", value: "EMERGENCY" }]} />
            <Field label="Date" name="appointmentDate" type="date" required min={format(new Date(), "yyyy-MM-dd")} />
            <Field label="Time" name="time" type="time" required />
            <Field label="Duration (minutes)" name="durationMinutes" type="number" min={10} defaultValue={30} />
            <TextAreaField label="Reason for visit" name="reason" rows={2} />
            <div className="sm:col-span-2 xl:col-span-4"><FormSubmit>Create appointment request</FormSubmit></div>
          </form>
          {(!patients.length || !doctors.length) && <p className="border-t border-slate-100 bg-amber-50 px-5 py-3 text-xs text-amber-800">Add at least one patient and an active doctor before scheduling.</p>}
        </details>
      )}

      <Panel title="Appointment schedule" description="Appointments are isolated to this hospital and to your assigned care role." action={<div className="flex flex-wrap items-center gap-2"><form action="/hospital/appointments" className="flex gap-2"><input name="q" defaultValue={search} placeholder="Search patient or doctor" className="h-9 w-48 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500" /><select name="status" defaultValue={status} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"><option value="">All statuses</option>{allowedStatus.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><button className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Filter</button></form></div>}>
        {appointments.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Patient</th><th className="pb-3">Doctor / nurse</th><th className="pb-3">Schedule</th><th className="pb-3">Department</th><th className="pb-3">Status</th><th className="pb-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {appointments.map((appointment) => (
                <tr key={appointment.id} className="align-top text-xs">
                  <td className="py-4"><Link href={"/hospital/patients/" + appointment.patientId} className="font-semibold text-slate-800 hover:text-cyan-700">{appointment.patient.firstName} {appointment.patient.lastName}</Link><p className="mt-1 font-mono text-[10px] text-slate-400">{appointment.patient.patientCode}</p><p className="mt-1 text-[10px] text-slate-500">{appointment.patient.phone || "No phone recorded"}</p></td>
                  <td className="py-4 text-slate-600">{appointment.doctor?.member.fullName ?? "Unassigned"}<p className="mt-1 text-[10px] text-slate-400">{appointment.assignedNurse?.fullName ?? appointment.doctor?.specialty ?? ""}</p></td>
                  <td className="py-4 text-slate-600">{format(appointment.appointmentDate, "EEE, MMM d, yyyy")}<p className="mt-1 text-[10px] text-slate-500">{appointment.time} · {appointment.durationMinutes} min</p></td>
                  <td className="py-4 text-slate-600">{appointment.department?.name ?? "General"}</td>
                  <td className="py-4"><StatusBadge status={appointment.status} />{appointment.reason && <p className="mt-2 max-w-40 text-[10px] leading-4 text-slate-500">{appointment.reason}</p>}</td>
                  <td className="py-4">
                    {canManage && <div className="flex flex-wrap gap-1.5">
                      {appointment.status === "REQUESTED" || appointment.status === "PENDING" ? <><QuickStatus id={appointment.id} status="CONFIRMED" label="Confirm" /><QuickStatus id={appointment.id} status="REJECTED" label="Reject" danger /></> : null}
                      {appointment.status === "CONFIRMED" || appointment.status === "RESCHEDULED" ? <><QuickStatus id={appointment.id} status="COMPLETED" label="Complete" /><details className="relative"><summary className="cursor-pointer rounded-md border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600">Reschedule</summary><form action={updateAppointmentStatus} className="absolute right-0 z-10 mt-2 w-56 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><input type="hidden" name="id" value={appointment.id} /><input type="hidden" name="status" value="RESCHEDULED" /><label className="block text-[10px] font-semibold">New date<input type="date" name="appointmentDate" required className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-xs" /></label><label className="block text-[10px] font-semibold">New time<input type="time" name="time" required className="mt-1 h-8 w-full rounded border border-slate-200 px-2 text-xs" /></label><button className="w-full rounded-md bg-cyan-700 py-2 text-[10px] font-semibold text-white">Save schedule</button></form></details></> : null}
                      {appointment.status !== "CANCELLED" && appointment.status !== "COMPLETED" && appointment.status !== "REJECTED" && <QuickStatus id={appointment.id} status="CANCELLED" label="Cancel" danger />}
                    </div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyState title={search || status ? "No matching appointments" : "No appointments yet"} description={search || status ? "Try clearing your filters or searching for a different patient." : "New patient requests and scheduled visits will appear here."} />}
      </Panel>
    </div>
  );
}

function QuickStatus({ id, status, label, danger = false }: { id: string; status: string; label: string; danger?: boolean }) {
  return <form action={updateAppointmentStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><button className={"rounded-md border px-2 py-1.5 text-[10px] font-semibold " + (danger ? "border-rose-100 text-rose-600 hover:bg-rose-50" : "border-cyan-100 bg-cyan-50 text-cyan-800 hover:bg-cyan-100")}>{label}</button></form>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof CalendarCheck2 }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
