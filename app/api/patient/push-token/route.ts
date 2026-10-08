import db from "@/lib/db";
import { requireSession } from "@/lib/patient/auth";
import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";

export const dynamic = "force-dynamic";

/**
 * POST /api/patient/push-token
 * Registers an Expo push token for the authenticated user.
 * body: { token: string, platform?: "ios" | "android" | "web" }
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token || token.length > 300) return jsonError("A valid push token is required", 400);
  const platform =
    body.platform === "ios" || body.platform === "android" || body.platform === "web"
      ? body.platform
      : "expo";

  await db.patientPushToken.upsert({
    where: { token },
    update: { userId: session.userId, platform, lastUsedAt: new Date() },
    create: { userId: session.userId, token, platform },
  });

  return jsonOk({ registered: true });
}

/**
 * DELETE /api/patient/push-token
 * body: { token: string } — removes a device token on sign-out.
 */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const body = await jsonBody(request);
  const token = body && typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return jsonError("token is required", 400);

  await db.patientPushToken.deleteMany({ where: { token, userId: session.userId } });
  return jsonOk({ removed: true });
}
