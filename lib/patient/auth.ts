import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import db from "@/lib/db";
import type { Patient } from "@prisma/client";

/**
 * Resolves the authenticated Clerk session to the CareBase Patient row.
 * Identity always comes from the verified session token — never from a
 * client-supplied id.
 */
export async function getPatient(): Promise<Patient | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return db.patient.findUnique({ where: { id: userId } });
}

/**
 * Returns the authenticated session + patient row, or a discriminated
 * error the route can turn into an HTTP response.
 */
export async function requirePatient(): Promise<
  { ok: true; userId: string; patient: Patient } | { ok: false; error: string; status: number }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized", status: 401 };

  const patient = await db.patient.findUnique({ where: { id: userId } });
  if (!patient) {
    return {
      ok: false,
      error: "Patient profile not found. Complete onboarding first.",
      status: 404,
    };
  }
  return { ok: true, userId, patient };
}

/** Like requirePatient but allows a session without a profile yet (bootstrap). */
export async function requireSession(): Promise<
  { ok: true; userId: string } | { ok: false; error: string; status: number }
> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Unauthorized", status: 401 };
  return { ok: true, userId };
}

/** Returns the verified primary email of the Clerk user, or null. */
export async function getVerifiedEmail(userId: string): Promise<string | null> {
  const user = await currentUser();
  if (!user || user.id !== userId) return null;
  const primary = user.primaryEmailAddress;
  if (!primary || primary.verification?.status !== "verified") {
    const verified = user.emailAddresses.find(
      (address) => address.verification?.status === "verified"
    );
    return verified ? verified.emailAddress.toLowerCase() : null;
  }
  return primary.emailAddress.toLowerCase();
}

/** Generates the global patient code: PAT-SL-YYYY-XXXXXX (backend only). */
export async function generateGlobalPatientCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PAT-SL-${year}-`;
  const latest = await db.patient.findFirst({
    where: { patientCode: { startsWith: prefix } },
    orderBy: { patientCode: "desc" },
    select: { patientCode: true },
  });
  const lastNumber = latest?.patientCode
    ? Number(latest.patientCode.slice(prefix.length)) || 0
    : 0;
  return `${prefix}${String(lastNumber + 1).padStart(6, "0")}`;
}

/**
 * Generates a sequential public reference like APT-SL-2026-000182,
 * SCN-SL-2026-000182, EMR-SL-2026-000182. Backend only.
 */
export async function generateReference(kind: "APT" | "SCN" | "EMR"): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${kind}-SL-${year}-`;
  const args = {
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" as const },
    select: { reference: true },
  };
  let latestReference: string | null = null;
  if (kind === "APT") {
    latestReference = (await db.careAppointment.findFirst(args))?.reference ?? null;
  } else if (kind === "SCN") {
    latestReference = (await db.scanBooking.findFirst(args))?.reference ?? null;
  } else {
    latestReference = (await db.emergencyRequest.findFirst(args))?.reference ?? null;
  }
  const lastNumber = latestReference
    ? Number(latestReference.slice(prefix.length)) || 0
    : 0;
  return `${prefix}${String(lastNumber + 1).padStart(6, "0")}`;
}
