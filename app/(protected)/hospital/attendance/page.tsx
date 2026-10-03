import { saveAttendance } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, Panel, SelectField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { Clock3, Users } from "lucide-react";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const context = await requireCarebasePermission("attendance.read");
  const canManage = await canAccess("attendance.manage");
  const { date: dateParam } = await searchParams;
  const dateValue = dateParam && !Number.isNaN(new Date(dateParam).getTime()) ? dateParam : format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateValue + "T00:00:00.000Z");
  const attendanceWhere = {
    hospitalId: context.hospital.id,
    date,
    ...(!canManage ? { memberId: context.membership.id } : {}),
  };
  const [staff, entries, present, absent, leave] = await Promise.all([
    db.hospitalMember.findMany({
      where: {
        hospitalId: context.hospital.id,
        status: "ACTIVE",
        ...(!canManage ? { id: context.membership.id } : {}),
      },
      include: { role: true },
      orderBy: { fullName: "asc" },
    }),
    db.staffAttendance.findMany({
      where: attendanceWhere,
      include: { member: { include: { role: true } } },
      orderBy: [{ member: { fullName: "asc" } }, { shift: "asc" }],
    }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "PRESENT" } }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "ABSENT" } }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "LEAVE" } }),
  ]);
  const loggedMemberIds = new Set(entries.map((entry) => entry.memberId));

  return (
    <div>
      <PageHeader title="Staff attendance" description="Record shifts, check-ins and absences while keeping a traceable attendance history." action={<form action="/hospital/attendance" className="flex items-center gap-2"><input type="date" name="date" defaultValue={dateValue} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none focus:border-cyan-500" /><button className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">View date</button></form>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Staff in scope" value={staff.length} />
        <Metric label="Present" value={present} />
        <Metric label="Absent" value={absent} />
        <Metric label="On leave" value={leave} />
      </div>

      {canManage && <Panel title={"Record attendance · " + format(date, "MMMM d, yyyy")} description="One entry per staff member, day and shift. Previous attendance remains in the history." className="mb-5">
        <form action={saveAttendance} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Staff member" name="memberId" required options={staff.map((member) => ({ value: member.id, label: member.fullName + " · " + member.role.name }))} />
          <Field label="Date" name="date" type="date" required defaultValue={dateValue} />
          <SelectField label="Shift" name="shift" required defaultValue="MORNING" options={[{ label: "Morning", value: "MORNING" }, { label: "Evening", value: "EVENING" }]} />
          <SelectField label="Status" name="status" required defaultValue="PRESENT" options={[{ label: "Present", value: "PRESENT" }, { label: "Absent", value: "ABSENT" }, { label: "Leave", value: "LEAVE" }]} />
          <Field label="Check-in" name="checkIn" type="time" />
          <Field label="Check-out" name="checkOut" type="time" />
          <Field label="Location" name="location" placeholder="Ward, clinic or department" />
          <Field label="Note" name="notes" placeholder="Optional shift note" />
          <div className="sm:col-span-2 xl:col-span-4"><button className="h-10 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800">Save attendance</button></div>
        </form>
      </Panel>}

      <Panel title={"Attendance for " + format(date, "EEEE, MMMM d")} description={canManage ? "All active staff in this hospital" : "Your attendance history"}>
        {entries.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Staff member</th><th className="pb-3">Role</th><th className="pb-3">Shift</th><th className="pb-3">Status</th><th className="pb-3">Check-in</th><th className="pb-3">Check-out</th><th className="pb-3">Location</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{entries.map((entry) => <tr key={entry.id} className="text-xs"><td className="py-3.5 font-semibold text-slate-800">{entry.member.fullName}</td><td className="py-3.5 capitalize text-slate-500">{entry.member.role.name.toLowerCase().replaceAll("_", " ")}</td><td className="py-3.5 text-slate-600">{entry.shift.toLowerCase()}</td><td className="py-3.5"><StatusBadge status={entry.status} /></td><td className="py-3.5 text-slate-600">{entry.checkInAt ? format(entry.checkInAt, "h:mm a") : "—"}</td><td className="py-3.5 text-slate-600">{entry.checkOutAt ? format(entry.checkOutAt, "h:mm a") : "—"}</td><td className="py-3.5 text-slate-500">{entry.location || "—"}</td></tr>)}
            </tbody>
          </table>
          {canManage && staff.some((member) => !loggedMemberIds.has(member.id)) && <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800"><Users className="size-4" /> {staff.filter((member) => !loggedMemberIds.has(member.id)).length} active staff members have no attendance entry for this date.</div>}
        </div> : <EmptyState title="No attendance records for this date" description={canManage ? "Use the form above to record staff attendance for this shift." : "Your attendance entries will appear here."} />}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>;
}
