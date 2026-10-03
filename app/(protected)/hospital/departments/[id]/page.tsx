import { requireCarebasePermission } from "@/lib/carebase/context";
import { departmentScope } from "@/lib/carebase/departments";
import db from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, FlaskConical, Stethoscope, Users } from "lucide-react";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { ExportMenu } from "@/components/carebase/export-button";

export default async function DepartmentDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireCarebasePermission("departments.read");
  const { id } = await params;
  const scope = departmentScope(context);

  // Resolve the id against BOTH the hospital and the caller's department scope,
  // so a department-bound member can never open another department's dashboard.
  const department = await db.department.findFirst({
    where: { id, hospitalId: context.hospital.id },
  });
  if (!department) notFound();
  if (scope.departmentId && !scope.departmentId.in.includes(department.id)) notFound();

  const where = { hospitalId: context.hospital.id, departmentId: department.id };

  const [staffCount, doctors, appointments, orders, attendanceCount, patientRows, recentOrders] =
    await Promise.all([
      db.departmentMember.count({ where }),
      db.doctorProfile.findMany({
        where: { hospitalId: context.hospital.id, departmentId: department.id },
        include: { member: { select: { fullName: true } } },
        take: 6,
      }),
      db.careAppointment.findMany({
        where: { hospitalId: context.hospital.id, departmentId: department.id },
        include: {
          patient: { select: { patientCode: true, firstName: true, lastName: true } },
        },
        orderBy: [{ appointmentDate: "desc" }, { time: "asc" }],
        take: 6,
      }),
      db.diagnosticOrder.count({
        where: { hospitalId: context.hospital.id, service: { departmentId: department.id } },
      }),
      db.staffAttendance.count({
        where: { hospitalId: context.hospital.id, departmentId: department.id },
      }),
      db.careAppointment.findMany({
        where: { hospitalId: context.hospital.id, departmentId: department.id },
        select: {
          patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
        },
        distinct: ["patientId"],
        take: 40,
      }),
      db.diagnosticOrder.findMany({
        where: { hospitalId: context.hospital.id, service: { departmentId: department.id } },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          service: { select: { name: true, kind: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
    ]);

  const patients = patientRows.map((row) => row.patient);

  return (
    <div>
      <PageHeader
        eyebrow={context.hospital.name}
        title={department.name}
        description={
          department.description ||
          "Everything recorded for this department: staff, patients, appointments, tests and scans."
        }
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/hospital/departments"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:border-cyan-300"
            >
              <ArrowLeft className="size-4" /> All departments
            </Link>
            <ExportMenu
              dataset="department"
              departments={[{ id: department.id, name: department.name }]}
              defaultDepartmentId={department.id}
            />
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Department staff" value={staffCount} icon={Users} />
        <Metric label="Doctors" value={doctors.length} icon={Stethoscope} />
        <Metric label="Appointments shown" value={appointments.length} icon={CalendarDays} />
        <Metric label="Tests & scans" value={orders} icon={FlaskConical} />
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Info label="Patients seen here" value={String(patients.length)} />
        <Info label="Attendance entries" value={String(attendanceCount)} />
        <Info label="Location" value={department.location || "Not set"} />
        <Info label="Status" value={department.status} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Department patients" description="Distinct patients with an appointment in this department">
          {patients.length ? (
            <div className="space-y-2">
              {patients.map((patient) => (
                <Link
                  key={patient.id}
                  href={"/hospital/patients/" + patient.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-xs transition hover:border-cyan-200"
                >
                  <span className="font-semibold text-slate-800">
                    {patient.firstName} {patient.lastName}
                  </span>
                  <span className="text-slate-400">{patient.patientCode}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No patients in this department yet"
              description="Patients appear here once an appointment is booked for this department."
            />
          )}
        </Panel>

        <Panel title="Department staff" description="Members assigned to this department">
          {doctors.length ? (
            <div className="space-y-2">
              {doctors.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-xs"
                >
                  <span className="font-semibold text-slate-800">{doctor.member.fullName}</span>
                  <span className="capitalize text-slate-500">Doctor</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No doctors assigned" description="Assign staff to this department from Staff & access." />
          )}
        </Panel>

        <Panel title="Recent appointments" description="Booked for this department">
          {appointments.length ? (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {appointment.patient.firstName} {appointment.patient.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {format(appointment.appointmentDate, "MMM d, yyyy")} · {appointment.time}
                    </p>
                  </div>
                  <StatusBadge status={appointment.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No appointments" description="Appointments booked for this department appear here." />
          )}
        </Panel>

        <Panel title="Tests & scans" description="Diagnostic orders handled by this department">
          {recentOrders.length ? (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {order.patient.firstName} {order.patient.lastName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {order.service.kind} · {order.service.name}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No tests or scans" description="Diagnostic orders for this department appear here." />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
