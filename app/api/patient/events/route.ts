import db from "@/lib/db";
import { requirePatient } from "@/lib/patient/auth";
import { jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/events?after=<ISO date>
 * Lightweight polling cursor: returns unread count + notifications and
 * CareEvents for hospitals the patient is linked to, newer than `after`.
 */
export async function GET(request: Request) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const url = new URL(request.url);
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(after.getTime())) return jsonError("Invalid event cursor", 400);

  const [unreadCount, notifications, links] = await Promise.all([
    db.patientNotification.count({ where: { userId: auth.userId, readAt: null } }),
    db.patientNotification.findMany({
      where: { userId: auth.userId, createdAt: { gt: after } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.carePatient.findMany({
      where: { externalUserId: auth.userId, hospital: { status: "ACTIVE" } },
      select: { hospitalId: true },
    }),
  ]);

  const hospitalIds = links.map((link) => link.hospitalId);
  const events = hospitalIds.length
    ? await db.careEvent.findMany({
        where: { hospitalId: { in: hospitalIds }, createdAt: { gt: after } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { id: true, type: true, entity: true, entityId: true, createdAt: true },
      })
    : [];

  return jsonOk({
    unreadCount,
    notifications,
    events,
    serverTime: new Date().toISOString(),
  });
}
