import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/hospitals/[id]
 * Full hospital profile: departments, doctors, published notices,
 * and bed availability summary (where hospitals provide it).
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const { id } = await context.params;
  if (!id || id.length > 60) return jsonError("Hospital not found", 404);

  const hospital = await db.hospital.findFirst({
    where: { id, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      description: true,
      logoUrl: true,
      address: true,
      city: true,
      region: true,
      country: true,
      phone: true,
      email: true,
      emergencyContact: true,
      website: true,
      openingHours: true,
      services: true,
      latitude: true,
      longitude: true,
      departments: {
        where: { status: "ACTIVE" },
        select: { id: true, name: true, description: true, location: true, contact: true },
        orderBy: { name: "asc" },
      },
      doctorProfiles: {
        where: { member: { status: "ACTIVE" }, availabilityStatus: "AVAILABLE" },
        select: {
          id: true,
          specialty: true,
          subSpecialty: true,
          consultationFee: true,
          availabilityStatus: true,
          member: { select: { fullName: true, photoUrl: true, title: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { member: { fullName: "asc" } },
        take: 50,
      },
      notices: {
        where: {
          status: "PUBLISHED",
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true, title: true, body: true, createdAt: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!hospital) return jsonError("Hospital not found", 404);

  // Real bed availability: counted only when the hospital tracks wards/beds.
  const [totalBeds, availableBeds] = await Promise.all([
    db.bed.count({ where: { room: { ward: { hospitalId: hospital.id } } } }),
    db.bed.count({
      where: { status: "AVAILABLE", room: { ward: { hospitalId: hospital.id } } },
    }),
  ]);

  return jsonOk({
    hospital,
    beds: totalBeds > 0 ? { total: totalBeds, available: availableBeds } : null,
  });
}
