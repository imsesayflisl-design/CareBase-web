import "server-only";

import db from "@/lib/db";

type NotifyArgs = {
  userId: string;
  hospitalId?: string | null;
  title: string;
  body: string;
  category: string;
  resourceType?: string;
  resourceId?: string;
  href?: string;
};

/** Creates a patient-facing notification row and best-effort push. */
export async function notifyPatient(args: NotifyArgs) {
  const notification = await db.patientNotification.create({
    data: {
      userId: args.userId,
      hospitalId: args.hospitalId ?? null,
      title: args.title,
      body: args.body,
      category: args.category,
      resourceType: args.resourceType ?? null,
      resourceId: args.resourceId ?? null,
      href: args.href ?? null,
    },
  });
  // Fire-and-forget push; never blocks the business transaction.
  void sendPushToUser(args.userId, args.title, args.body, args.href);
  return notification;
}

/** Sends an Expo push message to every registered device of a user. */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  href?: string
) {
  try {
    const tokens = await db.patientPushToken.findMany({
      where: { userId },
      select: { token: true },
      take: 10,
    });
    if (tokens.length === 0) return;

    const messages = tokens.map((entry) => ({
      to: entry.token,
      sound: "default" as const,
      title,
      body,
      data: href ? { href } : undefined,
    }));

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages),
    });
    if (response.ok) {
      await db.patientPushToken.updateMany({
        where: { userId },
        data: { lastUsedAt: new Date() },
      });
    }
  } catch (error) {
    console.error("Push delivery failed:", error instanceof Error ? error.message : "unknown");
  }
}
