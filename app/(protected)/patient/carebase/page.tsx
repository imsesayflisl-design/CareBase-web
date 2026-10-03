import { auth } from "@clerk/nextjs/server";
import db from "@/lib/db";
import { PatientAppointmentForm } from "@/components/carebase/patient-appointment-form";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { ArrowLeft, Building2, CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function PatientCareBasePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const records = await db.carePatient.findMany({
    where: { externalUserId: userId, hospital: { status: "ACTIVE" } },
    include: {
      hospital: { select: { id: true, name: true, city: true, phone: true, currency: true } },
      appointments: {
        include: {
          doctor: { include: { member: true } },
          department: true,
        },
        orderBy: [{ appointmentDate: "desc" }, { time: "desc" }],
        take: 10,
      },
    },
    orderBy: { hospital: { name: "asc" } },
  });
  const hospitalIds = records.map((record) => record.hospitalId);
  const [doctors, departments] = await Promise.all([
    db.doctorProfile.findMany({
      where: { hospitalId: { in: hospitalIds }, availabilityStatus: "AVAILABLE", member: { status: "ACTIVE" } },
      include: { member: true },
      orderBy: { member: { fullName: "asc" } },
    }),
    db.department.findMany({
      where: { hospitalId: { in: hospitalIds }, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 md:px-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/patient" className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-cyan-700"><ArrowLeft className="size-3.5" /> Patient dashboard</Link>
        <div className="mb-7">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-cyan-800"><Building2 className="size-4" /> Connected hospitals</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Your hospital care</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">View appointments and request visits with hospitals that have securely linked your CareBase patient account.</p>
        </div>

        {!records.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <Building2 className="mx-auto size-8 text-slate-300" />
            <h2 className="mt-4 text-base font-semibold text-slate-800">No hospitals connected yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Ask your hospital team to link the email on your verified patient account to your hospital record.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {records.map((record) => {
              const hospitalDoctors = doctors.filter((doctor) => doctor.hospitalId === record.hospitalId).map((doctor) => ({ id: doctor.id, label: doctor.member.fullName + (doctor.specialty ? " · " + doctor.specialty : "") }));
              const hospitalDepartments = departments.filter((department) => department.hospitalId === record.hospitalId).map((department) => ({ id: department.id, label: department.name }));
              return (
                <section key={record.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{record.hospital.name}</h2>
                      <p className="mt-1 text-xs text-slate-500">{record.hospital.city || "Hospital"} · Patient ID {record.patientCode}{record.hospital.phone ? " · " + record.hospital.phone : ""}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700">Connected</span>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-slate-800"><CalendarDays className="size-4 text-cyan-700" /> Appointments</h3>
                    {record.appointments.length ? (
                      <div className="mt-3 divide-y divide-slate-100">
                        {record.appointments.map((appointment) => <div key={appointment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div><p className="text-sm font-semibold text-slate-800">{format(appointment.appointmentDate, "EEE, MMM d, yyyy")} · {appointment.time}</p><p className="mt-1 text-xs text-slate-500">{appointment.doctor?.member.fullName || "Doctor unassigned"}{appointment.department ? " · " + appointment.department.name : ""}{appointment.reason ? " · " + appointment.reason : ""}</p></div>
                          <StatusBadge status={appointment.status} />
                        </div>)}
                      </div>
                    ) : <p className="mt-3 text-xs text-slate-500">No appointments yet.</p>}
                  </div>
                  <PatientAppointmentForm hospitalId={record.hospitalId} doctors={hospitalDoctors} departments={hospitalDepartments} />
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
