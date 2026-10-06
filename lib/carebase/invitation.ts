import "server-only";

import db from "@/lib/db";
import { hashInviteToken, isValidInviteToken } from "./invites";

/** Everything the acceptance / password pages need to render invite details. */
export type InvitationDetails = {
  id: string;
  fullName: string;
  email: string;
  hospitalName: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  expiresAt: Date;
  linkedInvitationId: string | null;
  pairedNurseMemberId: string | null;
};

/**
 * `invalid`    - token missing/wrong shape or unknown (never stored).
 * `expired`    - invitation exists but past `expiresAt` (or marked EXPIRED).
 * `revoked`    - an admin cancelled the invitation.
 * `accepted`   - already onboarded; offer sign-in instead of re-accepting.
 * `pending`    - good token, safe to show details and continue the flow.
 *
 * Only genuine server failures (database down, etc.) reject, so pages can
 * distinguish a bad link from an outage and render the right fallback.
 */
export type InvitationPreview =
  | { status: "invalid" }
  | { status: "expired"; invitation: InvitationDetails }
  | { status: "revoked"; invitation: InvitationDetails }
  | { status: "accepted"; invitation: InvitationDetails }
  | { status: "pending"; invitation: InvitationDetails };

/**
 * Loads + classifies an invitation from its raw token. Runs before any invite
 * page renders so expired/invalid links get a clear message instead of a
 * Server Component crash.
 */
export async function loadInvitationByToken(
  token: string | null | undefined,
): Promise<InvitationPreview> {
  if (!isValidInviteToken(token)) return { status: "invalid" };

  const invitation = await db.staffInvitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      hospital: { select: { name: true } },
      role: { select: { name: true, description: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!invitation) return { status: "invalid" };

  const details: InvitationDetails = {
    id: invitation.id,
    fullName: invitation.fullName,
    email: invitation.email,
    hospitalName: invitation.hospital.name,
    roleName: invitation.role.name,
    departmentId: invitation.department?.id ?? null,
    departmentName: invitation.department?.name ?? null,
    expiresAt: invitation.expiresAt,
    linkedInvitationId: invitation.linkedInvitationId,
    pairedNurseMemberId: invitation.pairedNurseMemberId,
  };

  if (invitation.status === "ACCEPTED") return { status: "accepted", invitation: details };
  if (invitation.status === "REVOKED") return { status: "revoked", invitation: details };
  if (invitation.status === "EXPIRED") return { status: "expired", invitation: details };
  if (invitation.expiresAt.getTime() <= Date.now()) {
    return { status: "expired", invitation: details };
  }
  return { status: "pending", invitation: details };
}
