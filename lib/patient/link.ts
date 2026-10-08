import "server-only";

import db from "@/lib/db";
import { getVerifiedEmail } from "./auth";

export type HospitalLinkResult =
  | { ok: true; linked: { id: string; patientCode: string }; claimed?: boolean; registered?: boolean; status: number }
  | { ok: false; error: string; status: number };

/**
 * Links the authenticated patient to a hospital: claims an existing
 * unlinked record whose email matches the verified Clerk email, else
 * self-registers a new CarePatient row (backend-generated patientCode).
 */
export async function linkPatientToHospital(
  userId: string,
  hospitalId: string
): Promise<HospitalLinkResult> {
  const hospital = await db.hospital.findFirst({
    where: { id: hospitalId, status: "ACTIVE" },
    select: { id: true, name: true },
  });
  if (!hospital) return { ok: false, error: "Hospital not found", status: 404 };

  const already = await db.carePatient.findFirst({
    where: { hospitalId, externalUserId: userId },
    select: { id: true, patientCode: true },
  });
  if (already) return { ok: true, linked: already, status: 200 };

  const profile = await db.patient.findUnique({ where: { id: userId } });
  if (!profile) return { ok: false, error: "Complete your profile first", status: 404 };

  const verifiedEmail = await getVerifiedEmail(userId);
  if (!verifiedEmail || verifiedEmail !== profile.email.toLowerCase()) {
    return { ok: false, error: "Verify your email address before linking to a hospital", status: 403 };
  }

  const matching = await db.carePatient.findFirst({
    where: { hospitalId, externalUserId: null, email: { equals: verifiedEmail, mode: "insensitive" } },
    select: { id: true, patientCode: true },
  });
  if (matching) {
    const claimed = await db.carePatient.update({
      where: { id: matching.id },
      data: { externalUserId: userId },
      select: { id: true, patientCode: true },
    });
    return { ok: true, linked: claimed, claimed: true, status: 200 };
  }

  const nextNumber = (await db.carePatient.count({ where: { hospitalId } })) + 1;
  const patientCode = "PAT-SL-" + new Date().getFullYear() + "-" + String(nextNumber).padStart(6, "0");

  const created = await db.$transaction(async (tx) => {
    const row = await tx.carePatient.create({
      data: {
        hospitalId,
        patientCode,
        externalUserId: userId,
        firstName: profile.first_name,
        lastName: profile.last_name,
        phone: profile.phone || null,
        email: verifiedEmail,
        gender: profile.gender === "FEMALE" ? "Female" : "Male",
        dateOfBirth: profile.date_of_birth,
        address: profile.address || null,
        emergencyContactName: profile.emergency_contact_name || null,
        emergencyContactPhone: profile.emergency_contact_number || null,
        bloodGroup: profile.blood_group,
        allergies: profile.allergies,
        medicalConditions: profile.medical_conditions,
        medicalHistory: profile.medical_history,
      },
      select: { id: true, patientCode: true },
    });
    await tx.hospitalNotification.create({
      data: {
        hospitalId,
        title: "Patient self-registration",
        body: `${profile.first_name} ${profile.last_name} registered via the CareBase app (${patientCode}).`,
        category: "PATIENT",
        href: "/hospital/patients/" + row.id,
      },
    });
    await tx.careEvent.create({
      data: {
        hospitalId,
        type: "patient.self_registered",
        entity: "CarePatient",
        entityId: row.id,
        payload: { patientId: row.id, patientCode },
      },
    });
    return row;
  });

  return { ok: true, linked: created, registered: true, status: 201 };
}
