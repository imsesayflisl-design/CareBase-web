"use server";

import { currentUser, auth } from "@clerk/nextjs/server";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { SYSTEM_ROLES } from "@/lib/carebase/permissions";

export async function createCarebaseHospital(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress;
  if (!email) throw new Error("Your Clerk account needs an email address.");
  const normalizedEmail = email.trim().toLowerCase();

  // One email = one hospital workspace. Clerk already prevents a second
  // Clerk account with the same email, but the same signed-in user could
  // revisit /setup (or double-submit) and create a second workspace.
  // Block by user, by owner email, and by creator id so the owner email
  // can never be reused to spin up another account/workspace.
  const existingMembership = await db.hospitalMember.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, hospitalId: true },
  });
  if (existingMembership) redirect("/hospital");

  const emailInUse = await db.hospitalMember.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true, hospitalId: true },
  });
  if (emailInUse) redirect("/hospital");

  const hospitalOwnedByEmail = await db.hospital.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedEmail, mode: "insensitive" } },
        { createdByUserId: userId },
      ],
    },
    select: { id: true },
  });
  if (hospitalOwnedByEmail) redirect("/hospital");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (name.length < 2) throw new Error("Enter a hospital name.");
  if (city.length < 2) throw new Error("Enter a city or town.");

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email;
  const baseSlug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  const hospital = await db.hospital.create({
    data: {
      name,
      slug: baseSlug + "-" + randomUUID().slice(0, 6),
      type: type || null,
      city,
      region: region || null,
      phone: phone || null,
      email,
      logoUrl: "/carebase-logo.png",
      createdByUserId: userId,
      roles: {
        create: SYSTEM_ROLES.map((role) => ({
          name: role.name,
          description: role.description,
          permissions: role.permissions,
          isSystem: true,
        })),
      },
    },
    include: { roles: true },
  });
  const ownerRole = hospital.roles.find((role) => role.name === "OWNER");
  if (!ownerRole) throw new Error("Could not create the hospital owner role.");

  const membership = await db.hospitalMember.create({
    data: {
      hospitalId: hospital.id,
      userId,
      roleId: ownerRole.id,
      fullName,
      email,
      photoUrl: user?.imageUrl,
      title: "Hospital owner",
    },
  });

  await db.auditEvent.create({
    data: {
      hospitalId: hospital.id,
      actorMemberId: membership.id,
      actorUserId: userId,
      actorName: fullName,
      action: "hospital.created",
      entity: "Hospital",
      entityId: hospital.id,
      details: { name: hospital.name },
    },
  });

  redirect("/hospital");
}
