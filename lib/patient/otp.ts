import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import db from "@/lib/db";

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_SEND_LIMIT = 3; // per email per hour
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function otpSecret(): string {
  // A dedicated secret; falls back to the Clerk secret in development so
  // local setups work without extra configuration. Never logged.
  return process.env.OTP_HASH_SECRET || process.env.CLERK_SECRET_KEY || "carebase-dev-otp";
}

export function hashOtp(email: string, code: string): string {
  return createHmac("sha256", otpSecret())
    .update(`${email.toLowerCase()}:${code}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export type OtpSendResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: string; status: number };

/**
 * Creates and emails a 6-digit OTP via Resend. The code is stored hashed,
 * never logged, and never returned (except in development for local testing).
 */
export async function sendOtp(email: string, purpose: string): Promise<OtpSendResult> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false, error: "Enter a valid email address", status: 400 };
  }

  const since = new Date(Date.now() - OTP_SEND_WINDOW_MS);
  const recent = await db.emailOtp.count({ where: { email: normalized, createdAt: { gte: since } } });
  if (recent >= OTP_SEND_LIMIT) {
    return { ok: false, error: "Too many code requests. Try again later.", status: 429 };
  }
  const lastSent = await db.emailOtp.findFirst({
    where: { email: normalized, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastSent && Date.now() - lastSent.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS) {
    return {
      ok: false,
      error: "A code was just sent. Wait a moment before requesting another.",
      status: 429,
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false, error: "Email delivery is not configured.", status: 500 };
  }

  const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.emailOtp.create({
    data: {
      email: normalized,
      codeHash: hashOtp(normalized, code),
      purpose,
      expiresAt,
    },
  });

  let result;
  try {
    result = await new Resend(apiKey).emails.send({
      from,
      to: [normalized],
      subject: `${code} is your CareBase verification code`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0F172A">
          <h1 style="color:#0D9488;font-size:20px;margin:0 0 16px">CareBase</h1>
          <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
            Use this code to verify your email address. It expires in ${OTP_TTL_MINUTES} minutes.
          </p>
          <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0F172A;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">
            ${code}
          </p>
          <p style="font-size:13px;color:#64748B;margin:0">
            If you did not request this code, you can safely ignore this email.
          </p>
        </div>`,
    });
  } catch (error) {
    console.error("Resend request failed:", error instanceof Error ? error.message : "Unknown error");
    return { ok: false, error: "We could not send the code. Try again.", status: 502 };
  }

  if (result.error) {
    console.error("OTP email delivery failed:", result.error.message);
    return { ok: false, error: "We could not send the code. Try again.", status: 502 };
  }

  return { ok: true, devCode: process.env.NODE_ENV === "development" ? code : undefined };
}

export type OtpVerifyResult = { ok: true } | { ok: false; error: string; status: number };

/** Verifies expiry, attempt count, and one-time use; consumes on success. */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: string
): Promise<OtpVerifyResult> {
  const normalized = email.trim().toLowerCase();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "Enter the 6-digit code", status: 400 };
  }

  const record = await db.emailOtp.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) {
    return { ok: false, error: "No active code found. Request a new one.", status: 400 };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "That code has expired. Request a new one.", status: 400 };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Request a new code.", status: 429 };
  }

  const matches = safeEqual(record.codeHash, hashOtp(normalized, code));
  if (!matches) {
    const updated = await db.emailOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });
    const remaining = OTP_MAX_ATTEMPTS - updated.attempts;
    return {
      ok: false,
      error:
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Too many incorrect attempts. Request a new code.",
      status: 400,
    };
  }

  await db.emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
