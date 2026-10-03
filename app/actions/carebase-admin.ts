"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import { requireCarebasePermission } from "@/lib/carebase/context";
import { CAREBASE_PERMISSIONS } from "@/lib/carebase/permissions";

export async function createDepartment(formData: FormData) {
  const context = await requireCarebasePermission("departments.manage");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Department name is required.");

  const department = await db.department.create({
    data: {
      hospitalId: context.hospital.id,
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      location: String(formData.get("location") ?? "").trim() || null,
      contact: String(formData.get("contact") ?? "").trim() || null,
    },
  });
  await recordCarebaseAudit(context, "department.created", "Department", department.id, { name });
  revalidatePath("/hospital/departments");
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

export async function inviteHospitalMember(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "") || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (fullName.length < 2) throw new Error("Enter the staff member's name.");

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
  if (!role) throw new Error("Choose a role from this hospital.");
  if (departmentId && !department) throw new Error("Choose a department from this hospital.");
  if (existingMember) throw new Error("This person is already on the hospital team.");
  if (existingInvite) throw new Error("There is already an active invitation for this email.");

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.staffInvitation.create({
    data: {
      hospitalId: context.hospital.id,
      roleId: role.id,
      departmentId,
      email,
      fullName,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdByUserId: context.userId,
    },
  });

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const client = await clerkClient();
    const clerkInvitation = await client.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: origin + "/invitation/accept?token=" + token,
      publicMetadata: { carebaseInvitationId: invitation.id },
      notify: true,
      ignoreExisting: true,
    });
    await db.staffInvitation.update({
      where: { id: invitation.id },
      data: { clerkInvitationId: clerkInvitation.id },
    });
  } catch (error) {
    await db.staffInvitation.delete({ where: { id: invitation.id } });
    throw error;
  }

  await recordCarebaseAudit(context, "staff.invited", "StaffInvitation", invitation.id, {
    email,
    role: role.name,
  });
  revalidatePath("/hospital/staff");
}

export async function revokeHospitalInvitation(formData: FormData) {
  const context = await requireCarebasePermission("staff.manage");
  const id = String(formData.get("id") ?? "");
  const invitation = await db.staffInvitation.findFirst({
    where: { id, hospitalId: context.hospital.id, status: "PENDING" },
  });
  if (!invitation) throw new Error("Invitation not found.");

  if (invitation.clerkInvitationId) {
    const client = await clerkClient();
    await client.invitations.revokeInvitation(invitation.clerkInvitationId);
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
