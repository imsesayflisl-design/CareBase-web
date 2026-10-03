import { saveAttendance } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import { departmentScope } from "@/lib/carebase/departments";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, Panel, SelectField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { ExportMenu } from "@/components/carebase/export-button";
import { format } from "date-fns";
import { Clock3, Users } from "lucide-react";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    department?: string;
    member?: string;
    shift?: string;
    view?: string;
  }>;
}) {
  const context = await requireCarebasePermission("attendance.read");
  const canManage = await canAccess("attendance.manage");
  const { date: dateParam, department = "", member = "", shift = "", view = "daily" } =
    await searchParams;
  const dateValue =
    dateParam && !Number.isNaN(new Date(dateParam).getTime())
      ? dateParam
      : format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateValue + "T00:00:00.000Z");

  // daily | weekly | monthly range anchored on the selected date
  const rangeStart = new Date(date);
  const rangeEnd = new Date(date);
  if (view === "weekly") {
    rangeStart.setUTCDate(rangeStart.getUTCDate() - 3);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 4);
  } else if (view === "monthly") {
    rangeStart.setUTCDate(1);
    rangeEnd.setUTCMonth(rangeEnd.getUTCMonth() + 1, 1);
  } else {
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);
  }

  const departmentFilter = departmentScope(context);
  const attendanceWhere = {
    hospitalId: context.hospital.id,
    date: { gte: rangeStart, lt: rangeEnd },
    ...(department
      ? { departmentId: department }
      : departmentFilter.departmentId
      ? departmentFilter
      : {}),
    ...(member ? { memberId: member } : {}),
    ...(shift ? { shift: shift as "MORNING" | "EVENING" } : {}),
    ...(!canManage ? { memberId: context.membership.id } : {}),
  };
  const [staff, entries, present, absent, late, leave, departments] = await Promise.all([
    db.hospitalMember.findMany({
      where: {
        hospitalId: context.hospital.id,
        status: "ACTIVE",
        ...(department
          ? { departmentMemberships: { some: { departmentId: department } } }
          : {}),
        ...(!canManage ? { id: context.membership.id } : {}),
      },
      include: { role: true },
      orderBy: { fullName: "asc" },
    }),
    db.staffAttendance.findMany({
      where: attendanceWhere,
      include: { member: { include: { role: true } } },
      orderBy: [{ date: "desc" }, { member: { fullName: "asc" } }, { shift: "asc" }],
      take: 400,
    }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "PRESENT" } }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "ABSENT" } }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "LATE" } }),
    db.staffAttendance.count({ where: { ...attendanceWhere, status: "LEAVE" } }),
    db.department.findMany({
      where: { hospitalId: context.hospital.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const loggedMemberIds = new Set(entries.map((entry) => entry.memberId));

  return (
    <div>
      <PageHeader title="Staff attendance" description="Record shifts, check-ins and absences while keeping a traceable attendance history." action={
          <div className="flex flex-wrap items-center gap-2">
            <form action="/hospital/attendance" className="flex flex-wrap items-center gap-2">
              <input type="date" name="date" defaultValue={dateValue} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs outline-none focus:border-cyan-500" />
              <select name="view" defaultValue={view} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <select name="department" defaultValue={department} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="">All departments</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <select name="member" defaultValue={member} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="">All staff</option>
                {staff.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
              <select name="shift" defaultValue={shift} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                <option value="">All shifts</option>
                <option value="MORNING">Morning</option>
                <option value="EVENING">Evening</option>
              </select>
              <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">Apply filters</button>
            </form>
            <ExportMenu
              dataset="attendance"
              departments={departments}
              staff={staff.map((item) => ({ id: item.id, name: item.fullName }))}
              statuses={[
                { value: "PRESENT", label: "Present" },
                { value: "ABSENT", label: "Absent" },
                { value: "LATE", label: "Late" },
                { value: "LEAVE", label: "Leave" },
              ]}
              shifts
              label="Export Excel"
            />
          </div>
        } />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Staff in scope" value={staff.length} />
        <Metric label="Present" value={present} />
        <Metric label="Absent" value={absent} />
        <Metric label="Late" value={late} />
        <Metric label="On leave" value={leave} />
      </div>

      {canManage && <Panel title={"Record attendance · " + format(date, "MMMM d, yyyy")} description="One entry per staff member, day and shift. Previous attendance remains in the history." className="mb-5">
        <form action={saveAttendance} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Staff member" name="memberId" required options={staff.map((member) => ({ value: member.id, label: member.fullName + " · " + member.role.name }))} />
          <Field label="Date" name="date" type="date" required defaultValue={dateValue} />
          <SelectField label="Shift" name="shift" required defaultValue="MORNING" options={[{ label: "Morning", value: "MORNING" }, { label: "Evening", value: "EVENING" }]} />
          <SelectField label="Status" name="status" required defaultValue="PRESENT" options={[{ label: "Present", value: "PRESENT" }, { label: "Absent", value: "ABSENT" }, { label: "Late", value: "LATE" }, { label: "Leave", value: "LEAVE" }]} />
          <SelectField label="Department" name="departmentId" options={departments.map((item) => ({ value: item.id, label: item.name }))} />
          <Field label="Or type a new department" name="departmentName" placeholder="e.g. Night Clinic" />
          <Field label="Check-in" name="checkIn" type="time" />
          <Field label="Check-out" name="checkOut" type="time" />
          <Field label="Location" name="location" placeholder="Ward, clinic or department" />
          <Field label="Note" name="notes" placeholder="Optional shift note" />
          <div className="sm:col-span-2 xl:col-span-4"><button className="h-10 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800">Save attendance</button></div>
        </form>
      </Panel>}

      <Panel title={"Attendance for " + format(date, "EEEE, MMMM d")} description={canManage ? "All active staff in this hospital" : "Your attendance history"}>
        {entries.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Date</th><th className="pb-3">Staff member</th><th className="pb-3">Role</th><th className="pb-3">Department</th><th className="pb-3">Shift</th><th className="pb-3">Status</th><th className="pb-3">Check-in</th><th className="pb-3">Check-out</th><th className="pb-3">Record</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{entries.map((entry) => (
              <tr key={entry.id} className="text-xs">
                <td className="py-3.5 text-slate-500">{format(entry.date, "MMM d, yyyy")}</td>
                <td className="py-3.5 font-semibold text-slate-800">{entry.member.fullName}</td>
                <td className="py-3.5 capitalize text-slate-500">{entry.member.role.name.toLowerCase().replaceAll("_", " ")}</td>
                <td className="py-3.5 text-slate-600">{entry.departmentId ? departments.find((item) => item.id === entry.departmentId)?.name ?? "—" : "—"}</td>
                <td className="py-3.5 text-slate-600">{entry.shift.toLowerCase()}</td>
                <td className="py-3.5"><StatusBadge status={entry.status} /></td>
                <td className="py-3.5 text-slate-600">{entry.checkInAt ? format(entry.checkInAt, "h:mm a") : "—"}</td>
                <td className="py-3.5 text-slate-600">{entry.checkOutAt ? format(entry.checkOutAt, "h:mm a") : "—"}</td>
                <td className="py-3.5 text-[11px] text-slate-500">{entry.updatedByMemberId && entry.updatedByMemberId !== entry.createdByMemberId ? "Modified" : "Original"}</td>
              </tr>
            ))}
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
