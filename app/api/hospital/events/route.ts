import { NextResponse } from "next/server";
import { getCarebaseContext } from "@/lib/carebase/context";
import db from "@/lib/db";

export async function GET(request: Request) {
  const context = await getCarebaseContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!context.role.permissions.includes("notifications.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const afterValue = url.searchParams.get("after");
  const after = afterValue ? new Date(afterValue) : new Date(Date.now() - 60_000);
  if (Number.isNaN(after.getTime())) {
    return NextResponse.json({ error: "Invalid event cursor" }, { status: 400 });
  }
  const events = await db.careEvent.findMany({
    where: {
      hospitalId: context.hospital.id,
      createdAt: { gt: after },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, type: true, entity: true, entityId: true, createdAt: true },
  });
  return NextResponse.json(
    { events },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
