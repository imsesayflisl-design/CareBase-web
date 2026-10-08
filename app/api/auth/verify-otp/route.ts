import { jsonBody, jsonError, jsonOk } from "@/lib/patient/http";
import { requireSession } from "@/lib/patient/auth";
import { verifyOtp } from "@/lib/patient/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/verify-otp
 * Verifies a 6-digit email OTP (expiry + attempts + one-time use).
 * On success for an authenticated session, the session's email is
 * considered step-up verified for the current purpose.
 */
export async function POST(request: Request) {
  const body = await jsonBody(request);
  if (!body) return jsonError("Send a valid JSON request", 400);

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!email) return jsonError("email is required", 400);
  if (!code) return jsonError("code is required", 400);

  const purpose =
    typeof body.purpose === "string" && body.purpose.length <= 40
      ? body.purpose
      : "VERIFY_EMAIL";

  const session = await requireSession();
  if (!session.ok) return jsonError(session.error, session.status);

  const result = await verifyOtp(email, code, purpose);
  if (!result.ok) return jsonError(result.error, result.status);

  return jsonOk({ verified: true });
}
