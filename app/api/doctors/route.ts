import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctors?q=&hospitalId=&departmentId=&specialty=&limit=
 * Searchable directory of available doctors.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const hospitalId = (url.searchParams.get("hospitalId") ?? "").trim().slice(0, 60);
  const departmentId = (url.searchParams.get("departmentId") ?? "").trim().slice(0, 60);
  const specialty = (url.searchParams.get("specialty") ?? "").trim().slice(0, 100);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 60);

  const where = {
    member: { status: "ACTIVE" as const },
    hospital: { status: "ACTIVE" as const },
    ...(hospitalId ? { hospitalId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(specialty ? { specialty: { contains: specialty, mode: "insensitive" as const } } : {}),
    ...(q
      ? {
          OR: [
            { specialty: { contains: q, mode: "insensitive" as const } },
            { subSpecialty: { contains: q, mode: "insensitive" as const } },
            { member: { fullName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const rows = await db.doctorProfile.findMany({
    where,
    select: {
      id: true,
      specialty: true,
      subSpecialty: true,
      qualifications: true,
      yearsExperience: true,
      consultationType: true,
      consultationFee: true,
      availabilityStatus: true,
      languages: true,
      member: { select: { fullName: true, photoUrl: true, title: true } },
      department: { select: { id: true, name: true } },
      hospital: { select: { id: true, name: true, city: true, phone: true } },
    },
    orderBy: [{ member: { fullName: "asc" } }],
    take: limit,
  });

  return jsonOk({ doctors: rows, count: rows.length });
}
