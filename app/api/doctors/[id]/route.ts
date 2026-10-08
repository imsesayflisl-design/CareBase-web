import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * GET /api/doctors/[id]
 * Doctor profile + weekly schedule (real DoctorSchedule rows).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const { id } = await context.params;
  if (!id || id.length > 60) return jsonError("Doctor not found", 404);

  const doctor = await db.doctorProfile.findFirst({
    where: {
      id,
      member: { status: "ACTIVE" },
      hospital: { status: "ACTIVE" },
    },
    select: {
      id: true,
      specialty: true,
      subSpecialty: true,
      qualifications: true,
      yearsExperience: true,
      biography: true,
      languages: true,
      services: true,
      consultationType: true,
      consultationFee: true,
      availabilityStatus: true,
      member: { select: { fullName: true, photoUrl: true, title: true, phone: true } },
      department: { select: { id: true, name: true } },
      hospital: {
        select: {
          id: true,
          name: true,
          city: true,
          address: true,
          phone: true,
          latitude: true,
          longitude: true,
        },
      },
      schedules: {
        where: { isAvailable: true },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
          breakStart: true,
          breakEnd: true,
          slotMinutes: true,
        },
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });
  if (!doctor) return jsonError("Doctor not found", 404);

  const schedule = doctor.schedules.map((entry) => ({
    ...entry,
    dayName: DAYS[entry.dayOfWeek] ?? String(entry.dayOfWeek),
  }));

  return jsonOk({ doctor: { ...doctor, schedules: schedule } });
}
