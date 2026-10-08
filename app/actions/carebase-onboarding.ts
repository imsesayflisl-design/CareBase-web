"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import db from "@/lib/db";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import { getCarebaseContext } from "@/lib/carebase/context";
import { sendStaffInvitationEmail } from "@/lib/carebase/invitation-email";
import { tryClerkFallbackInvite } from "@/lib/carebase/invite-delivery";
import {
  EMAIL_RE,
  acceptUrlFor,
  inviteExpiry,
  inviteOrigin,
  logInviteFailure,
  mintInviteToken,
  normalizeEmail,
} from "@/lib/carebase/invites";

export type NurseOnboardingResult = {
  success: boolean;
  message: string;
  redirectTo?: string;
};

/** Where a doctor lands after this step (their department dashboard). */
function dashboardTarget(activeDepartmentId: string | null): string {
  return activeDepartmentId ? `/hospital/departments/${activeDepartmentId}` : "/hospital";
}

/**
 * Doctor onboarding step (invite flow option 2): the invited doctor picks an
 * existing nurse, invites a new one by email, or skips — the invite link stays
 * alive either way, so a missing/failed nurse invite never blocks onboarding.
 */
export async function completeNurseOnboarding(
  _prevState: NurseOnboardingResult,
  formData: FormData,
): Promise<NurseOnboardingResult> {
  try {
    const context = await getCarebaseContext();
    if (!context) {
      return { success: false, message: "Your hospital membership could not be loaded. Refresh the page and try again." };
    }
    const mayManage =
      context.role.name === "DOCTOR" ||
      context.role.permissions.includes("staff.manage") ||
      context.role.permissions.includes("*");
    if (!mayManage) {
      return { success: false, message: "Only doctors can complete the nurse onboarding step." };
    }

    const target = dashboardTarget(context.activeDepartment?.id ?? null);
    const mode = String(formData.get("mode") ?? "skip");

    if (mode === "skip") {
      return {
        success: true,
        message: "No problem — you can connect a nurse later from Staff & access.",
        redirectTo: target,
      };
    }

    const doctorProfile = await db.doctorProfile.findFirst({
      where: { hospitalId: context.hospital.id, memberId: context.membership.id },
      select: { id: true },
    });
    if (!doctorProfile) {
      return { success: false, message: "Your doctor profile is still being prepared. Refresh the page and try again." };
    }

    if (mode === "existing") {
      const nurseId = String(formData.get("nurseId") ?? "").trim();
      if (!nurseId) return { success: false, message: "Choose a nurse from the list." };
      const nurse = await db.hospitalMember.findFirst({
        where: { id: nurseId, hospitalId: context.hospital.id, status: "ACTIVE", role: { name: "NURSE" } },
        select: { id: true, fullName: true },
      });
      if (!nurse) return { success: false, message: "That nurse is no longer on the team. Refresh the list and pick another." };

      await db.nurseDoctorAssignment.upsert({
        where: { doctorId_nurseId: { doctorId: doctorProfile.id, nurseId: nurse.id } },
        create: { hospitalId: context.hospital.id, doctorId: doctorProfile.id, nurseId: nurse.id },
        update: {},
      });
      await recordCarebaseAudit(context, "staff.nurse_assigned", "NurseDoctorAssignment", doctorProfile.id, {
        nurse: nurse.fullName,
        source: "doctor_onboarding",
      });
      revalidatePath("/onboarding/nurse");
      return { success: true, message: `${nurse.fullName} is now your assigned nurse.`, redirectTo: target };
    }

    if (mode !== "new") {
      return { success: false, message: "Choose how you'd like to add your nurse." };
    }

    // New nurse by email — auto-invites when she is not in the system yet.
    const nurseEmail = normalizeEmail(formData.get("nurseEmail"));
    const nurseNameInput = String(formData.get("nurseFullName") ?? "").trim();
    if (!EMAIL_RE.test(nurseEmail)) return { success: false, message: "Enter a valid nurse email address." };
    if (nurseNameInput && nurseNameInput.length < 2) return { success: false, message: "Enter the nurse's full name or leave it blank." };
    const derivedName = nurseEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b[a-z]/gi, (c) => c.toUpperCase());
    const nurseName = nurseNameInput.length >= 2 ? nurseNameInput : derivedName;

    const existingMember = await db.hospitalMember.findFirst({
      where: { hospitalId: context.hospital.id, email: nurseEmail, status: "ACTIVE", role: { name: "NURSE" } },
      select: { id: true, fullName: true },
    });
    if (existingMember) {
      await db.nurseDoctorAssignment.upsert({
        where: { doctorId_nurseId: { doctorId: doctorProfile.id, nurseId: existingMember.id } },
        create: { hospitalId: context.hospital.id, doctorId: doctorProfile.id, nurseId: existingMember.id },
        update: {},
      });
      await recordCarebaseAudit(context, "staff.nurse_assigned", "NurseDoctorAssignment", doctorProfile.id, {
        nurse: existingMember.fullName,
        source: "doctor_onboarding_existing_email",
      });
      return {
        success: true,
        message: `${existingMember.fullName} is already on the team — she's now your assigned nurse.`,
        redirectTo: target,
      };
    }

    const pendingInvite = await db.staffInvitation.findFirst({
      where: { hospitalId: context.hospital.id, email: nurseEmail, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pendingInvite) {
      return {
        success: true,
        message: `${nurseEmail} already has an active invitation — you'll be linked when she accepts.`,
        redirectTo: target,
      };
    }

    const origin = await inviteOrigin();
    const token = mintInviteToken();
    const expiresAt = inviteExpiry();
    const acceptUrl = acceptUrlFor(origin, token.token);

    // Link back to this doctor's accepted invitation so the pair syncs
    // automatically when the nurse accepts (mirrors the owner flow).
    const doctorInvite = await db.staffInvitation.findFirst({
      where: {
        hospitalId: context.hospital.id,
        email: { equals: context.membership.email, mode: "insensitive" },
        status: "ACCEPTED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, linkedInvitationId: true },
    });

    const nurseRole = await db.hospitalRole.findFirst({
      where: { hospitalId: context.hospital.id, name: "NURSE" },
      select: { id: true },
    });
    if (!nurseRole) {
      return { success: false, message: "The nurse role is missing for this hospital. Ask the owner to add it." };
    }

    const invitation = await db.$transaction(async (tx) => {
      const created = await tx.staffInvitation.create({
        data: {
          hospitalId: context.hospital.id,
          roleId: nurseRole.id,
          departmentId: context.activeDepartment?.id ?? null,
          email: nurseEmail,
          fullName: nurseName,
          tokenHash: token.tokenHash,
          expiresAt,
          createdByUserId: context.userId,
          linkedInvitationId: doctorInvite?.id ?? null,
        },
      });
      // Both sides point at each other, exactly like the owner flow does.
      if (doctorInvite && !doctorInvite.linkedInvitationId) {
        await tx.staffInvitation.update({
          where: { id: doctorInvite.id },
          data: { linkedInvitationId: created.id },
        });
      }
      return created;
    });

    const emailResult = await sendStaffInvitationEmail({
      to: nurseEmail,
      fullName: nurseName,
      hospitalName: context.hospital.name,
      roleName: "NURSE",
      departmentName: context.activeDepartment?.name ?? null,
      acceptUrl,
      expiresAt,
    });
    if (!emailResult.sent) {
      // Resend test-mode sender can't email external addresses — keep the
      // invite and fall back to Clerk email (or a manual link) instead of
      // deleting it.
      if (emailResult.isDomainError) {
        const fallback = await tryClerkFallbackInvite({
          email: nurseEmail,
          acceptUrl,
          invitationId: invitation.id,
        });
        if (fallback.clerkInvitationId) {
          await db.staffInvitation
            .update({
              where: { id: invitation.id },
              data: { clerkInvitationId: fallback.clerkInvitationId },
            })
            .catch(() => undefined);
        }
      } else {
        // Compensate so a failed send leaves no dangling pending invitation.
        await db.staffInvitation
          .delete({ where: { id: invitation.id } })
          .catch(() => undefined);
        if (doctorInvite && !doctorInvite.linkedInvitationId) {
          await db.staffInvitation
            .update({ where: { id: doctorInvite.id }, data: { linkedInvitationId: null } })
            .catch(() => undefined);
        }
        logInviteFailure("onboarding-nurse-email", new Error(emailResult.error ?? "unknown"), {
          invitationId: invitation.id,
        });
        return {
          success: false,
          message: emailResult.error ?? "The nurse invitation email could not be delivered. Try again or skip for now.",
        };
      }
    }

    try {
      const client = await clerkClient();
      const clerkInvite = await client.invitations.createInvitation({
        emailAddress: nurseEmail,
        redirectUrl: acceptUrl,
        publicMetadata: { carebaseInvitationId: invitation.id },
        notify: false,
        ignoreExisting: true,
      });
      await db.staffInvitation.update({
        where: { id: invitation.id },
        data: { clerkInvitationId: clerkInvite.id },
      });
    } catch (error) {
      logInviteFailure("onboarding-nurse-clerk", error, { invitationId: invitation.id });
    }

    await recordCarebaseAudit(context, "staff.nurse_invited", "StaffInvitation", invitation.id, {
      nurseEmail,
      source: "doctor_onboarding",
    });
    revalidatePath("/onboarding/nurse");
    return {
      success: true,
      message: `Nurse invitation sent to ${nurseEmail} — you'll be linked automatically when she accepts.`,
      redirectTo: target,
    };
  } catch (error) {
    logInviteFailure("complete-nurse-onboarding", error);
    return { success: false, message: "We couldn't complete that step right now. Please try again." };
  }
}
