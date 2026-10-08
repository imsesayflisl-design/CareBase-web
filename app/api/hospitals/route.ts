import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { haversineKm, jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

const MAX_TAKE = 60;

/**
 * GET /api/hospitals?q=&city=&near=lat,lng&radiusKm=&limit=
 * Public directory of active hospitals with optional geo filtering.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 100);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, MAX_TAKE);

  let nearLat: number | null = null;
  let nearLng: number | null = null;
  const near = url.searchParams.get("near");
  if (near) {
    const [latRaw, lngRaw] = near.split(",");
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      nearLat = lat;
      nearLng = lng;
    }
  }
  const radiusKm = Math.min(Math.max(Number(url.searchParams.get("radiusKm")) || 50, 1), 500);

  const where = {
    status: "ACTIVE" as const,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
            { region: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { services: { has: q } },
          ],
        }
      : {}),
    ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
    ...(nearLat !== null && nearLng !== null
      ? { latitude: { not: null }, longitude: { not: null } }
      : {}),
  };

  const rows = await db.hospital.findMany({
    where,
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
      phone: true,
      email: true,
      emergencyContact: true,
      website: true,
      openingHours: true,
      services: true,
      latitude: true,
      longitude: true,
      _count: { select: { departments: { where: { status: "ACTIVE" } }, doctorProfiles: true } },
    },
    orderBy: { name: "asc" },
    take: nearLat !== null ? Math.min(limit * 3, MAX_TAKE) : limit,
  });

  let hospitals = rows.map((row) => ({
    ...row,
    distanceKm:
      nearLat !== null && nearLng !== null && row.latitude !== null && row.longitude !== null
        ? Math.round(haversineKm(nearLat, nearLng, row.latitude, row.longitude) * 10) / 10
        : null,
  }));

  if (nearLat !== null && nearLng !== null) {
    hospitals = hospitals
      .filter((hospital) => hospital.distanceKm !== null && hospital.distanceKm <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .slice(0, limit);
  }

  return jsonOk({ hospitals, count: hospitals.length });
}
