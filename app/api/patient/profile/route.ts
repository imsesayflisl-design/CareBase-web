import db from "@/lib/db";
import { requirePatient, requireSession } from "@/lib/patient/auth";
import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";
import { bootstrapPatient, updatePatientProfile } from "@/lib/patient/profile";

export const dynamic = "force-dynamic";

/**
 * GET /api/patient/profile
 * Returns the authenticated patient's profile + linked hospitals.
 * Identity comes from the Clerk session — never from a query param.
 */
export async function GET() {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const patient = await db.patient.findUnique({ where: { id: session.userId } });
  if (!patient) return jsonError("Patient profile not found", 404);

  const linkedHospitals = await db.carePatient.findMany({
    where: { externalUserId: session.userId, hospital: { status: "ACTIVE" } },
    select: {
      id: true,
      patientCode: true,
      hospital: { select: { id: true, name: true, slug: true, city: true, phone: true } },
    },
    orderBy: { hospital: { name: "asc" } },
  });

  return jsonOk({ patient, hospitals: linkedHospitals });
}

/**
 * POST /api/patient/profile
 * Bootstraps the CareBase Patient row on first login (idempotent).
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const body = (await jsonBody(request)) ?? {};
  const result = await bootstrapPatient(session.userId, body);
  if (!result) return jsonError("Your account needs a verified email address", 400);
  return jsonOk(result, result.created ? 201 : 200);
}

/**
 * PUT /api/patient/profile
 * Updates the patient's own profile fields.
 */
export async function PUT(request: Request) {
  const auth = await requirePatient();
  if (!auth.ok) return jsonError(auth.error, auth.status);

  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const patient = await updatePatientProfile(auth.userId, body);
  return jsonOk({ patient });
}

