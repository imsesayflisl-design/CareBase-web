import { InviteDetails, InviteSecurityNote, InviteShell, InviteStatus } from "@/components/carebase/invite-shell";
import { PasswordSetupForm } from "@/components/carebase/password-setup-form";
import { loadInvitationByToken, type InvitationPreview } from "@/lib/carebase/invitation";
import { logInviteFailure } from "@/lib/carebase/invites";
import { format } from "date-fns";
import { AlertTriangle, KeyRound } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Step 2 of invite acceptance: set the password for the new account.
 *
 * The invite token is re-validated before this page renders anything;
 * every non-pending state (invalid / expired / revoked / already accepted)
 * redirects to the acceptance page, which owns those messages. Server
 * failures are logged with their digest and rendered as a fallback card.
 */
export default async function PasswordSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  let preview: InvitationPreview | null = null;
  let loadFailed = false;
  try {
    preview = await loadInvitationByToken(token);
  } catch (error) {
    loadFailed = true;
    logInviteFailure("password-page-load", error, { tokenProvided: Boolean(token) });
  }

  if (loadFailed) {
    return (
      <InviteShell>
        <InviteStatus
          tone="danger"
          icon={<AlertTriangle className="size-6" />}
          title="We couldn't load that invitation"
          body="Something went wrong on our side — your invitation is safe. Refresh the page or try again in a moment."
        />
        <Link
          href={`/invitation/password?token=${encodeURIComponent(token ?? "")}`}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Try again
        </Link>
      </InviteShell>
    );
  }

  // Non-pending states (and missing tokens) are rendered by the acceptance
  // page so every invalid-link entry point shows one consistent message.
  if (!token || !preview || preview.status !== "pending") {
    redirect(`/invitation/accept?token=${encodeURIComponent(token ?? "")}`);
  }

  const invitation = preview.invitation;
  const expiresLabel = format(invitation.expiresAt, "MMMM d, yyyy 'at' h:mm a");

  return (
    <InviteShell>
      <InviteStatus
        tone="info"
        icon={<KeyRound className="size-6" />}
        title="Set your password"
        body={`Create a password to secure your ${invitation.roleName} account at ${invitation.hospitalName}.`}
      />
      <InviteDetails
        rows={[
          { label: "Name", value: invitation.fullName },
          { label: "Role", value: invitation.roleName },
          { label: "Department", value: invitation.departmentName ?? "No department assigned" },
          { label: "Expires", value: expiresLabel },
        ]}
      />
      <PasswordSetupForm
        token={token}
        invitedName={invitation.fullName}
        invitedEmail={invitation.email}
        hospitalName={invitation.hospitalName}
      />
      <InviteSecurityNote text="Your password is stored securely by our identity provider" />
    </InviteShell>
  );
}
