import db from "@/lib/db";
import { requirePatient } from "@/lib/patient/auth";
import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";
import { notifyPatient } from "@/lib/patient/notify";

export const dynamic = "force-dynamic";

/**
 * Loads an appointment only when it belongs to a CarePatient record
 * linked to the session user — never trusts an appointment id alone.
 */
async function loadOwnAppointment(userId: string, id: string) {
  return db.careAppointment.findFirst({
    where: { id, patient: { externalUserId: userId } },
    include: {
      hospital: {
        select: {
          id: true,
          name: true,
          phone: true,
          emergencyContact: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
        },
      },
      doctor: {
        select: {
          id: true,
          specialty: true,
          member: { select: { fullName: true, photoUrl: true, title: true } },
        },
      },
      department: { select: { id: true, name: true } },
      patient: { select: { id: true, patientCode: true, firstName: true, lastName: true } },
    },
  });
}

/**
 * GET /api/patient/appointments/[id]
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await context.params;
  if (!id || id.length > 60) return jsonError("Appointment not found", 404);

  const appointment = await loadOwnAppointment(auth.userId, id);
  if (!appointment) return jsonError("Appointment not found", 404);
  return jsonOk({ appointment });
}

const CANCELLABLE = ["REQUESTED", "PENDING", "CONFIRMED", "RESCHEDULED"];

/**
 * PATCH /api/patient/appointments/[id]
 * body: { action: "cancel" } or
 *       { action: "reschedule", date, time, reason? } — a reschedule
 *       *request*; the hospital confirms the new slot.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const { id } = await context.params;
  if (!id || id.length > 60) return jsonError("Appointment not found", 404);

  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const appointment = await loadOwnAppointment(auth.userId, id);
  if (!appointment) return jsonError("Appointment not found", 404);
  if (!CANCELLABLE.includes(appointment.status)) {
    return jsonError(`A ${appointment.status.toLowerCase()} appointment can no longer be changed.`, 409);
  }

  if (body.action === "cancel") {
    const updated = await db.careAppointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED" },
      select: { id: true, status: true },
    });
    await notifyPatient({
      userId: auth.userId,
      hospitalId: appointment.hospitalId,
      title: "Appointment cancelled",
      body: `Your appointment at ${appointment.hospital.name} on ${appointment.appointmentDate.toLocaleDateString()} at ${appointment.time} was cancelled.`,
      category: "APPOINTMENT",
      resourceType: "appointment",
      resourceId: appointment.id,
      href: "/appointments",
    });
    return jsonOk({ appointment: updated });
  }

  if (body.action === "reschedule") {
    const dateValue = typeof body.date === "string" ? body.date : "";
    const time = typeof body.time === "string" ? body.time : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return jsonError("Choose a valid date", 400);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return jsonError("Choose a valid time", 400);

    const proposedDate = new Date(`${dateValue}T12:00:00.000Z`);
    if (Number.isNaN(proposedDate.getTime())) return jsonError("Choose a valid date", 400);

    // The requested slot must actually be free for this doctor.
    if (appointment.doctorId) {
      const conflict = await db.careAppointment.findFirst({
        where: {
          doctorId: appointment.doctorId,
          appointmentDate: proposedDate,
          time,
          status: { notIn: ["CANCELLED", "REJECTED", "NO_SHOW"] },
          id: { not: appointment.id },
        },
        select: { id: true },
      });
      if (conflict) return jsonError("That slot is already taken. Choose another time.", 409);
    }

    const updated = await db.careAppointment.update({
      where: { id: appointment.id },
      data: {
        appointmentDate: proposedDate,
        time,
        reason: reason || appointment.reason,
        status: "RESCHEDULED",
      },
      select: { id: true, status: true, appointmentDate: true, time: true },
    });

    await notifyPatient({
      userId: auth.userId,
      hospitalId: appointment.hospitalId,
      title: "Reschedule requested",
      body: `${appointment.hospital.name} has been asked to move your appointment to ${dateValue} at ${time}.`,
      category: "APPOINTMENT",
      resourceType: "appointment",
      resourceId: appointment.id,
      href: "/appointments",
    });

    return jsonOk({ appointment: updated });
  }

  return jsonError("Unknown action. Use cancel or reschedule.", 400);
}
