import { createDoctorSchedule } from "@/app/actions/carebase-admin";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { CalendarClock, Clock3, Stethoscope, Users } from "lucide-react";
import Link from "next/link";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function DoctorsPage() {
  const context = await requireCarebasePermission("staff.read");
  const canManage = await canAccess("staff.manage");
  const doctors = await db.doctorProfile.findMany({
    where: { hospitalId: context.hospital.id },
    include: {
      member: { include: { departmentMemberships: { include: { department: true } } } },
      department: true,
      schedules: { orderBy: { dayOfWeek: "asc" } },
      nurseAssignments: { include: { nurse: true } },
      _count: { select: { appointments: true } },
    },
    orderBy: { member: { fullName: "asc" } },
  });
  const available = doctors.filter((doctor) => doctor.availabilityStatus === "AVAILABLE" && doctor.member.status === "ACTIVE").length;

  return (
    <div>
      <PageHeader title="Doctors" description="Doctor profiles, departments, availability and working schedules." action={<Link href="/hospital/staff" className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800"><Users className="size-4" /> Manage team</Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Doctors" value={doctors.length} icon={Stethoscope} />
        <Metric label="Available" value={available} icon={CalendarClock} />
        <Metric label="Appointments" value={doctors.reduce((sum, doctor) => sum + doctor._count.appointments, 0)} icon={Clock3} />
      </div>
      <Panel title="Doctor directory" description="Doctor profiles are created when a team invitation is accepted.">
        {doctors.length ? <div className="grid gap-4 xl:grid-cols-2">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-800"><Stethoscope className="size-5" /></span>
                  <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{doctor.member.fullName}</h3><p className="mt-1 truncate text-xs text-slate-500">{doctor.specialty || "Specialty not added"}{doctor.subSpecialty ? " · " + doctor.subSpecialty : ""}</p></div>
                </div>
                <StatusBadge status={doctor.member.status === "ACTIVE" ? doctor.availabilityStatus : "INACTIVE"} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Department</p><p className="mt-1 text-slate-700">{doctor.department?.name ?? "Not assigned"}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Consultation</p><p className="mt-1 text-slate-700">{doctor.consultationType || "In person"}{doctor.consultationFee ? " · " + context.hospital.currency + " " + doctor.consultationFee.toFixed(2) : ""}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Experience</p><p className="mt-1 text-slate-700">{doctor.yearsExperience ? doctor.yearsExperience + " years" : "Not added"}</p></div>
                <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Appointments</p><p className="mt-1 text-slate-700">{doctor._count.appointments}</p></div>
              </div>
              {doctor.schedules.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{doctor.schedules.map((schedule) => <span key={schedule.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600">{DAYS[schedule.dayOfWeek]} · {schedule.startTime}–{schedule.endTime}</span>)}</div>}
              {doctor.nurseAssignments.length > 0 && <p className="mt-3 text-[11px] text-slate-500">Assigned nurses: {doctor.nurseAssignments.map((assignment) => assignment.nurse.fullName).join(", ")}</p>}
              {doctor.biography && <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-500">{doctor.biography}</p>}
              {canManage && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-[11px] font-semibold text-cyan-700">Add working hours</summary><form action={createDoctorSchedule} className="mt-3 grid gap-3 sm:grid-cols-3"><input type="hidden" name="doctorId" value={doctor.id} /><SelectField label="Day" name="dayOfWeek" required options={DAYS.map((day, index) => ({ label: day, value: String(index) }))} /><Field label="Starts" name="startTime" type="time" required /><Field label="Ends" name="endTime" type="time" required /><Field label="Slot length (min)" name="slotMinutes" type="number" min={10} defaultValue={30} /><Field label="Break starts" name="breakStart" type="time" /><Field label="Break ends" name="breakEnd" type="time" /><div className="sm:col-span-3"><FormSubmit>Add schedule</FormSubmit></div></form></details>}
            </article>
          ))}
        </div> : <EmptyState title="No doctor profiles yet" description="Invite someone with the Doctor role from Staff & access. Their profile will appear here when they accept." />}
      </Panel>
      <p className="mt-4 text-xs text-slate-400">Last refreshed {format(new Date(), "h:mm a")}</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Stethoscope }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
