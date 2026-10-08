import db from "@/lib/db";
import { requirePatient } from "@/lib/patient/auth";
import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications?limit=&unreadOnly=true
 * Patient notification center. Scoped to the session user only.
 */
export async function GET(request: Request) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";

  const where = {
    userId: auth.userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };

  const [notifications, unreadCount, total] = await Promise.all([
    db.patientNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.patientNotification.count({ where: { userId: auth.userId, readAt: null } }),
    db.patientNotification.count({ where: { userId: auth.userId } }),
  ]);

  return jsonOk({ notifications, unreadCount, total });
}

/**
 * POST /api/notifications
 * body: { ids?: string[], all?: boolean } — marks notifications read.
 */
export async function POST(request: Request) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const now = new Date();
  if (body.all === true) {
    await db.patientNotification.updateMany({
      where: { userId: auth.userId, readAt: null },
      data: { readAt: now },
    });
    return jsonOk({ marked: "all" });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 200)
    : [];
  if (ids.length === 0) return jsonError("Provide ids or all: true", 400);

  // Ownership is enforced by combining userId + ids in the where clause.
  await db.patientNotification.updateMany({
    where: { userId: auth.userId, id: { in: ids }, readAt: null },
    data: { readAt: now },
  });
  const unreadCount = await db.patientNotification.count({
    where: { userId: auth.userId, readAt: null },
  });
  return jsonOk({ marked: ids.length, unreadCount });
}
