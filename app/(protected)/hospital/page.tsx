import { CarebaseStat } from "@/components/carebase/stat-card";
import { AppointmentsChart } from "@/components/carebase/appointments-chart";
import { PageHeader } from "@/components/carebase/page-header";
import { Panel, EmptyState } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { requireCarebasePermission } from "@/lib/carebase/context";
import { departmentScope } from "@/lib/carebase/departments";
import db from "@/lib/db";
import { format, getMonth, startOfDay, startOfYear } from "date-fns";
import {
  Activity,
  BedDouble,
  CalendarCheck2,
  CalendarClock,
  ClipboardPlus,
  CreditCard,
  FlaskConical,
  Stethoscope,
  Users,
} from "lucide-react";
import Link from "next/link";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function HospitalDashboard() {
  const context = await requireCarebasePermission("dashboard.read");
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = new Date(today.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const hospitalId = context.hospital.id;
  const appointmentScope = {
    ...(context.role.name === "DOCTOR"
      ? { doctor: { memberId: context.membership.id } }
      : context.role.name === "NURSE"
      ? { assignedNurseId: context.membership.id }
      : {}),
    // Department-level isolation: department-bound staff only see their own
    // department's appointments; owners/admins remain hospital-wide.
    ...departmentScope(context),
  };

  const [
    patientsToday,
    totalPatients,
    appointmentsToday,
    doctorsAvailable,
    availableBeds,
    pendingBedRequests,
    diagnosticQueue,
    paymentTotal,
    pendingPayments,
    presentStaff,
    activeStaff,
    recentAppointments,
    yearAppointments,
    currentMonthCount,
  ] = await Promise.all([
    db.carePatient.count({ where: { hospitalId, createdAt: { gte: today, lt: tomorrow } } }),
    db.carePatient.count({ where: { hospitalId } }),
    db.careAppointment.findMany({
      where: { hospitalId, appointmentDate: { gte: today, lt: tomorrow }, ...appointmentScope },
      include: { patient: true, doctor: { include: { member: true } }, department: true },
      orderBy: [{ time: "asc" }],
      take: 8,
    }),
    db.doctorProfile.count({
      where: {
        hospitalId,
        availabilityStatus: "AVAILABLE",
        member: { status: "ACTIVE" },
      },
    }),
    db.bed.count({
      where: { status: "AVAILABLE", room: { ward: { hospitalId, status: "ACTIVE" } } },
    }),
    db.bedRequest.count({ where: { hospitalId, status: "REQUESTED" } }),
    db.diagnosticOrder.count({
      where: {
        hospitalId,
        status: { in: ["REQUESTED", "SCHEDULED", "IN_PROGRESS"] },
        service: { kind: "SCAN" },
      },
    }),
    db.hospitalPayment.aggregate({
      where: { hospitalId, createdAt: { gte: today, lt: tomorrow }, status: { in: ["PAID", "PARTIAL"] } },
      _sum: { amount: true },
    }),
    db.hospitalPayment.count({ where: { hospitalId, status: "PENDING" } }),
    db.staffAttendance.count({ where: { hospitalId, date: todayKey, status: "PRESENT" } }),
    db.hospitalMember.count({ where: { hospitalId, status: "ACTIVE" } }),
    db.careAppointment.findMany({
      where: {
        hospitalId,
        appointmentDate: { gte: today },
        status: { in: ["REQUESTED", "PENDING", "CONFIRMED", "RESCHEDULED"] },
        ...appointmentScope,
      },
      include: { patient: true, doctor: { include: { member: true } }, department: true },
      orderBy: [{ appointmentDate: "asc" }, { time: "asc" }],
      take: 5,
    }),
    db.careAppointment.findMany({
      where: { hospitalId, appointmentDate: { gte: startOfYear(now), lt: tomorrow }, ...departmentScope(context) },
      select: { appointmentDate: true, status: true },
      take: 5000,
    }),
    db.careAppointment.count({
      where: {
        hospitalId,
        appointmentDate: { gte: new Date(now.getFullYear(), now.getMonth(), 1), lt: tomorrow },
        ...departmentScope(context),
      },
    }),
  ]);

  const monthly = MONTHS.map((month, index) => ({
    month,
    requests: 0,
    completed: 0,
  }));
  yearAppointments.forEach((appointment) => {
    const month = getMonth(appointment.appointmentDate);
    monthly[month].requests += 1;
    if (appointment.status === "COMPLETED") monthly[month].completed += 1;
  });

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 18 ? "Good afternoon" : "Good evening";
  const todaysCompleted = appointmentsToday.filter((appointment) => appointment.status === "COMPLETED").length;

  return (
    <div>
      <PageHeader
        eyebrow={context.hospital.city ? context.hospital.city + " · " + context.hospital.name : context.hospital.name}
        title={greeting + ", " + context.membership.fullName.split(" ")[0]}
        description={format(now, "EEEE, MMMM d, yyyy") + "  ·  Your hospital at a glance"}
        action={<Link href="/hospital/appointments" className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-800"><CalendarClock className="size-4" /> Manage schedule</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CarebaseStat label="Patients today" value={patientsToday} note={totalPatients.toLocaleString() + " patients in this hospital"} icon={Users} accent="cyan" />
        <CarebaseStat label="Appointments today" value={appointmentsToday.length} note={todaysCompleted + " completed · " + appointmentsToday.filter((item) => item.status === "REQUESTED" || item.status === "PENDING").length + " awaiting review"} icon={CalendarCheck2} accent="blue" />
        <CarebaseStat label="Doctors available" value={doctorsAvailable} note={activeStaff + " active team members"} icon={Stethoscope} accent="green" />
        <CarebaseStat label="Beds available" value={availableBeds} note={pendingBedRequests + " bed requests to review"} icon={BedDouble} accent="violet" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <Panel
          title="Appointment activity"
          description="Requests and completed visits by month"
          action={<div className="flex items-center gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-cyan-200" /> Requests</span><span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-cyan-800" /> Completed</span></div>}
        >
          <AppointmentsChart data={monthly} />
          <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span>{MONTHS[now.getMonth()]} total: <strong className="text-slate-800">{currentMonthCount}</strong></span>
            <span>Year to date: <strong className="text-slate-800">{yearAppointments.length}</strong></span>
            <Link href="/hospital/reports" className="font-semibold text-cyan-700 hover:text-cyan-900">View reports →</Link>
          </div>
        </Panel>

        <Panel title="Today’s schedule" description="Upcoming appointments across your hospital" action={<Link href="/hospital/appointments" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">View all</Link>}>
          {appointmentsToday.length ? (
            <div className="-my-2 divide-y divide-slate-100">
              {appointmentsToday.slice(0, 6).map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-3 py-3">
                  <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">{appointment.time}</span>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-[10px] font-bold text-cyan-800">{appointment.patient.firstName[0]}{appointment.patient.lastName[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{appointment.patient.firstName} {appointment.patient.lastName}</p>
                    <p className="truncate text-[10px] text-slate-500">{appointment.doctor?.member.fullName ?? "Doctor unassigned"} · {appointment.department?.name ?? "General"}</p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No appointments today" description="New appointment requests will appear here as soon as they arrive." />
          )}
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.95fr]">
        <Panel title="Upcoming appointments" description="The next visits that need your team’s attention" action={<Link href="/hospital/appointments" className="text-xs font-semibold text-cyan-700">Open appointments</Link>}>
          {recentAppointments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Patient</th><th className="pb-3">Doctor</th><th className="pb-3">Date & time</th><th className="pb-3">Department</th><th className="pb-3">Status</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {recentAppointments.map((appointment) => (
                    <tr key={appointment.id} className="text-xs">
                      <td className="py-3.5"><Link href={"/hospital/patients/" + appointment.patientId} className="font-semibold text-slate-800 hover:text-cyan-700">{appointment.patient.firstName} {appointment.patient.lastName}</Link><p className="mt-0.5 font-mono text-[10px] text-slate-400">{appointment.patient.patientCode}</p></td>
                      <td className="py-3.5 text-slate-600">{appointment.doctor?.member.fullName ?? "Unassigned"}</td>
                      <td className="py-3.5 text-slate-600">{format(appointment.appointmentDate, "MMM d")} · {appointment.time}</td>
                      <td className="py-3.5 text-slate-600">{appointment.department?.name ?? "General"}</td>
                      <td className="py-3.5"><StatusBadge status={appointment.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No upcoming appointments" description="The schedule will populate when appointments are booked." />}
        </Panel>

        <div className="space-y-5">
          <Panel title="Operational snapshot" description="Live counts for today">
            <div className="space-y-4">
              {[
                { icon: ClipboardPlus, label: "Diagnostics in progress", value: diagnosticQueue, href: "/hospital/diagnostics", color: "text-violet-700 bg-violet-50" },
                { icon: BedDouble, label: "Bed requests", value: pendingBedRequests, href: "/hospital/bed-requests", color: "text-amber-700 bg-amber-50" },
                { icon: CreditCard, label: "Payments pending", value: pendingPayments, href: "/hospital/payments", color: "text-blue-700 bg-blue-50" },
                { icon: Users, label: "Staff present", value: presentStaff + " / " + activeStaff, href: "/hospital/attendance", color: "text-emerald-700 bg-emerald-50" },
              ].map(({ icon: Icon, label, value, href, color }) => (
                <Link href={href} key={label} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50">
                  <span className={"rounded-lg p-2 " + color}><Icon className="size-4" /></span>
                  <span className="flex-1 text-xs font-medium text-slate-600">{label}</span>
                  <strong className="text-sm text-slate-900">{value}</strong>
                </Link>
              ))}
              <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">Payments received today <strong className="ml-1 text-slate-900">{context.hospital.currency} {(paymentTotal._sum.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong></div>
            </div>
          </Panel>
          <div className="rounded-2xl bg-gradient-to-br from-cyan-800 to-sky-700 p-5 text-white shadow-lg shadow-cyan-900/10">
            <div className="flex items-center gap-2 text-cyan-100"><Activity className="size-4" /><span className="text-xs font-semibold">CareBase pulse</span></div>
            <p className="mt-3 text-lg font-semibold">Your care team, connected.</p>
            <p className="mt-1 text-xs leading-5 text-cyan-50/80">Patient requests and hospital workflows are organized in this workspace.</p>
            <Link href="/hospital/notifications" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-cyan-100">Open notifications <span>→</span></Link>
          </div>
        </div>
      </div>
    </div>
  );
}
