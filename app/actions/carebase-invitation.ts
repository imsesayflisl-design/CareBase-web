"use server";

import { createHash } from "crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";

export async function acceptCarebaseInvitation(token: string) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.emailAddresses.find(
    (address) => address.verification?.status === "verified"
  )?.emailAddress;
  if (!email) throw new Error("Your account needs a verified email address.");

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invitation = await db.staffInvitation.findFirst({
    where: {
      tokenHash,
      email: { equals: email, mode: "insensitive" },
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: { hospital: true, role: true },
  });
  if (!invitation) throw new Error("This invitation is invalid or has expired.");

  const existing = await db.hospitalMember.findFirst({
    where: { hospitalId: invitation.hospitalId, userId },
  });
  if (!existing) {
    const fullName =
      [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
      invitation.fullName;
    const membership = await db.hospitalMember.create({
      data: {
        hospitalId: invitation.hospitalId,
        userId,
        roleId: invitation.roleId,
        fullName,
        email,
        title: invitation.role.description ?? invitation.role.name,
        photoUrl: user?.imageUrl,
      },
    });
    if (invitation.departmentId) {
      await db.departmentMember.create({
        data: {
          hospitalId: invitation.hospitalId,
          departmentId: invitation.departmentId,
          memberId: membership.id,
        },
      });
    }
    if (invitation.role.name === "DOCTOR") {
      await db.doctorProfile.create({
        data: {
          hospitalId: invitation.hospitalId,
          memberId: membership.id,
          departmentId: invitation.departmentId,
        },
      });
    }
    await db.auditEvent.create({
      data: {
        hospitalId: invitation.hospitalId,
        actorMemberId: membership.id,
        actorUserId: userId,
        actorName: fullName,
        action: "staff.invitation_accepted",
        entity: "StaffInvitation",
        entityId: invitation.id,
      },
    });
  }

  await db.staffInvitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  redirect("/hospital");
}
