import { requireCarebasePermission } from "@/lib/carebase/context";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { format } from "date-fns";
import { Activity, FileText } from "lucide-react";
import Link from "next/link";

export default async function MedicalRecordsPage() {
  const context = await requireCarebasePermission("clinical.read");
  const [encounters, noteCount, prescriptions] = await Promise.all([
    db.clinicalEncounter.findMany({
      where: { hospitalId: context.hospital.id },
      include: {
        patient: true,
        author: true,
        notes: { orderBy: { createdAt: "desc" }, take: 2 },
        prescriptions: { select: { id: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 100,
    }),
    db.clinicalNote.count({ where: { hospitalId: context.hospital.id } }),
    db.prescription.count({ where: { hospitalId: context.hospital.id } }),
  ]);
  await recordCarebaseAudit(context, "clinical_records.list", "ClinicalEncounter", undefined, {
    resultCount: encounters.length,
  });

  return (
    <div>
      <PageHeader title="Medical records" description="Clinical encounters, notes, diagnoses and prescriptions created by your care team." action={<div className="flex items-center gap-2 text-xs text-slate-500"><Activity className="size-4 text-cyan-700" /> Restricted clinical data</div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3"><Metric label="Visits recorded" value={encounters.length} /><Metric label="Clinical notes" value={noteCount} /><Metric label="Prescriptions" value={prescriptions} /></div>
      <Panel title="Recent encounters" description="Records are preserved as a timeline and include their author.">
        {encounters.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
          <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Patient</th><th className="pb-3">Visit date</th><th className="pb-3">Reason</th><th className="pb-3">Diagnosis</th><th className="pb-3">Author</th><th className="pb-3">Records</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{encounters.map((encounter) => <tr key={encounter.id} className="text-xs"><td className="py-3.5"><Link href={"/hospital/patients/" + encounter.patientId} className="font-semibold text-slate-800 hover:text-cyan-700">{encounter.patient.firstName} {encounter.patient.lastName}</Link><p className="mt-1 font-mono text-[10px] text-slate-400">{encounter.patient.patientCode}</p></td><td className="py-3.5 text-slate-600">{format(encounter.occurredAt, "MMM d, yyyy · h:mm a")}</td><td className="py-3.5 text-slate-600">{encounter.reason || "Consultation"}</td><td className="max-w-52 py-3.5 text-slate-600">{encounter.diagnosis || "—"}</td><td className="py-3.5 text-slate-600">{encounter.author.fullName}</td><td className="py-3.5 text-slate-500">{encounter.notes.length} notes · {encounter.prescriptions.length} prescriptions</td></tr>)}</tbody>
        </table></div> : <EmptyState title="No medical records yet" description="Clinical encounters and notes will appear here as clinicians document patient visits." />}
      </Panel>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-400"><FileText className="size-3.5" /> Access to this page is granted by the hospital's clinical.read permission.</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-900">{value}</p></div>;
}
