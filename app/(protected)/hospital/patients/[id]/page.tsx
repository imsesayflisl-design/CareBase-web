import { createClinicalEncounter, createPrescription, linkCarePatientAccount, updateCarePatient } from "@/app/actions/carebase-clinical";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { Activity, ArrowLeft, CalendarDays, ClipboardPlus, FileText, HeartPulse, Pill, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireCarebasePermission("patients.read");
  const { id } = await params;
  const [clinicalRead, clinicalManage, patientManage, paymentsRead] = await Promise.all([
    canAccess("clinical.read"),
    canAccess("clinical.manage"),
    canAccess("patients.manage"),
    canAccess("payments.read"),
  ]);
  const patient = await db.carePatient.findFirst({
    where: { id, hospitalId: context.hospital.id },
    select: {
      id: true,
      externalUserId: true,
      patientCode: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      gender: true,
      phone: true,
      email: true,
      address: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      bloodGroup: clinicalRead,
      allergies: clinicalRead,
      medicalConditions: clinicalRead,
      medicalHistory: clinicalRead,
      insuranceProvider: true,
      insuranceNumber: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!patient) notFound();
  if (clinicalRead) {
    await recordCarebaseAudit(context, "clinical_records.view", "CarePatient", patient.id, {
      patientCode: patient.patientCode,
      source: "patient_profile",
    });
  }

  const [appointments, encounters, notes, prescriptions, diagnosticOrders, bedRequests, payments] =
    await Promise.all([
      db.careAppointment.findMany({
        where: { hospitalId: context.hospital.id, patientId: id },
        include: { doctor: { include: { member: true } }, department: true },
        orderBy: { appointmentDate: "desc" },
        take: 8,
      }),
      clinicalRead
        ? db.clinicalEncounter.findMany({
            where: { hospitalId: context.hospital.id, patientId: id },
            include: { author: true, notes: { include: { author: true }, orderBy: { createdAt: "desc" } } },
            orderBy: { occurredAt: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
      clinicalRead
        ? db.clinicalNote.findMany({
            where: { hospitalId: context.hospital.id, patientId: id },
            include: { author: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          })
        : Promise.resolve([]),
      clinicalRead
        ? db.prescription.findMany({
            where: { hospitalId: context.hospital.id, patientId: id },
            include: { author: true },
            orderBy: { prescribedAt: "desc" },
          })
        : Promise.resolve([]),
      clinicalRead
        ? db.diagnosticOrder.findMany({
            where: { hospitalId: context.hospital.id, patientId: id },
            include: { service: true, orderedBy: true, completedBy: true },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      db.bedRequest.findMany({
        where: { hospitalId: context.hospital.id, patientId: id },
        include: { ward: true, bed: { include: { room: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      paymentsRead
        ? db.hospitalPayment.findMany({
            where: { hospitalId: context.hospital.id, patientId: id },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

  const appointmentOptions = appointments
    .filter((appointment) => ["REQUESTED", "PENDING", "CONFIRMED", "RESCHEDULED"].includes(appointment.status))
    .map((appointment) => ({ label: format(appointment.appointmentDate, "MMM d") + " · " + appointment.time, value: appointment.id }));

  return (
    <div>
      <Link href="/hospital/patients" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-cyan-700"><ArrowLeft className="size-3.5" /> Patient directory</Link>
      <PageHeader
        eyebrow={patient.patientCode}
        title={patient.firstName + " " + patient.lastName}
        description={"Patient profile · Added " + format(patient.createdAt, "MMMM d, yyyy")}
        action={<Link href="/hospital/appointments" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"><CalendarDays className="size-4" /> Appointments</Link>}
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.6fr]">
        <div className="space-y-5">
          <Panel title="Patient information">
            <div className="mb-5 flex items-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-cyan-50 text-lg font-bold text-cyan-800">{patient.firstName[0]}{patient.lastName[0]}</span>
              <div><p className="font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p><p className="mt-1 text-xs text-slate-500">{patient.gender || "Gender not recorded"}{patient.dateOfBirth ? " · Born " + format(patient.dateOfBirth, "MMM d, yyyy") : ""}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-y-4 border-t border-slate-100 pt-4 text-xs">
              <Info label="Phone" value={patient.phone} />
              <Info label="Email" value={patient.email} />
              <Info label="Address" value={patient.address} />
              <Info label="Emergency contact" value={patient.emergencyContactName} />
              <Info label="Emergency phone" value={patient.emergencyContactPhone} />
              <Info label="Patient ID" value={patient.patientCode} mono />
            </div>
          </Panel>

          {patientManage && (
            <details className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800">Edit contact details</summary>
              <form action={updateCarePatient} className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2">
                <input type="hidden" name="id" value={patient.id} />
                <Field label="First name" name="firstName" defaultValue={patient.firstName} required />
                <Field label="Last name" name="lastName" defaultValue={patient.lastName} required />
                <Field label="Phone" name="phone" type="tel" defaultValue={patient.phone ?? ""} />
                <Field label="Email" name="email" type="email" defaultValue={patient.email ?? ""} />
                <Field label="Address" name="address" defaultValue={patient.address ?? ""} />
                <Field label="Emergency contact" name="emergencyContactName" defaultValue={patient.emergencyContactName ?? ""} />
                <Field label="Emergency phone" name="emergencyContactPhone" type="tel" defaultValue={patient.emergencyContactPhone ?? ""} />
                <div className="sm:col-span-2"><FormSubmit>Save contact details</FormSubmit></div>
              </form>
            </details>
          )}

          {patientManage && (
            <Panel title="Patient portal access" description="Link this chart to the patient's verified Clerk account to share their appointments with the patient portal.">
              {patient.externalUserId ? (
                <p className="flex items-center gap-2 text-xs font-medium text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" /> Patient account connected</p>
              ) : (
                <form action={linkCarePatientAccount} className="space-y-3">
                  <input type="hidden" name="id" value={patient.id} />
                  <p className="text-xs leading-5 text-slate-500">The patient's email must match an existing CareBase patient account with a verified email address.</p>
                  <FormSubmit>Link verified account</FormSubmit>
                </form>
              )}
            </Panel>
          )}

          {clinicalRead && (
            <Panel title="Clinical alerts" description="Visible to staff with clinical record access">
              <div className="space-y-3 text-xs">
                <ClinicalInfo label="Allergies" value={patient.allergies} />
                <ClinicalInfo label="Conditions" value={patient.medicalConditions} />
                <ClinicalInfo label="Medical history" value={patient.medicalHistory} />
                {patient.bloodGroup && <ClinicalInfo label="Blood group" value={patient.bloodGroup} />}
                {!patient.allergies && !patient.medicalConditions && !patient.medicalHistory && !patient.bloodGroup && <p className="text-slate-400">No clinical alerts have been recorded.</p>}
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-5">
          {clinicalManage && (
            <details className="rounded-2xl border border-cyan-100 bg-cyan-50/40">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900"><span className="mr-2">+</span> Add visit / clinical note</summary>
              <form action={createClinicalEncounter} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2">
                <input type="hidden" name="patientId" value={patient.id} />
                <SelectField label="Appointment" name="appointmentId" options={appointmentOptions} />
                <Field label="Reason for visit" name="reason" placeholder="Consultation, follow-up..." />
                <TextAreaField label="Assessment" name="assessment" placeholder="Clinical assessment" rows={3} />
                <TextAreaField label="Diagnosis" name="diagnosis" placeholder="Working diagnosis" rows={3} />
                <TextAreaField label="Clinical note" name="note" placeholder="Document the consultation" rows={3} />
                <TextAreaField label="Treatment plan" name="treatmentPlan" placeholder="Treatment and instructions" rows={3} />
                <TextAreaField label="Follow-up plan" name="followUpPlan" placeholder="Recommended follow-up" rows={2} />
                <div className="md:col-span-2"><FormSubmit>Save clinical encounter</FormSubmit></div>
              </form>
            </details>
          )}

          {clinicalRead && (
            <Panel title="Visit history" description="Clinical entries are append-only and show their author and timestamp" >
              {encounters.length ? <div className="space-y-4">{encounters.map((encounter) => (
                <article key={encounter.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-slate-800">{encounter.reason || "Clinical encounter"}</p><p className="mt-1 text-[11px] text-slate-500">{encounter.author.fullName} · {format(encounter.occurredAt, "MMM d, yyyy · h:mm a")}</p></div><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-cyan-700"><Activity className="size-3.5" /> Visit</span></div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {encounter.assessment && <ClinicalInfo label="Assessment" value={encounter.assessment} />}
                    {encounter.diagnosis && <ClinicalInfo label="Diagnosis" value={encounter.diagnosis} />}
                    {encounter.treatmentPlan && <ClinicalInfo label="Treatment plan" value={encounter.treatmentPlan} />}
                    {encounter.followUpPlan && <ClinicalInfo label="Follow-up" value={encounter.followUpPlan} />}
                  </div>
                  {encounter.notes.map((note) => <p key={note.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600"><strong className="mr-1 text-slate-800">{note.category}:</strong>{note.content}</p>)}
                </article>
              ))}</div> : <EmptyState title="No visits recorded" description="Clinical encounters appear here with their date, author and care plan." />}
            </Panel>
          )}

          {clinicalManage && (
            <details className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-800"><Pill className="mr-2 inline size-4 text-cyan-700" /> Add prescription</summary>
              <form action={createPrescription} className="grid gap-3 border-t border-slate-100 p-5 sm:grid-cols-2">
                <input type="hidden" name="patientId" value={patient.id} />
                <SelectField label="Link to encounter" name="encounterId" options={encounters.map((encounter) => ({ value: encounter.id, label: format(encounter.occurredAt, "MMM d") + " · " + (encounter.reason || "Clinical visit") }))} />
                <Field label="Medication" name="medication" required />
                <Field label="Dosage" name="dosage" placeholder="e.g. 500 mg" required />
                <Field label="Frequency" name="frequency" placeholder="e.g. twice daily" required />
                <Field label="Duration" name="duration" placeholder="e.g. 5 days" required />
                <TextAreaField label="Instructions" name="instructions" rows={2} />
                <div className="sm:col-span-2"><FormSubmit>Save prescription</FormSubmit></div>
              </form>
            </details>
          )}

          {clinicalRead && prescriptions.length > 0 && (
            <Panel title="Prescriptions" description="Medication instructions authored by the care team">
              <div className="space-y-3">{prescriptions.map((prescription) => <div key={prescription.id} className="flex gap-3 rounded-xl border border-slate-100 p-3"><span className="rounded-lg bg-violet-50 p-2 text-violet-700"><Pill className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{prescription.medication} <span className="font-normal text-slate-500">· {prescription.dosage}</span></p><p className="mt-1 text-[11px] text-slate-500">{prescription.frequency} · {prescription.duration}{prescription.instructions ? " · " + prescription.instructions : ""}</p><p className="mt-1 text-[10px] text-slate-400">{prescription.author.fullName} · {format(prescription.prescribedAt, "MMM d, yyyy")}</p></div></div>)}</div>
            </Panel>
          )}

          <Panel title="Appointments & care requests" description="Hospital services linked to this patient">
            <div className="space-y-3">
              {appointments.slice(0, 4).map((appointment) => <div key={appointment.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><CalendarDays className="size-4 text-cyan-700" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{format(appointment.appointmentDate, "MMM d, yyyy")} · {appointment.time}</p><p className="mt-1 truncate text-[11px] text-slate-500">{appointment.doctor?.member.fullName ?? "Doctor unassigned"} · {appointment.department?.name ?? "General"}</p></div><StatusBadge status={appointment.status} /></div>)}
              {diagnosticOrders.slice(0, 3).map((order) => <div key={order.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><HeartPulse className="size-4 text-violet-700" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{order.service.name}</p><p className="mt-1 text-[11px] text-slate-500">{order.service.kind.toLowerCase()} · {format(order.createdAt, "MMM d, yyyy")}</p></div><StatusBadge status={order.status} /></div>)}
              {bedRequests.slice(0, 2).map((request) => <div key={request.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><UserRound className="size-4 text-amber-700" /><div className="flex-1"><p className="text-xs font-semibold text-slate-800">Bed request {request.ward ? "· " + request.ward.name : ""}</p><p className="mt-1 text-[11px] text-slate-500">{format(request.createdAt, "MMM d, yyyy")}</p></div><StatusBadge status={request.status} /></div>)}
              {payments.slice(0, 2).map((payment) => <div key={payment.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><FileText className="size-4 text-emerald-700" /><div className="flex-1"><p className="text-xs font-semibold text-slate-800">{context.hospital.currency} {payment.amount.toFixed(2)} · {payment.receiptNumber}</p><p className="mt-1 text-[11px] text-slate-500">{payment.serviceName}</p></div><StatusBadge status={payment.status} /></div>)}
              {!appointments.length && !diagnosticOrders.length && !bedRequests.length && !payments.length && <p className="py-4 text-center text-xs text-slate-400">No appointments or service requests yet.</p>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return <div className="min-w-0 pr-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className={"mt-1 truncate text-xs text-slate-700 " + (mono ? "font-mono" : "")}>{value || "Not recorded"}</p></div>;
}

function ClinicalInfo({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg bg-amber-50/70 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/70">{label}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{value || "None recorded"}</p></div>;
}
