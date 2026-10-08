"use server";

import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import { sendStaffInvitationEmail } from "@/lib/carebase/invitation-email";
import { tryClerkFallbackInvite } from "@/lib/carebase/invite-delivery";
import { requireCarebasePermission } from "@/lib/carebase/context";
import {
  EMAIL_RE,
  acceptUrlFor,
  inviteExpiry,
  inviteOrigin,
  logInviteFailure,
  mintInviteToken,
  normalizeEmail,
} from "@/lib/carebase/invites";
import { CAREBASE_PERMISSIONS } from "@/lib/carebase/permissions";
import { findOrCreateDepartment } from "@/lib/carebase/departments";

export type InviteActionResult = {
  success: boolean;
  message: string;
  sentDoctor?: string;
  sentNurse?: string;
  /** Fallback accept URL when email delivery failed but the invite row was kept — the owner can copy/share it manually. */
  acceptUrl?: string;
};

/** Shape returned by `createDepartment` (used by the departments page). */
export type CreateDepartmentResult = {
  success: boolean;
  message: string;
  departmentId?: string;
};

/**
 * Idempotent department creation: re-using a seeded preset (e.g. "Cardiology")
 * resolves to the existing department instead of throwing a unique-constraint
 * error. Returns the department id and whether it was newly created.
 */
export async function createDepartment(formData: FormData): Promise<CreateDepartmentResult> {
  const context = await requireCarebasePermission("departments.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { success: false, message: "Department name is required." };

  const { id, created } = await findOrCreateDepartment(
    context,
    name,
    String(formData.get("description") ?? ""),
  );

  if (!created) {
    return { success: true, message: `Department "${name}" already exists, so no new department was created.` };
  }

  await recordCarebaseAudit(context, "department.created", "Department", id, { name });
  revalidatePath("/hospital/departments");
  return { success: true, message: `Department "${name}" created.`, departmentId: id };
}

export async function setDepartmentStatus(formData: FormData) {
  const context = await requireCarebasePermission("departments.manage");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error("Invalid department status.");
  const updated = await db.department.updateMany({
    where: { id, hospitalId: context.hospital.id },
    data: { status: status as "ACTIVE" | "INACTIVE" },
  });
  if (!updated.count) throw new Error("Department not found.");
  await recordCarebaseAudit(context, "department.status_changed", "Department", id, { status });
  revalidatePath("/hospital/departments");
}

export async function deleteDepartment(formData: FormData) {
  const context = await requireCarebasePermission("departments.manage");
  const id = String(formData.get("id") ?? "");
  const department = await db.department.findFirst({
    where: { id, hospitalId: context.hospital.id },
    select: { id: true, name: true },
  });
  if (!department) throw new Error("Department not found.");

  const deleted = await db.department.deleteMany({
    where: { id: department.id, hospitalId: context.hospital.id },
  });
  if (!deleted.count) throw new Error("Department not found.");
  await recordCarebaseAudit(context, "department.deleted", "Department", department.id, {
    name: department.name,
  });
  revalidatePath("/hospital", "layout");
}

/**
 * Creates ONE invitation row + sends its Resend email inside a logged,
 * crash-safe wrapper. Returns a result object — never throws for expected
 * failures — so the staff page can't land in the error boundary.
 */
async function createSingleInvite(args: {
  hospitalId: string;
  hospitalName: string;
  createdByUserId: string;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  email: string;
  fullName: string;
  origin: string;
  linkedInvitationId?: string | null;
}): Promise<{ ok: true; invitationId: string; acceptUrl: string; emailed: boolean } | { ok: false; message: string }> {
  const { token, tokenHash } = mintInviteToken();
  const invitation = await db.staffInvitation.create({
    data: {
      hospitalId: args.hospitalId,
      roleId: args.roleId,
      departmentId: args.departmentId,
      email: args.email,
      fullName: args.fullName,
      tokenHash,
      expiresAt: inviteExpiry(),
      createdByUserId: args.createdByUserId,
      linkedInvitationId: args.linkedInvitationId ?? null,
    },
  });
  const acceptUrl = acceptUrlFor(args.origin, token);

  const emailResult = await sendStaffInvitationEmail({
    to: args.email,
    fullName: args.fullName,
    hospitalName: args.hospitalName,
    roleName: args.roleName,
    departmentName: args.departmentName,
    acceptUrl,
    expiresAt: invitation.expiresAt,
  });
  if (!emailResult.sent) {
    // Resend test-mode (onboarding@resend.dev / unverified domain) can only
    // email the Resend account owner — fall back to Clerk's own invitation
    // email instead of failing the invite. Any other delivery error still
    // deletes the row, since the address itself may be undeliverable.
    if (emailResult.isDomainError) {
      const fallback = await tryClerkFallbackInvite({
        email: args.email,
        acceptUrl,
        invitationId: invitation.id,
      });
      if (fallback.ok) {
        if (fallback.clerkInvitationId) {
          await db.staffInvitation
            .update({
              where: { id: invitation.id },
              data: { clerkInvitationId: fallback.clerkInvitationId },
            })
            .catch(() => undefined);
        }
        return { ok: true, invitationId: invitation.id, acceptUrl, emailed: true };
      }
      // Even when both senders fail, KEEP the row and hand the owner a
      // copyable link — deleting the invite would strand them with nothing.
      return { ok: true, invitationId: invitation.id, acceptUrl, emailed: false };
    }
    await db.staffInvitation.delete({ where: { id: invitation.id } }).catch(() => undefined);
    return { ok: false, message: emailResult.error ?? "The invitation email could not be delivered." };
  }

  try {
    const client = await clerkClient();
    const clerkInvitation = await client.invitations.createInvitation({
      emailAddress: args.email,
      redirectUrl: acceptUrl,
      publicMetadata: { carebaseInvitationId: invitation.id },
      notify: false,
      ignoreExisting: true,
    });
    await db.staffInvitation.update({
      where: { id: invitation.id },
      data: { clerkInvitationId: clerkInvitation.id },
    });
  } catch (error) {
    logInviteFailure("clerk-register", error, { invitationId: invitation.id, email: args.email });
  }
  return { ok: true, invitationId: invitation.id, acceptUrl, emailed: true };
}

export async function inviteHospitalMember(formData: FormData): Promise<InviteActionResult> {
  try {
    const context = await requireCarebasePermission("staff.manage");
    const email = normalizeEmail(formData.get("email"));
    const fullName = String(formData.get("fullName") ?? "").trim();
    const roleId = String(formData.get("roleId") ?? "");
    const departmentId = String(formData.get("departmentId") ?? "") || null;
    if (!EMAIL_RE.test(email)) return { success: false, message: "Enter a valid email address." };
    if (fullName.length < 2) return { success: false, message: "Enter the staff member's name." };

  const [role, department, existingMember, existingInvite] = await Promise.all([
    db.hospitalRole.findFirst({ where: { id: roleId, hospitalId: context.hospital.id } }),
    departmentId
      ? db.department.findFirst({ where: { id: departmentId, hospitalId: context.hospital.id } })
      : Promise.resolve(null),
    db.hospitalMember.findFirst({ where: { hospitalId: context.hospital.id, email } }),
    db.staffInvitation.findFirst({
      where: { hospitalId: context.hospital.id, email, status: "PENDING", expiresAt: { gt: new Date() } },
    }),
  ]);
  if (!role) return { success: false, message: "Choose a role from this hospital." };
  if (departmentId && !department) return { success: false, message: "Choose a department from this hospital." };
  if (existingMember) return { success: false, message: "This person is already on the hospital team." };
  if (existingInvite) return { success: false, message: "There is already an active invitation for this email." };

  const origin = await inviteOrigin();
  const created = await createSingleInvite({
    hospitalId: context.hospital.id,
    hospitalName: context.hospital.name,
    createdByUserId: context.userId,
    roleId: role.id,
    roleName: role.name,
    departmentId,
    departmentName: department?.name ?? null,
    email,
    fullName,
    origin,
  });
  if (!created.ok) return { success: false, message: created.message };

  await recordCarebaseAudit(context, "staff.invited", "StaffInvitation", created.invitationId, {
    email,
    role: role.name,
    resendSent: true,
  });
  revalidatePath("/hospital/staff");
  if (created.emailed) {
    return { success: true, message: `Invitation sent to ${email}. It expires in 48 hours.` };
  }
  return {
    success: true,
    message: `Invitation created for ${email} (Resend test mode can't email external addresses, but the invite was saved). Share the link below — it expires in 48 hours.`,
    acceptUrl: created.acceptUrl,
  };
  } catch (error) {
    logInviteFailure("invite-member", error);
    return { success: false, message: "We couldn't send that invitation right now. Please try again." };
  }
}

export async function revokeHospitalInvitation(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const id = String(formData.get("id") ?? "");
  const invitation = await db.staffInvitation.findFirst({
    where: { id, hospitalId: context.hospital.id, status: "PENDING" },
  });
  if (!invitation) throw new Error("Invitation not found.");

  if (invitation.clerkInvitationId) {
    try {
      const client = await clerkClient();
      await client.invitations.revokeInvitation(invitation.clerkInvitationId);
    } catch (error) {
      // Best effort — the DB row is the source of truth for revocation.
      logInviteFailure("clerk-revoke", error, { invitationId: invitation.id });
    }
  }
  await db.staffInvitation.update({
    where: { id: invitation.id },
    data: { status: "REVOKED" },
  });
  await recordCarebaseAudit(context, "staff.invitation_revoked", "StaffInvitation", id, {
    email: invitation.email,
  });
  revalidatePath("/hospital/staff");
}

/** Re-sends the invitation email through Resend (owner can retry from the staff page). */
export async function resendHospitalInvitation(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const id = String(formData.get("id") ?? "");
  const invitation = await db.staffInvitation.findFirst({
    where: { id, hospitalId: context.hospital.id, status: { in: ["PENDING", "EXPIRED"] } },
    include: { role: true, department: true },
  });
  if (!invitation) throw new Error("Invitation not found.");

  // Only the token hash is stored, so a resend rotates the token and refreshes
  // the 48h window — the emailed link always points at a valid, expiring URL.
  const origin = await inviteOrigin();
  const rotated = mintInviteToken();
  const expiresAt = inviteExpiry();
  const acceptUrl = acceptUrlFor(origin, rotated.token);
  const previous = { tokenHash: invitation.tokenHash, expiresAt: invitation.expiresAt };
  await db.staffInvitation.update({
    where: { id: invitation.id },
    data: { tokenHash: rotated.tokenHash, expiresAt, status: "PENDING" },
  });

  const result = await sendStaffInvitationEmail({
    to: invitation.email,
    fullName: invitation.fullName,
    hospitalName: context.hospital.name,
    roleName: invitation.role.name,
    departmentName: invitation.department?.name ?? null,
    acceptUrl,
    expiresAt,
  });
  if (!result.sent) {
    // Resend test-mode sender (onboarding@resend.dev / unverified domain):
    // keep the rotated token and fall back to Clerk delivery instead of
    // rolling back — a Resend config gap must not invalidate the invite.
    if (result.isDomainError) {
      const fallback = await tryClerkFallbackInvite({
        email: invitation.email,
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
      await recordCarebaseAudit(context, "staff.invitation_resent", "StaffInvitation", invitation.id, {
        email: invitation.email,
        via: fallback.ok ? "clerk-fallback" : "manual-link",
      });
      revalidatePath("/hospital/staff");
      if (fallback.ok) return;
      throw new Error(
        `Resend test mode can't email ${invitation.email} — but the invite link was refreshed. Copy it from the staff list (expires in 48 hours).`,
      );
    }
    // Roll back so a failed resend never strands the row with a dead token.
    await db.staffInvitation
      .update({ where: { id: invitation.id }, data: previous })
      .catch(() => undefined);
    throw new Error(result.error ?? "The invitation email could not be delivered.");
  }

  try {
    // This SDK exposes no invitation update — re-register with
    // ignoreExisting so the reservation carries the fresh token URL.
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
    logInviteFailure("clerk-resent-redirect", error, { invitationId: invitation.id });
  }

  await recordCarebaseAudit(context, "staff.invitation_resent", "StaffInvitation", invitation.id, {
    email: invitation.email,
  });
  revalidatePath("/hospital/staff");
}

export async function setMemberRole(formData: FormData) {
  const context = await requireCarebasePermission("roles.manage");
  const memberId = String(formData.get("memberId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");
  const [member, role] = await Promise.all([
    db.hospitalMember.findFirst({
      where: { id: memberId, hospitalId: context.hospital.id },
      include: { role: true },
    }),
    db.hospitalRole.findFirst({ where: { id: roleId, hospitalId: context.hospital.id } }),
  ]);
  if (!member || !role) throw new Error("Choose a staff member and role from this hospital.");
  if (member.role.name === "OWNER" && member.id !== context.membership.id) {
    throw new Error("The hospital owner role cannot be reassigned.");
  }
  if (member.id === context.membership.id && member.role.name === "OWNER") {
    throw new Error("The hospital owner cannot change their own role.");
  }
  await db.hospitalMember.update({
    where: { id: member.id },
    data: { roleId: role.id, title: role.description || role.name },
  });
  await recordCarebaseAudit(context, "staff.role_changed", "HospitalMember", member.id, { role: role.name });
  revalidatePath("/hospital/staff");
  revalidatePath("/hospital/access");
}

export async function saveRolePermissions(formData: FormData) {
  const context = await requireCarebasePermission("roles.manage");
  const roleId = String(formData.get("roleId") ?? "");
  const role = await db.hospitalRole.findFirst({
    where: { id: roleId, hospitalId: context.hospital.id },
  });
  if (!role) throw new Error("Role not found.");
  if (role.name === "OWNER") throw new Error("Owner permissions are fixed.");

  const selected = new Set(formData.getAll("permission").map(String));
  const permissions = CAREBASE_PERMISSIONS.filter((permission) => selected.has(permission));
  await db.hospitalRole.update({
    where: { id: role.id },
    data: { permissions: [...permissions] },
  });
  await recordCarebaseAudit(context, "role.permissions_changed", "HospitalRole", role.id, {
    role: role.name,
    permissions,
  });
  revalidatePath("/hospital/access");
}

export async function createHospitalRole(formData: FormData) {
  const context = await requireCarebasePermission("roles.manage");
  const name = String(formData.get("name") ?? "").trim();
  const selected = new Set(formData.getAll("permission").map(String));
  const permissions = CAREBASE_PERMISSIONS.filter((permission) => selected.has(permission));
  if (name.length < 2) throw new Error("Role name must be at least two characters.");
  const role = await db.hospitalRole.create({
    data: {
      hospitalId: context.hospital.id,
      name: name.toUpperCase().replace(/[^A-Z0-9 _-]/g, ""),
      description: String(formData.get("description") ?? "").trim() || null,
      permissions: [...permissions],
    },
  });
  await recordCarebaseAudit(context, "role.created", "HospitalRole", role.id, { name: role.name });
  revalidatePath("/hospital/access");
}

export async function setMemberStatus(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const id = String(formData.get("memberId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new Error("Choose an active or inactive status.");
  const member = await db.hospitalMember.findFirst({
    where: { id, hospitalId: context.hospital.id },
    include: { role: true },
  });
  if (!member) throw new Error("Team member not found.");
  if (member.role.name === "OWNER" || member.id === context.membership.id) {
    throw new Error("The hospital owner cannot deactivate their own account.");
  }
  await db.hospitalMember.update({
    where: { id },
    data: { status: status as "ACTIVE" | "INACTIVE" },
  });
  await recordCarebaseAudit(context, "staff.status_changed", "HospitalMember", id, { status });
  revalidatePath("/hospital/staff");
}

export async function assignNurseToDoctor(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const nurseId = String(formData.get("nurseId") ?? "");
  const doctorId = String(formData.get("doctorId") ?? "");
  const [nurse, doctor] = await Promise.all([
    db.hospitalMember.findFirst({
      where: { id: nurseId, hospitalId: context.hospital.id, status: "ACTIVE", role: { name: "NURSE" } },
    }),
    db.doctorProfile.findFirst({ where: { id: doctorId, hospitalId: context.hospital.id } }),
  ]);
  if (!nurse || !doctor) throw new Error("Choose a nurse and doctor from this hospital.");
  await db.nurseDoctorAssignment.upsert({
    where: { doctorId_nurseId: { doctorId, nurseId } },
    create: { hospitalId: context.hospital.id, doctorId, nurseId },
    update: {},
  });
  await recordCarebaseAudit(context, "staff.nurse_assigned", "NurseDoctorAssignment", doctorId, {
    nurse: nurse.fullName,
    doctor: doctor.memberId,
  });
  revalidatePath("/hospital/staff");
  revalidatePath("/hospital/doctors");
}

export async function createDoctorSchedule(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const doctorId = String(formData.get("doctorId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const startTime = String(formData.get("startTime") ?? "");
  const endTime = String(formData.get("endTime") ?? "");
  const slotMinutes = Number(formData.get("slotMinutes")) || 30;
  const doctor = await db.doctorProfile.findFirst({
    where: { id: doctorId, hospitalId: context.hospital.id },
    select: { id: true, memberId: true },
  });
  if (!doctor) throw new Error("Doctor not found in this hospital.");
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Choose a valid day of the week.");
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    throw new Error("Enter a valid start and end time.");
  }
  if (slotMinutes < 10 || slotMinutes > 180) throw new Error("Appointment duration must be from 10 to 180 minutes.");
  const schedule = await db.doctorSchedule.create({
    data: {
      hospitalId: context.hospital.id,
      doctorId,
      dayOfWeek,
      startTime,
      endTime,
      slotMinutes,
      breakStart: String(formData.get("breakStart") ?? "") || null,
      breakEnd: String(formData.get("breakEnd") ?? "") || null,
    },
  });
  await recordCarebaseAudit(context, "doctor.schedule_added", "DoctorSchedule", schedule.id, { doctorId });
  revalidatePath("/hospital/doctors");
}
