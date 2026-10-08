import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/** Local date/time parts for an IANA timezone. */
function localParts(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    time: `${part("hour")}:${part("minute")}`,
  };
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function toLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * GET /api/appointments/availability?doctorId=&date=YYYY-MM-DD
 * Returns real open slots: DoctorSchedule for that weekday, minus break,
 * minus already-booked appointments. Never fabricates availability.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const url = new URL(request.url);
  const doctorId = (url.searchParams.get("doctorId") ?? "").trim();
  const dateValue = url.searchParams.get("date") ?? "";
  if (!doctorId || doctorId.length > 60) return jsonError("doctorId is required", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return jsonError("Choose a valid date", 400);

  const appointmentDate = new Date(`${dateValue}T12:00:00.000Z`);
  if (Number.isNaN(appointmentDate.getTime())) return jsonError("Choose a valid date", 400);

  const doctor = await db.doctorProfile.findFirst({
    where: { id: doctorId, member: { status: "ACTIVE" }, hospital: { status: "ACTIVE" } },
    select: {
      id: true,
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
      },
      hospital: { select: { timezone: true } },
    },
  });
  if (!doctor) return jsonError("Doctor not found", 404);

  // JS getDay(): 0 = Sunday, matching the backend's DAYS convention.
  const dayOfWeek = appointmentDate.getUTCDay();
  const schedule = doctor.schedules.find((entry) => entry.dayOfWeek === dayOfWeek);
  if (!schedule) {
    return jsonOk({ slots: [], reason: "The doctor does not work on this day." });
  }

  const [booked, hospitalNow] = await Promise.all([
    db.careAppointment.findMany({
      where: {
        doctorId: doctor.id,
        appointmentDate,
        status: { notIn: ["CANCELLED", "REJECTED", "NO_SHOW"] },
      },
      select: { time: true },
    }),
    Promise.resolve(localParts(doctor.hospital.timezone)),
  ]);

  const bookedTimes = new Set(booked.map((entry) => entry.time));
  const slotMinutes = Math.max(schedule.slotMinutes, 10);
  const start = toMinutes(schedule.startTime);
  const end = toMinutes(schedule.endTime);
  const breakStart = schedule.breakStart ? toMinutes(schedule.breakStart) : null;
  const breakEnd = schedule.breakEnd ? toMinutes(schedule.breakEnd) : null;

  const slots: Array<{ time: string; available: boolean }> = [];
  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    const time = toLabel(cursor);
    const inBreak =
      breakStart !== null && breakEnd !== null && cursor < breakEnd && cursor + slotMinutes > breakStart;
    const past = dateValue < hospitalNow.date || (dateValue === hospitalNow.date && time <= hospitalNow.time);
    const taken = bookedTimes.has(time);
    slots.push({ time, available: !inBreak && !past && !taken });
  }

  return jsonOk({
    slots,
    date: dateValue,
    slotMinutes,
    availableCount: slots.filter((slot) => slot.available).length,
  });
}
