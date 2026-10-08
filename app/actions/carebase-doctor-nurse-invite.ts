"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import { sendStaffInvitationEmail } from "@/lib/carebase/invitation-email";
import { tryClerkFallbackInvite } from "@/lib/carebase/invite-delivery";
import { requireCarebasePermission } from "@/lib/carebase/context";
import type { InviteActionResult } from "@/app/actions/carebase-admin";
import {
  EMAIL_RE,
  acceptUrlFor,
  inviteExpiry,
  inviteOrigin,
  logInviteFailure,
  mintInviteToken,
  normalizeEmail,
} from "@/lib/carebase/invites";

/**
 * Owner flow: invite a doctor AND a nurse together for one department.
 * Doctor fields required. Nurse: pick existing (nurseMemberId), type new
 * (name + email → auto-invited, never an error), or leave blank (doctor-only).
 * Both rows are created in one transaction, linked, 48h expiry, Resend-sent.
 */
export async function inviteDoctorWithNurse(formData: FormData): Promise<InviteActionResult> {
  try {
    const context = await requireCarebasePermission("staff.manage");
    const doctorName = String(formData.get("doctorFullName") ?? "").trim();
    const doctorEmail = normalizeEmail(formData.get("doctorEmail"));
    const deptId = String(formData.get("departmentId") ?? "").trim();
    const nurseMemberId = String(formData.get("nurseMemberId") ?? "").trim() || null;
    const nurseName = String(formData.get("nurseFullName") ?? "").trim();
    const nurseEmail = normalizeEmail(formData.get("nurseEmail"));

    if (doctorName.length < 2) return { success: false, message: "Enter the doctor's full name." };
    if (!EMAIL_RE.test(doctorEmail)) return { success: false, message: "Enter a valid doctor email address." };
    if (!deptId) return { success: false, message: "Choose a department for this doctor and nurse." };

    // Nurse input NEVER blocks the doctor invite (error-handling checklist):
    // a deliverable email auto-invites the nurse (name derived when blank),
    // anything else degrades to a doctor-only invite with a clear note.
    const nurseEmailValid = EMAIL_RE.test(nurseEmail);
    const derivedNurseName = nurseEmail
      ? nurseEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b[a-z]/gi, (c) => c.toUpperCase())
      : "";
    const effectiveNurseName = nurseName.length >= 2 ? nurseName : derivedNurseName;
    const nurseInputProvided = Boolean(nurseMemberId || nurseName || nurseEmail);
    const nurseUndeliverable = nurseInputProvided && !nurseMemberId && !nurseEmailValid;

    const [doctorRole, nurseRole, department] = await Promise.all([
      db.hospitalRole.findFirst({ where: { hospitalId: context.hospital.id, name: "DOCTOR" } }),
      db.hospitalRole.findFirst({ where: { hospitalId: context.hospital.id, name: "NURSE" } }),
      db.department.findFirst({ where: { id: deptId, hospitalId: context.hospital.id } }),
    ]);
    if (!doctorRole || !nurseRole) return { success: false, message: "Doctor and nurse roles are missing for this hospital." };
    if (!department) return { success: false, message: "Choose a department from this hospital." };

    let existingNurseName: string | null = null;
    let existingNurseGone = false;
    if (nurseMemberId) {
      const member = await db.hospitalMember.findFirst({
        where: { id: nurseMemberId, hospitalId: context.hospital.id, status: "ACTIVE", role: { name: "NURSE" } },
        select: { fullName: true },
      });
      // A stale pick must never block the owner — fall back to doctor-only.
      if (!member) existingNurseGone = true;
      else existingNurseName = member.fullName;
    }

    const [doctorMember, doctorInvite, nurseMemberDup, nurseInviteDup] = await Promise.all([
      db.hospitalMember.findFirst({ where: { hospitalId: context.hospital.id, email: doctorEmail }, select: { id: true } }),
      db.staffInvitation.findFirst({ where: { hospitalId: context.hospital.id, email: doctorEmail, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } }),
      nurseEmailValid && !nurseMemberId ? db.hospitalMember.findFirst({ where: { hospitalId: context.hospital.id, email: nurseEmail }, select: { id: true, fullName: true } }) : Promise.resolve(null),
      nurseEmailValid && !nurseMemberId ? db.staffInvitation.findFirst({ where: { hospitalId: context.hospital.id, email: nurseEmail, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } }) : Promise.resolve(null),
    ]);
    if (doctorMember) return { success: false, message: "This doctor is already on the hospital team." };
    if (doctorInvite) return { success: false, message: "There is already an active invitation for this doctor email." };
    // Nurse-side duplicates degrade gracefully instead of blocking the owner:
    // a typed email that is already a member gets paired, a pending invite is reused.
    if (nurseMemberDup && !existingNurseName) existingNurseName = nurseMemberDup.fullName;

    const origin = await inviteOrigin();
    const doctorToken = mintInviteToken();
    // Owner-picked member, or a typed email that is already on the team.
    const pairedNurseMemberId = nurseMemberId && existingNurseName ? nurseMemberId : nurseMemberDup?.id ?? null;
    const newNurseNeeded = Boolean(nurseEmailValid && !pairedNurseMemberId && !nurseInviteDup);
    const nurseToken = newNurseNeeded ? mintInviteToken() : null;
    const created = await db.$transaction(async (tx) => {
      const doctor = await tx.staffInvitation.create({
        data: { hospitalId: context.hospital.id, roleId: doctorRole.id, departmentId: department.id, email: doctorEmail, fullName: doctorName, tokenHash: doctorToken.tokenHash, expiresAt: inviteExpiry(), createdByUserId: context.userId, pairedNurseMemberId },
      });
      let nurse: { id: string } | null = null;
      if (nurseToken && nurseEmailValid) {
        nurse = await tx.staffInvitation.create({
          data: { hospitalId: context.hospital.id, roleId: nurseRole.id, departmentId: department.id, email: nurseEmail, fullName: effectiveNurseName, tokenHash: nurseToken.tokenHash, expiresAt: inviteExpiry(), createdByUserId: context.userId, linkedInvitationId: doctor.id },
        });
        await tx.staffInvitation.update({ where: { id: doctor.id }, data: { linkedInvitationId: nurse.id } });
      }
      return { doctor, nurse };
    });

    const doctorAcceptUrl = acceptUrlFor(origin, doctorToken.token);
    const doctorSent = await sendStaffInvitationEmail({
      to: doctorEmail, fullName: doctorName, hospitalName: context.hospital.name,
      roleName: doctorRole.name, departmentName: department.name,
      acceptUrl: doctorAcceptUrl, expiresAt: inviteExpiry(),
    });
    if (!doctorSent.sent) {
      // Test-mode Resend sender: keep the rows and fall back to Clerk email
      // (or a manual link) instead of deleting the invites.
      if (doctorSent.isDomainError) {
        const fallback = await tryClerkFallbackInvite({
          email: doctorEmail,
          acceptUrl: doctorAcceptUrl,
          invitationId: created.doctor.id,
        });
        if (fallback.clerkInvitationId) {
          await db.staffInvitation
            .update({
              where: { id: created.doctor.id },
              data: { clerkInvitationId: fallback.clerkInvitationId },
            })
            .catch(() => undefined);
        }
        await recordCarebaseAudit(context, "staff.doctor_nurse_invited", "StaffInvitation", created.doctor.id, {
          doctorEmail, department: department.name,
          via: fallback.ok ? "clerk-fallback" : "manual-link",
        });
        revalidatePath("/hospital/staff");
        return {
          success: true,
          message: `Doctor invitation created for ${doctorEmail} (Resend test mode can't email external addresses). Share the link below — it expires in 48 hours.`,
          sentDoctor: doctorEmail,
          acceptUrl: doctorAcceptUrl,
        };
      }
      await db.staffInvitation.deleteMany({ where: { id: { in: [created.doctor.id, created.nurse?.id].filter(Boolean) as string[] } } }).catch(() => undefined);
      return { success: false, message: doctorSent.error ?? "The doctor invitation email could not be delivered." };
    }

    let nurseSentTo: string | undefined;
    if (created.nurse && nurseToken && nurseEmailValid) {
      const nurseSent = await sendStaffInvitationEmail({
        to: nurseEmail, fullName: effectiveNurseName, hospitalName: context.hospital.name,
        roleName: nurseRole.name, departmentName: department.name,
        acceptUrl: acceptUrlFor(origin, nurseToken.token), expiresAt: inviteExpiry(),
      });
      if (nurseSent.sent) nurseSentTo = nurseEmail;
      else logInviteFailure("nurse-email", new Error(nurseSent.error ?? "unknown"), { invitationId: created.nurse.id });
    }

    try {
      const client = await clerkClient();
      const clerkDoctor = await client.invitations.createInvitation({
        emailAddress: doctorEmail, redirectUrl: acceptUrlFor(origin, doctorToken.token),
        publicMetadata: { carebaseInvitationId: created.doctor.id }, notify: false, ignoreExisting: true,
      });
      await db.staffInvitation.update({ where: { id: created.doctor.id }, data: { clerkInvitationId: clerkDoctor.id } });
      if (created.nurse && nurseToken && nurseEmailValid) {
        const clerkNurse = await client.invitations.createInvitation({
          emailAddress: nurseEmail, redirectUrl: acceptUrlFor(origin, nurseToken.token),
          publicMetadata: { carebaseInvitationId: created.nurse.id }, notify: false, ignoreExisting: true,
        });
        await db.staffInvitation.update({ where: { id: created.nurse.id }, data: { clerkInvitationId: clerkNurse.id } });
      }
    } catch (error) {
      logInviteFailure("clerk-register", error, { doctorEmail, nurseEmail });
    }

    await recordCarebaseAudit(context, "staff.doctor_nurse_invited", "StaffInvitation", created.doctor.id, {
      doctorEmail, nurseEmail: nurseSentTo ?? nurseEmail ?? existingNurseName ?? null,
      pairedNurseMemberId, department: department.name, resendSent: true,
    });
    revalidatePath("/hospital/staff");

    const skippedNote = existingNurseGone
      ? " The picked nurse is no longer on the team — the doctor can choose one during onboarding."
      : nurseUndeliverable
        ? " The nurse details had no deliverable email, so no nurse invite was sent — the doctor can add one during onboarding."
        : "";
    if (existingNurseName) return { success: true, message: `Doctor invited. ${existingNurseName} will be linked when the doctor accepts.`, sentDoctor: doctorEmail };
    if (nurseSentTo) return { success: true, message: "Invitations sent to the doctor and nurse. Both expire in 48 hours.", sentDoctor: doctorEmail, sentNurse: nurseSentTo };
    if (nurseInviteDup) return { success: true, message: "Doctor invited. This nurse already has an active invitation — no duplicate was sent.", sentDoctor: doctorEmail };
    if (created.nurse) return { success: true, message: "Doctor invited. The nurse invite was created but its email failed — the doctor can still add the nurse during onboarding.", sentDoctor: doctorEmail };
    return { success: true, message: `Doctor invited.${skippedNote || " They can pick their nurse during onboarding."}`, sentDoctor: doctorEmail };
  } catch (error) {
    logInviteFailure("invite-doctor-nurse", error);
    return { success: false, message: "We couldn't send those invitations right now. Please try again." };
  }
}
