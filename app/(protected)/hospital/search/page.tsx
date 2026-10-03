import { requireCarebaseContext } from "@/lib/carebase/context";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { format } from "date-fns";
import { Search } from "lucide-react";
import Link from "next/link";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HospitalSearchPage({ searchParams }: SearchPageProps) {
  const context = await requireCarebaseContext();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const permissions = new Set(context.role.permissions);
  const can = (permission: string) => permissions.has("*") || permissions.has(permission);
  const enabled = query.length >= 2;
  const contains = { contains: query, mode: "insensitive" as const };

  const [patients, staff, appointments, encounters, diagnostics, beds, payments] = await Promise.all([
    enabled && can("patients.read")
      ? db.carePatient.findMany({
          where: {
            hospitalId: context.hospital.id,
            OR: [
              { firstName: contains },
              { lastName: contains },
              { patientCode: contains },
              { phone: contains },
              { email: contains },
            ],
          },
          select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("staff.read")
      ? db.hospitalMember.findMany({
          where: {
            hospitalId: context.hospital.id,
            status: "ACTIVE",
            OR: [{ fullName: contains }, { email: contains }, { title: contains }],
          },
          include: { role: true, doctorProfile: { include: { department: true } } },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("appointments.read")
      ? db.careAppointment.findMany({
          where: {
            hospitalId: context.hospital.id,
            OR: [
              { reason: contains },
              { patient: { firstName: contains } },
              { patient: { lastName: contains } },
              { patient: { patientCode: contains } },
            ],
          },
          include: { patient: true, doctor: { include: { member: true } } },
          orderBy: { appointmentDate: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("clinical.read")
      ? db.clinicalEncounter.findMany({
          where: {
            hospitalId: context.hospital.id,
            OR: [
              { diagnosis: contains },
              { reason: contains },
              { patient: { firstName: contains } },
              { patient: { lastName: contains } },
              { patient: { patientCode: contains } },
            ],
          },
          include: { patient: true },
          orderBy: { occurredAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("diagnostics.read")
      ? db.diagnosticOrder.findMany({
          where: {
            hospitalId: context.hospital.id,
            OR: [
              { service: { name: contains } },
              { patient: { firstName: contains } },
              { patient: { lastName: contains } },
              { patient: { patientCode: contains } },
            ],
          },
          include: { service: true, patient: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("beds.read")
      ? db.bed.findMany({
          where: {
            room: {
              ward: {
                hospitalId: context.hospital.id,
                OR: [{ name: contains }, { rooms: { some: { name: contains } } }],
              },
            },
            OR: [{ label: contains }, { room: { name: contains } }],
          },
          include: { room: { include: { ward: true } } },
          take: 8,
        })
      : Promise.resolve([]),
    enabled && can("payments.read")
      ? db.hospitalPayment.findMany({
          where: {
            hospitalId: context.hospital.id,
            OR: [
              { receiptNumber: contains },
              { serviceName: contains },
              { patient: { firstName: contains } },
              { patient: { lastName: contains } },
              { patient: { patientCode: contains } },
            ],
          },
          include: { patient: true },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const resultCount = patients.length + staff.length + appointments.length + encounters.length + diagnostics.length + beds.length + payments.length;
  if (enabled && can("clinical.read")) {
    await recordCarebaseAudit(context, "clinical.search_completed", "ClinicalEncounter", undefined, {
      resultCount: encounters.length,
    });
  }

  return (
    <div>
      <PageHeader title="Search records" description="Find records you are allowed to access in this hospital." />
      <form action="/hospital/search" className="mb-6 flex max-w-2xl gap-2">
        <label className="flex h-12 flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 focus-within:border-cyan-500">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input name="q" defaultValue={query} placeholder="Patient, staff member, appointment or service" className="w-full bg-transparent text-sm outline-none" autoFocus />
        </label>
        <button className="rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800">Search</button>
      </form>

      {!enabled ? (
        <Panel title="Search your hospital workspace" description="Enter at least two characters. Results are limited to your hospital and your role permissions.">
          <p className="text-sm text-slate-500">Search for patients, appointments, staff, clinical encounters, diagnostics, beds, and payments available to your role.</p>
        </Panel>
      ) : resultCount === 0 ? (
        <EmptyState title="No matching records" description="Try a different name, patient ID, service or receipt number." />
      ) : (
        <div className="space-y-5">
          {patients.length > 0 && <Panel title="Patients" description={`${patients.length} result${patients.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{patients.map((patient) => <Link key={patient.id} href={`/hospital/patients/${patient.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50"><div><p className="text-sm font-semibold text-slate-800">{patient.firstName} {patient.lastName}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{patient.patientCode}</p></div><span className="text-xs text-slate-500">{patient.phone || "Patient"}</span></Link>)}</div>
          </Panel>}
          {staff.length > 0 && <Panel title="Staff" description={`${staff.length} result${staff.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{staff.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{member.fullName}</p><p className="mt-1 text-xs text-slate-500">{member.doctorProfile?.specialty || member.title || member.role.name.replaceAll("_", " ")}{member.doctorProfile?.department ? ` · ${member.doctorProfile.department.name}` : ""}</p></div><span className="text-xs text-slate-500">{member.email}</span></div>)}</div>
          </Panel>}
          {appointments.length > 0 && <Panel title="Appointments" description={`${appointments.length} result${appointments.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{appointments.map((appointment) => <div key={appointment.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{appointment.patient.firstName} {appointment.patient.lastName} · {appointment.reason || "Appointment"}</p><p className="mt-1 text-xs text-slate-500">{format(appointment.appointmentDate, "MMM d, yyyy")} · {appointment.time} · {appointment.doctor?.member.fullName || "Doctor unassigned"}</p></div><Link href="/hospital/appointments" className="text-xs font-semibold text-cyan-700">Open schedule</Link></div>)}</div>
          </Panel>}
          {encounters.length > 0 && <Panel title="Clinical records" description={`${encounters.length} result${encounters.length === 1 ? "" : "s"} · clinical access granted`}>
            <div className="divide-y divide-slate-100">{encounters.map((encounter) => <Link key={encounter.id} href={`/hospital/patients/${encounter.patientId}`} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{encounter.patient.firstName} {encounter.patient.lastName} · {encounter.diagnosis || encounter.reason || "Clinical encounter"}</p><p className="mt-1 text-xs text-slate-500">{format(encounter.occurredAt, "MMM d, yyyy")}</p></div><span className="text-xs font-semibold text-cyan-700">Open record</span></Link>)}</div>
          </Panel>}
          {diagnostics.length > 0 && <Panel title="Tests & scans" description={`${diagnostics.length} result${diagnostics.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{diagnostics.map((order) => <div key={order.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{order.service.name} · {order.patient.firstName} {order.patient.lastName}</p><p className="mt-1 text-xs text-slate-500">{order.service.kind.toLowerCase()} · {order.status.toLowerCase().replaceAll("_", " ")}</p></div><Link href="/hospital/diagnostics" className="text-xs font-semibold text-cyan-700">Open diagnostics</Link></div>)}</div>
          </Panel>}
          {beds.length > 0 && <Panel title="Beds & wards" description={`${beds.length} result${beds.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{beds.map((bed) => <div key={bed.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{bed.room.ward.name} · {bed.room.name} · {bed.label}</p><p className="mt-1 text-xs text-slate-500">{bed.status.toLowerCase()}</p></div><Link href="/hospital/beds" className="text-xs font-semibold text-cyan-700">Open beds</Link></div>)}</div>
          </Panel>}
          {payments.length > 0 && <Panel title="Payments" description={`${payments.length} result${payments.length === 1 ? "" : "s"}`}>
            <div className="divide-y divide-slate-100">{payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm font-semibold text-slate-800">{payment.receiptNumber} · {payment.patient.firstName} {payment.patient.lastName}</p><p className="mt-1 text-xs text-slate-500">{payment.serviceName} · {payment.currency} {payment.amount.toFixed(2)}</p></div><Link href="/hospital/payments" className="text-xs font-semibold text-cyan-700">Open payments</Link></div>)}</div>
          </Panel>}
        </div>
      )}
    </div>
  );
}
