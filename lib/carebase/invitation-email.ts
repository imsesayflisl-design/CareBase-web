import "server-only";

import { Resend } from "resend";

type InvitationEmailArgs = {
  to: string;
  fullName: string;
  hospitalName: string;
  roleName: string;
  departmentName?: string | null;
  acceptUrl: string;
  expiresAt: Date;
};

/**
 * Primary delivery for staff invitations — Resend is the sender.
 *
 * Clerk invitations are registered with `notify: false` (silent) so only
 * Resend sends the email — no duplicates, no dependency on Clerk's email
 * sender/domain configuration.
 *
 * Returns `{ sent: boolean; error?: string }`.
 */
export async function sendStaffInvitationEmail(args: InvitationEmailArgs): Promise<{
  sent: boolean;
  error?: string;
  /** True when Resend rejected the send because the `from` domain can't email this recipient (test-mode sender). Callers can fall back to Clerk delivery. */
  isDomainError?: boolean;
}> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "Email delivery is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL). Add both in Vercel → Settings → Environment Variables, then redeploy." };
  }

  const expiresLabel = args.expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const greetingName = args.fullName.trim().split(/\s+/)[0] || "there";

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; color: #0f172a;">
      <div style="padding: 28px 28px 8px;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #0e7490; margin: 0 0 12px;">CareBase · Hospital invitation</p>
        <h1 style="font-size: 22px; line-height: 1.3; margin: 0 0 12px;">Hello ${escapeHtml(greetingName)}, you've been invited to join ${escapeHtml(args.hospitalName)}</h1>
        <p style="font-size: 14px; line-height: 1.7; color: #475569; margin: 0 0 8px;">You've been added as <strong style="color:#0f172a;">${escapeHtml(args.roleName)}</strong>${args.departmentName ? ` in <strong style="color:#0f172a;">${escapeHtml(args.departmentName)}</strong>` : ""}. Sign in with this email address (${escapeHtml(args.to)}) and accept your invitation to access the workspace.</p>
        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 0 0 20px;">This invitation expires on ${escapeHtml(expiresLabel)}. It can only be used by ${escapeHtml(args.to)}.</p>
        <a href="${escapeHtml(args.acceptUrl)}" style="display: inline-block; background: #0e7490; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 22px; border-radius: 10px;">Accept invitation</a>
        <p style="font-size: 12px; line-height: 1.7; color: #94a3b8; margin: 20px 0 0;">If the button doesn't work, copy this link into your browser:<br /><span style="word-break: break-all; color: #64748b;">${escapeHtml(args.acceptUrl)}</span></p>
      </div>
      <div style="padding: 16px 28px 28px; font-size: 12px; color: #94a3b8;">The CareBase team · ${escapeHtml(args.hospitalName)}</div>
    </div>
  `.trim();

  const text = [
    `Hello ${greetingName}, you've been invited to join ${args.hospitalName}.`,
    ``,
    `Role: ${args.roleName}${args.departmentName ? ` · Department: ${args.departmentName}` : ""}`,
    `Sign in with ${args.to} and accept here: ${args.acceptUrl}`,
    ``,
    `This invitation expires on ${expiresLabel} and can only be used by ${args.to}.`,
    ``,
    `The CareBase team`,
  ].join("\n");

  try {
    const result = await new Resend(apiKey).emails.send({
      from,
      to: args.to,
      subject: `You're invited to join ${args.hospitalName} on CareBase`,
      html,
      text,
    });
    if (result.error) {
      const raw = result.error.message;
      console.error("Staff invitation email failed:", raw);
      // Resend's shared onboarding@resend.dev sender can only email the
      // Resend account owner — anything else 403s. Surface that plainly so
      // the owner knows to verify their own domain.
      const hint = /resend\.dev|verify a domain|testing emails/i.test(raw)
        ? " Resend's onboarding@resend.dev address can only email your own Resend account address. Verify your own domain in Resend (Domains → Add Domain), set RESEND_FROM_EMAIL to it in Vercel, redeploy, and retry."
        : "";
      return {
        sent: false,
        error: raw + hint,
        isDomainError: /resend\.dev|verify a domain|testing emails/i.test(raw),
      };
    }
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email delivery failed.";
    console.error("Staff invitation email failed:", message);
    return { sent: false, error: message };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
