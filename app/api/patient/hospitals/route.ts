import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { linkPatientToHospital } from "@/lib/patient/link";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await db.carePatient.findMany({
    where: {
      externalUserId: userId,
      hospital: { status: "ACTIVE" },
    },
    select: {
      id: true,
      patientCode: true,
      hospital: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          phone: true,
        },
      },
    },
    orderBy: { hospital: { name: "asc" } },
  });
  const hospitals = Array.from(
    new Map(records.map((record) => [record.hospital.id, {
      ...record.hospital,
      patientId: record.id,
      patientCode: record.patientCode,
    }])).values()
  );

  return NextResponse.json(
    { hospitals },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

/**
 * POST /api/patient/hospitals — body: { hospitalId }
 * Links the authenticated patient to a hospital (claim or self-register).
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request" }, { status: 400 });
  }
  const hospitalId =
    body && typeof body === "object" && typeof (body as Record<string, unknown>).hospitalId === "string"
      ? ((body as Record<string, unknown>).hospitalId as string).trim()
      : "";
  if (!hospitalId) return NextResponse.json({ error: "hospitalId is required" }, { status: 400 });

  const result = await linkPatientToHospital(userId, hospitalId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const { status, ...payload } = result;
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
