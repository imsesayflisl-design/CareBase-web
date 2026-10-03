import { createDiagnosticOrder, createDiagnosticService, updateDiagnosticOrder } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import { departmentScope } from "@/lib/carebase/departments";
import { DIAGNOSTIC_SERVICE_PRESETS } from "@/lib/carebase/presets";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { ExportMenu } from "@/components/carebase/export-button";
import { format } from "date-fns";
import { Activity, FlaskConical, History, ScanLine } from "lucide-react";
import Link from "next/link";

export default async function DiagnosticsPage() {
  const context = await requireCarebasePermission("diagnostics.read");
  const canManage = await canAccess("diagnostics.manage");
  const scope = departmentScope(context);
  const orderWhere = {
    hospitalId: context.hospital.id,
    // Department-level isolation: staff only see their own department's orders.
    ...(scope.departmentId ? { service: scope } : {}),
  };
  const [services, orders, patients, departments, pending, inProgress, completed, history] = await Promise.all([
    db.diagnosticService.findMany({
      where: { hospitalId: context.hospital.id },
      include: { department: true, _count: { select: { orders: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    db.diagnosticOrder.findMany({
      where: orderWhere,
      include: { patient: true, service: true, orderedBy: true, completedBy: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 80,
    }),
    canManage ? db.carePatient.findMany({ where: { hospitalId: context.hospital.id }, select: { id: true, firstName: true, lastName: true, patientCode: true }, orderBy: { lastName: "asc" }, take: 200 }) : Promise.resolve([]),
    canManage ? db.department.findMany({ where: { hospitalId: context.hospital.id, status: "ACTIVE" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    db.diagnosticOrder.count({ where: { ...orderWhere, status: "REQUESTED" } }),
    db.diagnosticOrder.count({ where: { ...orderWhere, status: { in: ["SCHEDULED", "IN_PROGRESS"] } } }),
    db.diagnosticOrder.count({ where: { ...orderWhere, status: "COMPLETED" } }),
    db.auditEvent.findMany({
      where: { hospitalId: context.hospital.id, entity: "DiagnosticOrder" },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Tests & scans" description="Manage diagnostic services, track orders and record results for authorized clinicians." action={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-500"><FlaskConical className="size-4 text-cyan-700" /> Diagnostics</div>
            <ExportMenu
              dataset="diagnostics"
              departments={departments}
              patients={patients.map((patient) => ({ id: patient.id, name: patient.firstName + " " + patient.lastName + " · " + patient.patientCode }))}
              kinds
              statuses={[
                { value: "REQUESTED", label: "Pending" },
                { value: "SCHEDULED", label: "Scheduled" },
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CANCELLED", label: "Cancelled" },
              ]}
            />
          </div>
        } />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric label="Awaiting technician" value={pending} /><Metric label="In progress" value={inProgress} /><Metric label="Completed" value={completed} /></div>

      {canManage && <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Add test or scan service</summary>
        <form action={createDiagnosticService} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Service type" name="kind" required options={[{ label: "Laboratory test", value: "TEST" }, { label: "Scan / imaging", value: "SCAN" }]} />
          <SelectField label="Department" name="departmentId" options={departments.map((department) => ({ value: department.id, label: department.name }))} />
          <Field label="Or type a new department" name="departmentName" placeholder="e.g. Ultrasound" />
          <label className="block text-xs font-semibold text-slate-700">
            Service name
            <input name="name" required list="diagnostic-service-presets" placeholder="e.g. Full blood count" className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500" />
            <datalist id="diagnostic-service-presets">
              {DIAGNOSTIC_SERVICE_PRESETS.map((preset) => <option key={preset.name} value={preset.name} />)}
            </datalist>
          </label>
          <Field label={"Price (" + context.hospital.currency + ")"} name="price" type="number" min={0} step="0.01" defaultValue={0} />
          <Field label="Duration (minutes)" name="durationMinutes" type="number" min={1} />
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-slate-600"><input type="checkbox" name="homeServiceAvailable" className="size-4 rounded border-slate-300 text-cyan-700" /> Home service available</label>
          <TextAreaField label="Description" name="description" rows={2} />
          <TextAreaField label="Preparation instructions" name="preparationInstructions" rows={2} />
          <div className="md:col-span-2 xl:col-span-4"><FormSubmit>Save diagnostic service</FormSubmit></div>
        </form>
      </details>}

      {canManage && <details className="mb-5 rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800">+ Create diagnostic order</summary>
        <form action={createDiagnosticOrder} className="grid gap-4 border-t border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Patient" name="patientId" required options={patients.map((patient) => ({ value: patient.id, label: patient.firstName + " " + patient.lastName + " · " + patient.patientCode }))} />
          <SelectField label="Service" name="serviceId" required options={services.filter((service) => service.status === "ACTIVE").map((service) => ({ value: service.id, label: service.kind + " · " + service.name }))} />
          <Field label="Schedule for" name="scheduledAt" type="datetime-local" />
          <Field label="Appointment ID (optional)" name="appointmentId" placeholder="Link to hospital appointment" />
          <TextAreaField label="Order notes" name="notes" rows={2} />
          <div className="md:col-span-2 xl:col-span-4"><FormSubmit>Place diagnostic order</FormSubmit></div>
        </form>
      </details>}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <Panel title="Diagnostic services" description="Services and pricing configured for this hospital">
          {services.length ? <div className="space-y-3">{services.map((service) => <div key={service.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><span className={"rounded-lg p-2 " + (service.kind === "SCAN" ? "bg-violet-50 text-violet-700" : "bg-cyan-50 text-cyan-700")}>{service.kind === "SCAN" ? <ScanLine className="size-4" /> : <FlaskConical className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-slate-800">{service.name}</p><StatusBadge status={service.status} /></div><p className="mt-1 text-[10px] text-slate-500">{service.department?.name ?? "No department"} · {service._count.orders} orders</p>{service.preparationInstructions && <p className="mt-2 text-[10px] leading-4 text-slate-500">{service.preparationInstructions}</p>}</div><strong className="text-xs text-slate-700">{context.hospital.currency} {service.price.toFixed(2)}</strong></div>)}</div> : <EmptyState title="No diagnostic services" description="Add your hospital's laboratory and imaging services." />}
        </Panel>

        <Panel title="Diagnostic orders" description="Results are visible to clinical staff with medical record access">
          {orders.length ? <div className="space-y-3">{orders.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Link href={"/hospital/patients/" + order.patientId} className="text-xs font-semibold text-slate-800 hover:text-cyan-700">{order.patient.firstName} {order.patient.lastName}</Link><p className="mt-1 text-[11px] text-slate-500">{order.service.kind} · {order.service.name} · {format(order.createdAt, "MMM d, yyyy")}</p><p className="mt-1 text-[10px] text-slate-400">Ordered by {order.orderedBy.fullName}{order.completedBy ? " · Completed by " + order.completedBy.fullName : ""}</p></div><StatusBadge status={order.status} /></div>{order.result && <div className="mt-3 rounded-lg bg-emerald-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">Result</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{order.result}</p></div>}{canManage && order.status !== "COMPLETED" && order.status !== "CANCELLED" && <form action={updateDiagnosticOrder} className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-[1fr_1.5fr_auto]"><input type="hidden" name="orderId" value={order.id} /><select name="status" defaultValue={order.status} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="REQUESTED">Requested</option><option value="SCHEDULED">Scheduled</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select><input name="result" placeholder="Enter result or technician note" className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500" /><button className="rounded-lg bg-cyan-700 px-3 text-[10px] font-semibold text-white">Update</button></form>}</article>)}</div> : <EmptyState title="No diagnostic orders" description="When tests and scans are ordered, the technician queue will appear here." />}
        </Panel>
      </div>

      <Panel
        title="Complete test & scan history"
        description="Every order event, in order — recorded by the system and cannot be edited"
        className="mt-5"
      >
        {history.length ? (
          <div className="space-y-2">
            {history.map((event) => (
              <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <History className="size-4 text-cyan-700" />
                  <span className="font-semibold text-slate-800">{event.action}</span>
                  <span className="text-slate-400">· {event.actorName ?? "system"}</span>
                </div>
                <span className="text-[11px] text-slate-400">{format(event.createdAt, "MMM d, yyyy HH:mm")}</span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No history yet" description="Order events are recorded here as they happen." />
        )}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>;
}
