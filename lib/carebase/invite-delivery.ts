import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { logInviteFailure } from "./invites";

/**
 * Resend's shared `onboarding@resend.dev` sender (and any unverified `from`
 * address) can only email the Resend account owner — every other recipient
 * 403s with "testing emails / verify a domain". Detect that case so invite
 * flows can fall back to Clerk delivery instead of failing the invite.
 */
export function isResendDomainError(message: string): boolean {
  return /resend\.dev|verify a domain|testing emails|from.*not.*verified|domain.*not.*verified/i.test(
    message,
  );
}

type ClerkFallbackArgs = {
  email: string;
  acceptUrl: string;
  invitationId: string;
};

/**
 * Fallback delivery when Resend is unusable (test-mode sender / unverified
 * domain). Sends via Clerk's own invitation email (`notify: true`, which has
 * no relation to Resend's domain restriction) pointed at the same CareBase
 * accept URL, so the invitee still gets an email and the invite stays valid.
 * Returns the Clerk invitation id on success so callers can store it.
 */
export async function tryClerkFallbackInvite(args: ClerkFallbackArgs): Promise<{
  ok: boolean;
  clerkInvitationId?: string;
  error?: string;
}> {
  try {
    const client = await clerkClient();
    const created = await client.invitations.createInvitation({
      emailAddress: args.email,
      redirectUrl: args.acceptUrl,
      publicMetadata: { carebaseInvitationId: args.invitationId },
      notify: true,
      ignoreExisting: true,
    });
    return { ok: true, clerkInvitationId: created.id };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clerk fallback delivery failed.";
    logInviteFailure("clerk-fallback-invite", error, {
      invitationId: args.invitationId,
    });
    return { ok: false, error: message };
  }
}
