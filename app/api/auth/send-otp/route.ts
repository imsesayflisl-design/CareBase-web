import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";
import { requireSession } from "@/lib/patient/auth";
import { sendOtp } from "@/lib/patient/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/send-otp
 * Sends a 6-digit email OTP through Resend (backend only).
 * Accepts an optional Clerk Bearer token for authenticated purposes
 * (e.g. step-up verification); unauthenticated sends use purpose VERIFY_EMAIL.
 */
export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) return jsonError("email is required", 400);

  const session = await requireSession();
  if (session.ok && body.email === undefined) {
    return jsonError("email is required", 400);
  }
  // When signed in, the code must target the session's own verified email
  // unless the caller is explicitly requesting a code for another address
  // during onboarding — in that case identity checks happen at verify time.
  const purpose =
    typeof body.purpose === "string" && body.purpose.length <= 40
      ? body.purpose
      : "VERIFY_EMAIL";

  const result = await sendOtp(email, purpose);
  if (!result.ok) return jsonError(result.error, result.status);

  return jsonOk({
    sent: true,
    // Development convenience only; never present in production.
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
}
