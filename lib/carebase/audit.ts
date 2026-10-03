import "server-only";

import db from "@/lib/db";
import type { CarebaseContext } from "./context";

export async function recordCarebaseAudit(
  context: CarebaseContext,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await db.auditEvent.create({
    data: {
      hospitalId: context.hospital.id,
      actorMemberId: context.membership.id,
      actorUserId: context.userId,
      actorName: context.membership.fullName,
      action,
      entity,
      entityId,
      details: details as object | undefined,
    },
  });
}

export async function publishCarebaseEvent(
  hospitalId: string,
  type: string,
  entity: string,
  entityId: string,
  payload?: Record<string, unknown>
) {
  await db.careEvent.create({
    data: {
      hospitalId,
      type,
      entity,
      entityId,
      payload: payload as object | undefined,
    },
  });
}

export async function createCarebaseNotification(args: {
  hospitalId: string;
  title: string;
  body: string;
  category: string;
  href?: string;
  memberId?: string;
}) {
  await db.hospitalNotification.create({ data: args });
}
