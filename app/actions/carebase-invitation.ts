"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import db from "@/lib/db";
import { sendStaffInvitationEmail } from "@/lib/carebase/invitation-email";
import {
  acceptUrlFor,
  hashInviteToken,
  inviteExpiry,
  inviteOrigin,
  isValidInviteToken,
  logInviteFailure,
  middlewareRoleSlug,
  mintInviteToken,
  normalizeEmail,
} from "@/lib/carebase/invites";

export type FinalizeInviteResult = {
  success: boolean;
  message: string;
  /** Role-based landing spot: department dashboard, nurse onboarding, or overview. */
  redirectTo?: string;
  requiresSignIn?: boolean;
  emailMismatch?: { invited: string; actual: string };
};

export type RequestInviteResult = {
  success: boolean;
  message: string;
};

/**
 * Keeps doctor <-> nurse pairs in sync no matter which side accepts first.
 *
 * - Doctor paired with an existing nurse member (owner picked them in the form).
 * - Doctor whose linked nurse invitation has already been accepted.
 * - Nurse accepting after her linked doctor invitation was accepted.
 *
 * Never throws on a missing counterpart: pairing completes whenever both sides
 * exist and is skipped cleanly otherwise (doctor onboarding can still finish).
 */
async function syncNursePairing(
  tx: Prisma.TransactionClient,
  args: {
    hospitalId: string;
    role: string;
    invitationId: string;
    invitationEmail: string;
    linkedInvitationId: string | null;
    pairedNurseMemberId: string | null;
    membershipId: string;
    doctorProfileId: string | null;
  },
): Promise<void> {
  if (args.role === "DOCTOR" && args.doctorProfileId) {
    let nurseMemberId: string | null = null;
    if (args.pairedNurseMemberId) {
      const nurseMember = await tx.hospitalMember.findFirst({
        where: { id: args.pairedNurseMemberId, hospitalId: args.hospitalId, status: "ACTIVE", role: { name: "NURSE" } },
        select: { id: true },
      });
      nurseMemberId = nurseMember?.id ?? null;
    } else if (args.linkedInvitationId) {
      const nurseInvite = await tx.staffInvitation.findFirst({
        where: { id: args.linkedInvitationId, status: "ACCEPTED" },
        select: { email: true },
      });
      if (nurseInvite) {
        const nurseMember = await tx.hospitalMember.findFirst({
          where: { hospitalId: args.hospitalId, email: { equals: nurseInvite.email, mode: "insensitive" }, role: { name: "NURSE" }, status: "ACTIVE" },
          select: { id: true },
        });
        nurseMemberId = nurseMember?.id ?? null;
      }
    }
    if (nurseMemberId) {
      await tx.nurseDoctorAssignment.upsert({
        where: { doctorId_nurseId: { doctorId: args.doctorProfileId, nurseId: nurseMemberId } },
        create: { hospitalId: args.hospitalId, doctorId: args.doctorProfileId, nurseId: nurseMemberId },
        update: {},
      });
    }
    return;
  }

  if (args.role === "NURSE") {
    const doctorInvite = await tx.staffInvitation.findFirst({
      where: { linkedInvitationId: args.invitationId, status: "ACCEPTED" },
      select: { email: true },
    });
    if (!doctorInvite) return;
    const doctorMember = await tx.hospitalMember.findFirst({
      where: { hospitalId: args.hospitalId, email: { equals: doctorInvite.email, mode: "insensitive" }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!doctorMember) return;
    const doctorProfile = await tx.doctorProfile.findFirst({
      where: { hospitalId: args.hospitalId, memberId: doctorMember.id },
      select: { id: true },
    });
    if (!doctorProfile) return;
    await tx.nurseDoctorAssignment.upsert({
      where: { doctorId_nurseId: { doctorId: doctorProfile.id, nurseId: args.membershipId } },
      create: { hospitalId: args.hospitalId, doctorId: doctorProfile.id, nurseId: args.membershipId },
      update: {},
    });
  }
}

/**
 * Role-based landing page after onboarding:
 * - department dashboard when the invite carried a department,
 * - nurse onboarding when a doctor still has to pick/add a nurse,
 * - hospital overview otherwise (handles missing department assignment).
 */
async function resolveRedirectTarget(args: {
  hospitalId: string;
  userId: string;
  roleName: string;
  departmentId: string | null;
  linkedInvitationId: string | null;
  pairedNurseMemberId: string | null;
}): Promise<string> {
  const departmentTarget = args.departmentId
    ? `/hospital/departments/${args.departmentId}`
    : "/hospital";
  if (args.roleName !== "DOCTOR") return departmentTarget;
  if (args.pairedNurseMemberId || args.linkedInvitationId) return departmentTarget;
  try {
    const doctorProfile = await db.doctorProfile.findFirst({
      where: { hospitalId: args.hospitalId, member: { userId: args.userId } },
      select: { id: true },
    });
    if (!doctorProfile) return departmentTarget;
    const assignment = await db.nurseDoctorAssignment.findFirst({
      where: { doctorId: doctorProfile.id },
      select: { id: true },
    });
    return assignment ? departmentTarget : "/onboarding/nurse";
  } catch (error) {
    logInviteFailure("resolve-redirect", error, { hospitalId: args.hospitalId });
    return departmentTarget;
  }
}

/**
 * Completes an invitation after the invitee has set their password (or signed
 * in with an existing account):
 *
 * 1. re-validates the token (shape, existence, status, 48h expiry),
 * 2. requires a session and an email that matches the invited address,
 * 3. creates the membership + department link + role profile in ONE
 *    transaction (with a concurrency guard) so partial failures can never
 *    leave a half-onboarded member behind,
 * 4. points the active-department cookie at the invite's department,
 * 5. stores the role slug in Clerk's publicMetadata for middleware routing,
 * 6. returns a role-based `redirectTo` instead of throwing.
 */
export async function finalizeInviteAcceptance(token: string): Promise<FinalizeInviteResult> {
  try {
    if (!isValidInviteToken(token)) {
      return { success: false, message: "This invitation link is invalid or has expired. Ask your hospital administrator to send you a new one." };
    }

    const invitation = await db.staffInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        role: true,
        department: { select: { id: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
    });
    if (!invitation) {
      return { success: false, message: "This invitation link is invalid. Ask your hospital administrator to send you a new one." };
    }
    if (invitation.status === "REVOKED") {
      return { success: false, message: "This invitation was revoked. Ask your hospital administrator to send you a new one." };
    }
    if (invitation.status === "EXPIRED" || invitation.expiresAt.getTime() <= Date.now()) {
      if (invitation.status === "PENDING") {
        await db.staffInvitation
          .updateMany({ where: { id: invitation.id, status: "PENDING" }, data: { status: "EXPIRED" } })
          .catch(() => undefined);
      }
      return { success: false, message: "This invitation expired. Request a new invite link to continue." };
    }

    const { userId } = await auth();
    if (!userId) {
      return { success: false, requiresSignIn: true, message: `Sign in or create your account with ${invitation.email} to finish setting up.` };
    }

    // Idempotent re-visits: already onboarded members just continue.
    if (invitation.status === "ACCEPTED") {
      const existing = await db.hospitalMember.findFirst({
        where: { hospitalId: invitation.hospitalId, userId, status: "ACTIVE" },
        select: { id: true },
      });
      if (existing) {
        const target = await resolveRedirectTarget({
          hospitalId: invitation.hospitalId,
          userId,
          roleName: invitation.role.name,
          departmentId: invitation.departmentId,
          linkedInvitationId: invitation.linkedInvitationId,
          pairedNurseMemberId: invitation.pairedNurseMemberId,
        });
        return { success: true, message: "You're already a member — taking you to your dashboard.", redirectTo: target };
      }
      return { success: false, message: "This invitation was already used. Ask your hospital administrator to send you a new one." };
    }

    const user = await currentUser();
    const accountEmail =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses.find((address) => address.verification?.status === "verified")?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      "";
    if (!accountEmail) {
      return { success: false, requiresSignIn: true, message: "Your account needs an email address before it can join the workspace." };
    }
    if (normalizeEmail(accountEmail) !== normalizeEmail(invitation.email)) {
      return {
        success: false,
        message: `This invitation was sent to ${invitation.email}. Sign out and continue with that email address.`,
        emailMismatch: { invited: invitation.email, actual: accountEmail },
      };
    }

    await db.$transaction(async (tx) => {
      // Concurrency guard: only the first caller flips PENDING -> ACCEPTED.
      const claim = await tx.staffInvitation.updateMany({
        where: { id: invitation.id, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (claim.count === 0) {
        const current = await tx.staffInvitation.findUnique({ where: { id: invitation.id }, select: { status: true } });
        if (current?.status !== "ACCEPTED") throw new Error("invitation no longer pending");
      }

      let membership = await tx.hospitalMember.findFirst({
        where: { hospitalId: invitation.hospitalId, userId },
      });
      if (!membership) {
        membership = await tx.hospitalMember.create({
          data: {
            hospitalId: invitation.hospitalId,
            userId,
            roleId: invitation.roleId,
            fullName: [user?.firstName, user?.lastName].filter(Boolean).join(" ") || invitation.fullName,
            email: normalizeEmail(invitation.email),
            title: invitation.role.description ?? invitation.role.name,
            photoUrl: user?.imageUrl,
          },
        });
      }

      if (invitation.departmentId) {
        const departmentMember = await tx.departmentMember.findFirst({
          where: { hospitalId: invitation.hospitalId, memberId: membership.id, departmentId: invitation.departmentId },
          select: { id: true },
        });
        if (!departmentMember) {
          await tx.departmentMember.create({
            data: { hospitalId: invitation.hospitalId, departmentId: invitation.departmentId, memberId: membership.id },
          });
        }
      }

      let doctorProfileId: string | null = null;
      if (invitation.role.name === "DOCTOR") {
        const profile = await tx.doctorProfile.findFirst({
          where: { hospitalId: invitation.hospitalId, memberId: membership.id },
          select: { id: true },
        });
        const created =
          profile ??
          (await tx.doctorProfile.create({
            data: { hospitalId: invitation.hospitalId, memberId: membership.id, departmentId: invitation.departmentId },
            select: { id: true },
          }));
        doctorProfileId = created.id;
      }

      await syncNursePairing(tx, {
        hospitalId: invitation.hospitalId,
        role: invitation.role.name,
        invitationId: invitation.id,
        invitationEmail: invitation.email,
        linkedInvitationId: invitation.linkedInvitationId,
        pairedNurseMemberId: invitation.pairedNurseMemberId,
        membershipId: membership.id,
        doctorProfileId,
      });

      await tx.auditEvent.create({
        data: {
          hospitalId: invitation.hospitalId,
          actorMemberId: membership.id,
          actorUserId: userId,
          actorName: membership.fullName,
          action: "staff.invitation_accepted",
          entity: "StaffInvitation",
          entityId: invitation.id,
          details: { role: invitation.role.name, department: invitation.department?.name ?? null },
        },
      });
    });

    // Land on the invited department (cookie consumed by getCarebaseContext).
    if (invitation.departmentId) {
      const cookieStore = await cookies();
      cookieStore.set("carebase-department", invitation.departmentId, {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    // Middleware routes on publicMetadata.role; a Clerk hiccup here must not
    // undo a successful onboarding, so log and continue.
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: middlewareRoleSlug(invitation.role.name),
          hospitalId: invitation.hospitalId,
          departmentId: invitation.departmentId,
        },
      });
    } catch (error) {
      logInviteFailure("finalize-metadata", error, { userId, invitationId: invitation.id });
    }

    const redirectTo = await resolveRedirectTarget({
      hospitalId: invitation.hospitalId,
      userId,
      roleName: invitation.role.name,
      departmentId: invitation.departmentId,
      linkedInvitationId: invitation.linkedInvitationId,
      pairedNurseMemberId: invitation.pairedNurseMemberId,
    });
    revalidatePath("/hospital");
    return {
      success: true,
      message: `Welcome, ${invitation.fullName}! Your ${invitation.role.name.toLowerCase()} account is ready.`,
      redirectTo,
    };
  } catch (error) {
    logInviteFailure("finalize-invitation", error, { tokenProvided: Boolean(token) });
    return { success: false, message: "We couldn't finish setting up your account. Please try again." };
  }
}

/**
 * "Send me a new invite" from the expired-link page.
 *
 * Only invitations that already reached their 48h expiry can be re-issued
 * (active links can't be spammed, revoked ones stay revoked). The raw token is
 * never stored, so re-issue rotates `tokenHash`, refreshes expiry, emails a
 * fresh link, and rolls the row back if email delivery fails.
 */
export async function requestNewInvitation(token: string): Promise<RequestInviteResult> {
  try {
    if (!isValidInviteToken(token)) {
      return { success: false, message: "This invitation link is invalid. Ask your hospital administrator to send you a new one." };
    }
    const invitation = await db.staffInvitation.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        role: true,
        department: { select: { name: true } },
        hospital: { select: { name: true } },
      },
    });
    if (!invitation) {
      return { success: false, message: "This invitation link is invalid. Ask your hospital administrator to send you a new one." };
    }
    if (invitation.status === "ACCEPTED") {
      return { success: false, message: "This invitation was already accepted — sign in to continue." };
    }
    if (invitation.status === "REVOKED") {
      return { success: false, message: "This invitation was revoked. Ask your hospital administrator for a new invite." };
    }
    const alreadyExpired =
      invitation.status === "EXPIRED" || invitation.expiresAt.getTime() <= Date.now();
    if (!alreadyExpired) {
      return { success: false, message: "This invitation is still active — use the link in your original email to continue." };
    }

    const rotated = mintInviteToken();
    const expiresAt = inviteExpiry();
    const origin = await inviteOrigin();
    const acceptUrl = acceptUrlFor(origin, rotated.token);
    const previous = {
      tokenHash: invitation.tokenHash,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    };

    await db.staffInvitation.update({
      where: { id: invitation.id },
      data: { tokenHash: rotated.tokenHash, expiresAt, status: "PENDING", acceptedAt: null },
    });

    const emailResult = await sendStaffInvitationEmail({
      to: invitation.email,
      fullName: invitation.fullName,
      hospitalName: invitation.hospital.name,
      roleName: invitation.role.name,
      departmentName: invitation.department?.name ?? null,
      acceptUrl,
      expiresAt,
    });
    if (!emailResult.sent) {
      // Roll back so a failed send never strands the row with a dead token.
      await db.staffInvitation
        .update({ where: { id: invitation.id }, data: previous })
        .catch(() => undefined);
      logInviteFailure("request-new-invite-email", new Error(emailResult.error ?? "unknown"), {
        invitationId: invitation.id,
      });
      return {
        success: false,
        message:
          emailResult.error ??
          "The new invitation email could not be delivered. Ask your hospital administrator to send a fresh invite.",
      };
    }

    // Re-register the Clerk reservation with the fresh redirect URL — best
    // effort (this SDK exposes no invitation update, and Resend carries the
    // primary email), so a Clerk hiccup never blocks the re-issue.
    try {
      const client = await clerkClient();
      const created = await client.invitations.createInvitation({
        emailAddress: invitation.email,
        redirectUrl: acceptUrl,
        publicMetadata: { carebaseInvitationId: invitation.id },
        notify: false,
        ignoreExisting: true,
      });
      await db.staffInvitation.update({
        where: { id: invitation.id },
        data: { clerkInvitationId: created.id },
      });
    } catch (error) {
      logInviteFailure("request-new-invite-clerk", error, { invitationId: invitation.id });
    }

    return {
      success: true,
      message: `A fresh invitation was sent to ${invitation.email}. The new link expires in 48 hours.`,
    };
  } catch (error) {
    logInviteFailure("request-new-invite", error, { tokenProvided: Boolean(token) });
    return { success: false, message: "We couldn't request a new invitation right now. Please try again." };
  }
}
