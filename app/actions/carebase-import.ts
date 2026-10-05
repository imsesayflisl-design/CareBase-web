"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import {
  createCarebaseNotification,
  publishCarebaseEvent,
  recordCarebaseAudit,
} from "@/lib/carebase/audit";
import { sendStaffInvitationEmail } from "@/lib/carebase/invitation-email";
import { requireCarebasePermission } from "@/lib/carebase/context";
import {
  mapStaffImportFile,
  toStagedRows,
  type StaffImportFailure,
  type StaffImportStagedRow,
  type StaffImportState,
} from "@/lib/carebase/staff-import";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function jsonError(message: string): StaffImportState {
  return { status: "error", message };
}

async function loadImportContext(hospitalId: string) {
  const [roles, departments, members] = await Promise.all([
    db.hospitalRole.findMany({
      where: { hospitalId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { hospitalId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.hospitalMember.findMany({
      where: { hospitalId },
      select: { email: true },
    }),
  ]);
  return {
    roles,
    departments,
    existingEmails: new Set(members.map((member) => member.email.toLowerCase())),
  };
}

/**
 * Step 1 — parse the uploaded workbook, validate every row and stage the
 * importable rows in a REVIEW batch so the admin can confirm or discard them.
 */
export async function previewStaffImport(
  _state: StaffImportState,
  formData: FormData
): Promise<StaffImportState> {
  const context = await requireCarebasePermission("staff.manage");
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    return jsonError("Choose an Excel (.xlsx) or CSV file to upload.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const importContext = await loadImportContext(context.hospital.id);
  const mapping = mapStaffImportFile({
    fileName: file.name,
    buffer,
    roles: importContext.roles,
    departments: importContext.departments,
    existingEmails: importContext.existingEmails,
  });

  if (!mapping.preview) {
    return { status: "error", message: mapping.error ?? "Could not read that file.", fileName: file.name };
  }

  const preview = mapping.preview;
  const staged = toStagedRows(preview);
  const errors = preview.rows
    .filter((row) => row.status !== "valid")
    .map((row) => ({
      rowNumber: row.rowNumber,
      fullName: row.fullName,
      email: row.email,
      status: row.status,
      messages: row.messages,
    }));

  if (!staged.length) {
    return {
      status: "error",
      message: "No importable rows were found. Fix the highlighted issues and upload again.",
      fileName: file.name,
      preview,
    };
  }

  const batch = await db.staffImportBatch.create({
    data: {
      hospitalId: context.hospital.id,
      fileName: file.name,
      status: "REVIEW",
      totalRows: preview.total,
      validRows: staged.length,
      invalidRows: preview.invalid,
      skippedRows: preview.skipped,
      rows: staged as object,
      errors: errors as object,
      createdByUserId: context.userId,
      createdByMemberId: context.membership.id,
    },
  });

  await recordCarebaseAudit(context, "staff.import_previewed", "StaffImportBatch", batch.id, {
    fileName: file.name,
    totalRows: preview.total,
    validRows: staged.length,
    invalidRows: preview.invalid,
    skippedRows: preview.skipped,
  });

  return {
    status: "ready",
    batchId: batch.id,
    fileName: file.name,
    preview,
  };
}

/**
 * Step 2 — turn the staged rows into staff invitations. Each invitation reuses
 * the same secure activation flow as single invites: the person authenticates
 * and only then is a HospitalMember created with the real user id.
 */
export async function confirmStaffImport(
  _state: StaffImportState,
  formData: FormData
): Promise<StaffImportState> {
  const context = await requireCarebasePermission("staff.manage");
  const batchId = String(formData.get("batchId") ?? "");

  const batch = await db.staffImportBatch.findFirst({
    where: { id: batchId, hospitalId: context.hospital.id, status: "REVIEW" },
  });
  if (!batch) {
    return jsonError("This import is no longer available. Upload the file again.");
  }

  const staged = (batch.rows as StaffImportStagedRow[] | null) ?? [];
  if (!staged.length) {
    return jsonError("This import has no rows left to confirm.");
  }

  const importContext = await loadImportContext(context.hospital.id);
  const validRoleIds = new Set(importContext.roles.map((role) => role.id));
  const validDepartmentIds = new Set(importContext.departments.map((department) => department.id));
  const existingEmails = importContext.existingEmails;

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? "https://" + process.env.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, "")
      : null) ??
    (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : null) ??
    "http://localhost:3000";
  const client = await clerkClient();

  const failures: StaffImportFailure[] = [];
  let imported = 0;

  for (const row of staged) {
    if (!validRoleIds.has(row.roleId)) {
      failures.push({ rowNumber: row.rowNumber, email: row.email, message: "Role no longer exists in this hospital." });
      continue;
    }
    if (existingEmails.has(row.email)) {
      failures.push({ rowNumber: row.rowNumber, email: row.email, message: "Already on the hospital team." });
      continue;
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    let invitationId: string | null = null;

    try {
      const invitation = await db.staffInvitation.create({
        data: {
          hospitalId: context.hospital.id,
          roleId: row.roleId,
          departmentId: row.departmentId && validDepartmentIds.has(row.departmentId) ? row.departmentId : null,
          email: row.email,
          fullName: row.fullName,
          tokenHash,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
          createdByUserId: context.userId,
        },
      });
      invitationId = invitation.id;

      const acceptUrl = origin + "/invitation/accept?token=" + token;
      const roleName = importContext.roles.find((item) => item.id === row.roleId)?.name ?? "Staff";
      const departmentName = row.departmentId
        ? importContext.departments.find((item) => item.id === row.departmentId)?.name ?? null
        : null;

      // Resend is the sender — send first. If Resend fails, the row fails
      // loudly so the owner knows the email never went out.
      const emailResult = await sendStaffInvitationEmail({
        to: row.email,
        fullName: row.fullName,
        hospitalName: context.hospital.name,
        roleName,
        departmentName,
        acceptUrl,
        expiresAt: invitation.expiresAt,
      });
      if (!emailResult.sent) {
        throw new Error(emailResult.error ?? "Invitation email could not be delivered.");
      }

      // Register with Clerk silently (notify: false) so Resend is the only sender.
      try {
        const clerkInvitation = await client.invitations.createInvitation({
          emailAddress: row.email,
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
        console.error("Clerk bulk invitation registration failed (Resend email already sent):", error instanceof Error ? error.message : "unknown");
      }

      imported += 1;
      existingEmails.add(row.email);
    } catch (error) {
      if (invitationId) {
        await db.staffInvitation.delete({ where: { id: invitationId } }).catch(() => undefined);
      }
      failures.push({
        rowNumber: row.rowNumber,
        email: row.email,
        message: error instanceof Error ? error.message : "Invitation could not be sent.",
      });
    }
  }

  const priorErrors = Array.isArray(batch.errors) ? (batch.errors as unknown[]) : [];
  await db.staffImportBatch.update({
    where: { id: batch.id },
    data: {
      status: imported ? "COMPLETED" : "FAILED",
      importedRows: imported,
      skippedRows: batch.skippedRows + failures.length,
      errors: [...priorErrors, ...failures] as object,
      completedAt: new Date(),
    },
  });

  await recordCarebaseAudit(context, "staff.import_completed", "StaffImportBatch", batch.id, {
    fileName: batch.fileName,
    imported,
    failed: failures.length,
  });

  if (imported) {
    await createCarebaseNotification({
      hospitalId: context.hospital.id,
      title: "Staff import completed",
      body: imported + " invitation" + (imported === 1 ? "" : "s") + " created from " + batch.fileName + ".",
      category: "STAFF",
      href: "/hospital/staff",
    });
    await publishCarebaseEvent(context.hospital.id, "staff.imported", "StaffImportBatch", batch.id, {
      imported,
      failed: failures.length,
      fileName: batch.fileName,
    });
  }

  revalidatePath("/hospital/staff");
  revalidatePath("/hospital/staff/import");

  return {
    status: "done",
    batchId: batch.id,
    importedCount: imported,
    failedRows: failures.length ? failures : undefined,
    message: imported
      ? imported + " staff invitation" + (imported === 1 ? "" : "s") + " sent."
      : "No invitations were sent. Review the reported issues and try again.",
  };
}

/** Removes a staged (unconfirmed) import so nothing lingers in review. */
export async function discardStaffImport(formData: FormData): Promise<void> {
  const context = await requireCarebasePermission("staff.manage");
  const batchId = String(formData.get("batchId") ?? "");
  const batch = await db.staffImportBatch.findFirst({
    where: { id: batchId, hospitalId: context.hospital.id, status: "REVIEW" },
    select: { id: true, fileName: true },
  });
  if (!batch) throw new Error("This import is no longer available.");

  await db.staffImportBatch.update({
    where: { id: batch.id },
    data: { status: "DISCARDED", completedAt: new Date() },
  });
  await recordCarebaseAudit(context, "staff.import_discarded", "StaffImportBatch", batch.id, {
    fileName: batch.fileName,
  });
  revalidatePath("/hospital/staff/import");
}