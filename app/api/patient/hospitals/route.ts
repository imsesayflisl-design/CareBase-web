import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import db from "@/lib/db";

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
