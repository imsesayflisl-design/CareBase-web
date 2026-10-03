import { createCarePatient } from "@/app/actions/carebase-clinical";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { Panel, Field, FormSubmit, SelectField } from "@/components/carebase/panel";
import { ExportMenu } from "@/components/carebase/export-button";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requireCarebasePermission("patients.read");
  const canCreate = await canAccess("patients.manage");
  const { q = "" } = await searchParams;
  const search = q.trim();
  const departments = await db.department.findMany({
    where: { hospitalId: context.hospital.id, status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const where = {
    hospitalId: context.hospital.id,
    ...(search
      ? {
          OR: [
            { patientCode: { contains: search, mode: "insensitive" as const } },
            { firstName: { contains: search, mode: "insensitive" as const } },
            { lastName: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [patients, total, activeToday] = await Promise.all([
    db.carePatient.findMany({
      where,
      include: { _count: { select: { appointments: true, encounters: true } } },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    db.carePatient.count({ where: { hospitalId: context.hospital.id } }),
    db.carePatient.count({
      where: { hospitalId: context.hospital.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Patients"
        description="Register patients, find existing records and follow their visits across your hospital."
        action={
          <div className="flex items-center gap-3">
            <ExportMenu dataset="patients" departments={departments} />
            {canCreate && <a href="#register-patient" className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800"><UserPlus className="size-4" /> Register patient</a>}
          </div>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MiniMetric label="Patient records" value={total.toLocaleString()} icon={Users} />
        <MiniMetric label="Added today" value={activeToday.toLocaleString()} icon={UserPlus} />
        <MiniMetric label="Showing" value={patients.length.toLocaleString()} icon={Search} />
      </div>

      {canCreate && (
        <details id="register-patient" className="group mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900 marker:hidden">+ Register a patient <span className="ml-2 text-xs font-normal text-cyan-700">Add a new hospital patient record</span></summary>
          <div className="border-t border-cyan-100 bg-white p-5 md:p-6">
            <form action={createCarePatient} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="First name" name="firstName" required />
              <Field label="Last name" name="lastName" required />
              <Field label="Date of birth" name="dateOfBirth" type="date" />
              <SelectField label="Gender" name="gender" options={[{ label: "Female", value: "Female" }, { label: "Male", value: "Male" }, { label: "Other", value: "Other" }]} />
              <Field label="Phone" name="phone" type="tel" />
              <Field label="Email" name="email" type="email" />
              <Field label="Address" name="address" />
              <Field label="Emergency contact" name="emergencyContactName" />
              <Field label="Emergency contact phone" name="emergencyContactPhone" type="tel" />
              <div className="sm:col-span-2 lg:col-span-3"><FormSubmit>Save patient record</FormSubmit></div>
            </form>
          </div>
        </details>
      )}

      <Panel title="Patient directory" description={search ? "Search results for “" + search + "”" : "Search by patient ID, name or phone number."} action={<form className="relative" action="/hospital/patients"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input name="q" defaultValue={search} placeholder="Search patients..." className="h-9 w-56 rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-cyan-500" /></form>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Patient</th><th className="pb-3">Contact</th><th className="pb-3">Date added</th><th className="pb-3">Appointments</th><th className="pb-3">Visits</th><th className="pb-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((patient) => (
                <tr key={patient.id} className="text-xs">
                  <td className="py-3.5"><Link href={"/hospital/patients/" + patient.id} className="font-semibold text-slate-800 hover:text-cyan-700">{patient.firstName} {patient.lastName}</Link><p className="mt-1 font-mono text-[10px] text-slate-400">{patient.patientCode}</p></td>
                  <td className="py-3.5 text-slate-600">{patient.phone || patient.email || "No contact"}</td>
                  <td className="py-3.5 text-slate-600">{format(patient.createdAt, "MMM d, yyyy")}</td>
                  <td className="py-3.5 text-slate-600">{patient._count.appointments}</td>
                  <td className="py-3.5 text-slate-600">{patient._count.encounters}</td>
                  <td className="py-3.5 text-right"><Link href={"/hospital/patients/" + patient.id} className="font-semibold text-cyan-700 hover:text-cyan-900">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!patients.length && <div className="py-10 text-center"><p className="text-sm font-semibold text-slate-700">{search ? "No matching patients" : "No patients registered yet"}</p><p className="mt-1 text-xs text-slate-500">{search ? "Try a different name, phone number or patient ID." : "Register a patient to start their hospital record."}</p></div>}
        </div>
        {patients.length === 60 && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">Showing the latest 60 records. Use search to find older patients.</p>}
      </Panel>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-900">{value}</p></div></div>;
}
