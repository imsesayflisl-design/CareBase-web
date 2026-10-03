import { requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { Panel } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { ExportMenu } from "@/components/carebase/export-button";
import { format, startOfMonth, endOfDay } from "date-fns";
import { BarChart3, BedDouble, CalendarDays, CreditCard, Download, FlaskConical, Users } from "lucide-react";
import Link from "next/link";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const context = await requireCarebasePermission("reports.read");
  const { from, to } = await searchParams;
  const start = from && !Number.isNaN(new Date(from).getTime()) ? new Date(from + "T00:00:00") : startOfMonth(new Date());
  const end = to && !Number.isNaN(new Date(to).getTime()) ? endOfDay(new Date(to + "T00:00:00")) : endOfDay(new Date());
  const hospitalId = context.hospital.id;
  const [patients, appointments, diagnostics, beds, payments, attendance] = await Promise.all([
    db.carePatient.count({ where: { hospitalId, createdAt: { gte: start, lte: end } } }),
    db.careAppointment.groupBy({ by: ["status"], where: { hospitalId, appointmentDate: { gte: start, lte: end } }, _count: { _all: true } }),
    db.diagnosticOrder.groupBy({ by: ["status"], where: { hospitalId, createdAt: { gte: start, lte: end } }, _count: { _all: true } }),
    db.bed.count({ where: { status: "AVAILABLE", room: { ward: { hospitalId } } } }),
    db.hospitalPayment.groupBy({ by: ["status"], where: { hospitalId, createdAt: { gte: start, lte: end } }, _count: { _all: true }, _sum: { amount: true } }),
    db.staffAttendance.groupBy({ by: ["status"], where: { hospitalId, date: { gte: new Date(start.toISOString().slice(0, 10) + "T00:00:00.000Z"), lte: new Date(end.toISOString().slice(0, 10) + "T00:00:00.000Z") } }, _count: { _all: true } }),
  ]);
  const appointmentTotal = appointments.reduce((sum, item) => sum + item._count._all, 0);
  const diagnosticTotal = diagnostics.reduce((sum, item) => sum + item._count._all, 0);
  const paymentTotal = payments.reduce((sum, item) => sum + item._count._all, 0);
  const collected = payments.filter((item) => item.status === "PAID" || item.status === "PARTIAL").reduce((sum, item) => sum + (item._sum.amount ?? 0), 0);
  const href = (type: string) => "/api/hospital/reports?type=" + type + "&from=" + format(start, "yyyy-MM-dd") + "&to=" + format(end, "yyyy-MM-dd");

  return (
    <div>
      <PageHeader title="Reports & analytics" description="Operational summaries for your hospital. Exports follow the same hospital and permission boundaries as the workspace." action={
          <div className="flex flex-wrap items-center gap-3">
            <form action="/hospital/reports" className="flex items-center gap-2"><input type="date" name="from" defaultValue={from || format(start, "yyyy-MM-dd")} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs" /><span className="text-xs text-slate-400">to</span><input type="date" name="to" defaultValue={to || format(end, "yyyy-MM-dd")} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs" /><button className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Apply</button></form>
            <ExportMenu dataset="hospital" label="Export hospital records" />
          </div>
        } />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="New patients" value={patients} note={format(start, "MMM d") + " – " + format(end, "MMM d")} icon={Users} />
        <Metric label="Appointments" value={appointmentTotal} note="Visits scheduled in this period" icon={CalendarDays} />
        <Metric label="Diagnostic orders" value={diagnosticTotal} note="Tests and scans" icon={FlaskConical} />
        <Metric label="Beds available" value={beds} note="Current inventory" icon={BedDouble} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ReportPanel title="Appointment activity" icon={CalendarDays} exportHref={href("appointments")} exportLabel="Appointments CSV">
          {appointments.length ? <Distribution rows={appointments.map((row) => ({ name: row.status, count: row._count._all }))} /> : <NoRows />}
        </ReportPanel>
        <ReportPanel title="Diagnostics" icon={FlaskConical} exportHref={href("diagnostics")} exportLabel="Diagnostics CSV">
          {diagnostics.length ? <Distribution rows={diagnostics.map((row) => ({ name: row.status, count: row._count._all }))} /> : <NoRows />}
        </ReportPanel>
        <ReportPanel title="Payments" icon={CreditCard} exportHref={href("payments")} exportLabel="Payments CSV">
          <p className="mb-4 text-sm text-slate-500">{paymentTotal} payment records · <strong className="text-slate-900">{context.hospital.currency} {collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> paid or partially paid</p>
          {payments.length ? <Distribution rows={payments.map((row) => ({ name: row.status, count: row._count._all }))} /> : <NoRows />}
        </ReportPanel>
        <ReportPanel title="Staff attendance" icon={Users} exportHref={href("attendance")} exportLabel="Attendance CSV">
          {attendance.length ? <Distribution rows={attendance.map((row) => ({ name: row.status, count: row._count._all }))} /> : <NoRows />}
        </ReportPanel>
      </div>
      <Panel title="Report exports" description="CSV files are generated on request and include records for the selected date range." className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[["Patients", "patients", Users], ["Appointments", "appointments", CalendarDays], ["Diagnostics", "diagnostics", FlaskConical], ["Payments", "payments", CreditCard], ["Staff attendance", "attendance", BarChart3]].map(([label, type, Icon]) => <Link key={type as string} href={href(type as string)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-cyan-200 hover:bg-cyan-50/30"><Icon className="size-4 text-cyan-700" /><span className="flex-1 text-xs font-semibold text-slate-700">{label as string}</span><Download className="size-3.5 text-slate-400" /></Link>)}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof Users }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><p className="text-xs text-slate-500">{label}</p><Icon className="size-4 text-cyan-700" /></div><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p><p className="mt-1 text-[10px] text-slate-400">{note}</p></div>;
}

function ReportPanel({ title, icon: Icon, exportHref, exportLabel, children }: { title: string; icon: typeof CalendarDays; exportHref: string; exportLabel: string; children: React.ReactNode }) {
  return <Panel title={title} action={<Link href={exportHref} className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700"><Download className="size-3.5" /> {exportLabel}</Link>}><span className="sr-only">{Icon.displayName}</span>{children}</Panel>;
}

function Distribution({ rows }: { rows: { name: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return <div className="space-y-3">{rows.map((row) => <div key={row.name}><div className="mb-1.5 flex items-center justify-between"><StatusBadge status={row.name} /><span className="text-xs font-semibold text-slate-800">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: (row.count / max * 100) + "%" }} /></div></div>)}</div>;
}

function NoRows() {
  return <div className="py-8 text-center text-xs text-slate-400">No records in this period.</div>;
}
