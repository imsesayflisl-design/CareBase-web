import "server-only";

import { randomBytes, createHash } from "crypto";
import { headers } from "next/headers";

/** Invite links expire after 48 hours. */
export const INVITATION_TTL_MS = 48 * 60 * 60 * 1000;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Raw invite tokens are 32 random bytes rendered as 64 hex chars. */
export const INVITE_TOKEN_RE = /^[a-f0-9]{64}$/i;

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function validatePerson(
  fullName: string,
  email: string,
  label: string,
): string | null {
  if (fullName.length < 2) return `Enter the ${label}'s full name.`;
  if (!EMAIL_RE.test(email)) return `Enter a valid ${label} email address.`;
  return null;
}

export function validateNursePair(
  nurseName: string,
  nurseEmail: string,
): string | null {
  if (!nurseName && !nurseEmail) return null;
  if (Boolean(nurseName) !== Boolean(nurseEmail)) {
    return "Enter both the nurse's name and email, or leave both blank.";
  }
  if (nurseName.length < 2) return "Enter the nurse's full name.";
  if (!EMAIL_RE.test(nurseEmail)) return "Enter a valid nurse email address.";
  return null;
}

export function mintInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

export function inviteExpiry(): Date {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

/**
 * Absolute origin for invite links. `origin` is absent on some server-action
 * calls, so fall back to env (Vercel provides VERCEL_URL automatically).
 */
export async function inviteOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const fromHeader = requestHeaders.get("origin")?.replace(/\/$/, "");
  if (fromHeader) return fromHeader;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (appUrl) return /^https?:\/\//.test(appUrl) ? appUrl : `https://${appUrl}`;
  const vercelUrl = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export function acceptUrlFor(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invitation/accept?token=${token}`;
}

export function logInviteFailure(operation: string, error: unknown, extra?: Record<string, unknown>) {
  const detail =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
          digest: (error as Error & { digest?: string }).digest,
          stack: error.stack,
        }
      : { error: String(error) };
  console.error(`[carebase-invite] ${operation} failed`, { ...detail, ...extra });
}

/** sha256 hex of a raw invite token — the only form ever stored. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Shape check before touching the database. */
export function isValidInviteToken(token: unknown): token is string {
  return typeof token === "string" && INVITE_TOKEN_RE.test(token);
}

/**
 * Maps a HospitalRole name onto the lowercase slug the middleware expects in
 * Clerk's publicMetadata.role (see lib/routes.ts routeAccess).
 */
export function middlewareRoleSlug(roleName: string): string {
  const slug = roleName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  if (slug === "TECHNICIAN") return "lab_technician";
  return slug.toLowerCase();
}
