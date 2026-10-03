import { createBedRequest, reviewBedRequest } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { BedDouble, ClipboardCheck } from "lucide-react";
import Link from "next/link";

export default async function BedRequestsPage() {
  const context = await requireCarebasePermission("beds.read");
  const canManage = await canAccess("beds.manage");
  const [requests, patients, wards, availableBeds, pending, reviewed] = await Promise.all([
    db.bedRequest.findMany({
      where: { hospitalId: context.hospital.id },
      include: { patient: true, ward: true, bed: { include: { room: true } }, reviewedBy: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    canManage ? db.carePatient.findMany({ where: { hospitalId: context.hospital.id }, select: { id: true, firstName: true, lastName: true, patientCode: true }, orderBy: { lastName: "asc" }, take: 200 }) : Promise.resolve([]),
    canManage ? db.ward.findMany({ where: { hospitalId: context.hospital.id, status: "ACTIVE" }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    canManage ? db.bed.findMany({ where: { status: "AVAILABLE", room: { ward: { hospitalId: context.hospital.id } } }, include: { room: { include: { ward: true } } }, orderBy: [{ room: { ward: { name: "asc" } } }, { label: "asc" }] }) : Promise.resolve([]),
    db.bedRequest.count({ where: { hospitalId: context.hospital.id, status: "REQUESTED" } }),
    db.bedRequest.count({ where: { hospitalId: context.hospital.id, status: { in: ["APPROVED", "REJECTED"] } } }),
  ]);

  return (
    <div>
      <PageHeader title="Bed requests" description="Review inpatient bed requests and reserve available capacity for patients." action={<Link href="/hospital/beds" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"><BedDouble className="size-4 text-cyan-700" /> Bed inventory</Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric label="Awaiting review" value={pending} /><Metric label="Reviewed" value={reviewed} /><Metric label="Available beds" value={availableBeds.length} /></div>

      {canManage && <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Record a bed request</summary>
        <form action={createBedRequest} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Patient" name="patientId" required options={patients.map((patient) => ({ value: patient.id, label: patient.firstName + " " + patient.lastName + " · " + patient.patientCode }))} />
          <SelectField label="Requested ward" name="wardId" options={wards.map((ward) => ({ value: ward.id, label: ward.name }))} />
          <Field label="Requested date" name="requestedFor" type="date" />
          <TextAreaField label="Reason / care needs" name="reason" rows={2} />
          <div className="md:col-span-2 xl:col-span-4"><FormSubmit>Save bed request</FormSubmit></div>
        </form>
      </details>}

      <Panel title="Requests" description="Approving a request reserves an available bed so it cannot be assigned twice.">
        {requests.length ? <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-52 flex-1 items-start gap-3"><span className="rounded-lg bg-cyan-50 p-2 text-cyan-700"><BedDouble className="size-4" /></span><div><Link href={"/hospital/patients/" + request.patientId} className="text-sm font-semibold text-slate-800 hover:text-cyan-700">{request.patient.firstName} {request.patient.lastName}</Link><p className="mt-1 font-mono text-[10px] text-slate-400">{request.patient.patientCode} · Requested {format(request.createdAt, "MMM d, yyyy")}</p><p className="mt-1 text-xs text-slate-500">{request.ward?.name ?? "Any ward"}{request.requestedFor ? " · " + format(request.requestedFor, "MMM d, yyyy") : ""}{request.reason ? " · " + request.reason : ""}</p></div></div>
                <StatusBadge status={request.status} />
              </div>
              {request.bed && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Reserved: {request.bed.room.wardId ? request.ward?.name : "Ward"} · {request.bed.room.name} · {request.bed.label}</p>}
              {request.reviewNote && <p className="mt-2 text-xs text-slate-500">Review note: {request.reviewNote}</p>}
              {canManage && request.status === "REQUESTED" && <form action={reviewBedRequest} className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_1fr_auto_auto]"><input type="hidden" name="requestId" value={request.id} /><select name="bedId" className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="">Auto-assign available bed</option>{availableBeds.filter((bed) => !request.wardId || bed.room.wardId === request.wardId).map((bed) => <option key={bed.id} value={bed.id}>{bed.room.ward.name} · {bed.room.name} · {bed.label}</option>)}</select><input name="reviewNote" placeholder="Review note" className="h-9 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500" /><button name="status" value="APPROVED" className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-emerald-700 px-3 text-[11px] font-semibold text-white"><ClipboardCheck className="size-3.5" /> Approve</button><button name="status" value="REJECTED" className="h-9 rounded-lg border border-rose-200 px-3 text-[11px] font-semibold text-rose-700 hover:bg-rose-50">Reject</button></form>}
            </article>
          ))}
        </div> : <EmptyState title="No bed requests" description="Requests created by patients or recorded by your team will show here." />}
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>;
}
