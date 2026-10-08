import { currentUser, clerkClient } from "@clerk/nextjs/server";
import db from "@/lib/db";
import { generateGlobalPatientCode } from "./auth";
import { jsonBody } from "./http";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asString(value: unknown, max = 200): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Creates the CareBase Patient row for a Clerk user on first login.
 * Idempotent — returns the existing row when present. Identity comes
 * exclusively from the verified Clerk session.
 */
export async function bootstrapPatient(userId: string, body: Record<string, unknown>) {
  const existing = await db.patient.findUnique({ where: { id: userId } });
  if (existing) return { patient: existing, created: false as const };

  const user = await currentUser();
  if (!user || user.id !== userId) return null;
  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses.find((a) => a.verification?.status === "verified")?.emailAddress;
  if (!email || !EMAIL_RE.test(email)) return null;

  const patientCode = await generateGlobalPatientCode();
  const patient = await db.patient.create({
    data: {
      id: userId,
      patientCode,
      first_name: asString(body.firstName, 60) ?? user.firstName ?? "CareBase",
      last_name: asString(body.lastName, 60) ?? user.lastName ?? "User",
      email: email.toLowerCase(),
      phone: asString(body.phone, 30) ?? "",
      date_of_birth: asString(body.dateOfBirth, 10)
        ? new Date(`${body.dateOfBirth}T12:00:00.000Z`)
        : new Date("1990-01-01T12:00:00.000Z"),
      gender: asString(body.gender, 10) === "FEMALE" ? "FEMALE" : "MALE",
      marital_status: asString(body.maritalStatus, 20) ?? "Single",
      address: asString(body.address, 200) ?? "",
      emergency_contact_name: asString(body.emergencyContactName, 100) ?? "",
      emergency_contact_number: asString(body.emergencyContactNumber, 30) ?? "",
      relation: asString(body.emergencyRelation, 50) ?? "",
      privacy_consent: body.privacyConsent === true,
      service_consent: body.serviceConsent === true,
      medical_consent: body.medicalConsent === true,
    },
  });

  // Auto-claim unlinked CarePatient records that match the verified email.
  await db.carePatient.updateMany({
    where: {
      externalUserId: null,
      email: { equals: email.toLowerCase(), mode: "insensitive" },
      hospital: { status: "ACTIVE" },
    },
    data: { externalUserId: userId },
  });

  return { patient, created: true as const };
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  return jsonBody(request);
}

/** Updates the patient's own profile fields (shared by PUT routes). */
export async function updatePatientProfile(
  userId: string,
  body: Record<string, unknown>
) {
  const data: Record<string, unknown> = {};
  const set = (column: string, value: string | undefined) => {
    if (value) data[column] = value;
  };
  set("first_name", asString(body.firstName, 60));
  set("last_name", asString(body.lastName, 60));
  set("phone", asString(body.phone, 30));
  const dob = asString(body.dateOfBirth, 10);
  if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const parsed = new Date(`${dob}T12:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) data.date_of_birth = parsed;
  }
  if (body.gender === "MALE" || body.gender === "FEMALE") data.gender = body.gender;
  set("address", asString(body.address, 200));
  set("emergency_contact_name", asString(body.emergencyContactName, 100));
  set("emergency_contact_number", asString(body.emergencyContactNumber, 30));
  set("relation", asString(body.emergencyRelation, 50));
  set("blood_group", asString(body.bloodGroup, 10));
  set("allergies", asString(body.allergies, 500));
  set("medical_conditions", asString(body.medicalConditions, 500));
  set("medical_history", asString(body.medicalHistory, 1000));
  set("insurance_provider", asString(body.insuranceProvider, 100));
  set("insurance_number", asString(body.insuranceNumber, 60));

  const patient = await db.patient.update({ where: { id: userId }, data });

  // Keep the Clerk display name in sync (best-effort).
  if (data.first_name || data.last_name) {
    try {
      const client = await clerkClient();
      await client.users.updateUser(userId, {
        firstName: patient.first_name,
        lastName: patient.last_name,
      });
    } catch (error) {
      console.error("Clerk profile sync failed:", error instanceof Error ? error.message : "unknown");
    }
  }
  return patient;
}
