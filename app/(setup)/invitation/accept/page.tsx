import { InviteDetails, InviteSecurityNote, InviteShell, InviteStatus } from "@/components/carebase/invite-shell";
import { RequestInviteButton } from "@/components/carebase/request-invite-button";
import { loadInvitationByToken, type InvitationPreview } from "@/lib/carebase/invitation";
import { logInviteFailure } from "@/lib/carebase/invites";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock3, XCircle } from "lucide-react";
import Link from "next/link";

/**
 * Step 1 of invite acceptance: confirm the invite details (name, department,
 * role) before setting a password.
 *
 * The token is validated BEFORE anything renders; a bad/expired/revoked link
 * gets a clear status page (with a re-issue option when possible), and any
 * server failure is logged with its digest and shown as a friendly fallback
 * instead of crashing the Server Component.
 */
export default async function AcceptInvitationPage({
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
    logInviteFailure("accept-page-load", error, { tokenProvided: Boolean(token) });
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
          href={`/invitation/accept?token=${encodeURIComponent(token ?? "")}`}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Try again
        </Link>
      </InviteShell>
    );
  }

  if (!token) {
    return (
      <InviteShell>
        <InviteStatus
          tone="warning"
          icon={<Clock3 className="size-6" />}
          title="Invitation link is incomplete"
          body="This link is missing its invitation code. Open the link directly from your invitation email, or ask your hospital administrator to send a new one."
        />
        <InviteSecurityNote text="One link, one recipient, 48-hour expiry" />
        <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-cyan-700">
          Return to CareBase
        </Link>
      </InviteShell>
    );
  }

  if (preview === null || preview.status === "invalid") {
    return (
      <InviteShell>
        <InviteStatus
          tone="danger"
          icon={<XCircle className="size-6" />}
          title="Invitation expired or invalid"
          body="This invitation link is not valid any more. Ask your hospital administrator to send you a fresh invitation — if you were expecting one by email, use the most recent message."
        />
        <InviteSecurityNote text="Links expire 48 hours after they are sent" />
        <Link href="/" className="mt-4 inline-flex text-sm font-semibold text-cyan-700">
          Return to CareBase
        </Link>
      </InviteShell>
    );
  }

  const invitation = preview.invitation;
  const expiresLabel = format(invitation.expiresAt, "MMMM d, yyyy 'at' h:mm a");
  const detailRows = [
    { label: "Name", value: invitation.fullName },
    { label: "Email", value: invitation.email },
    { label: "Role", value: invitation.roleName },
    { label: "Department", value: invitation.departmentName ?? "No department assigned" },
    { label: "Hospital", value: invitation.hospitalName },
  ];

  if (preview.status === "expired") {
    return (
      <InviteShell>
        <InviteStatus
          tone="warning"
          icon={<Clock3 className="size-6" />}
          title="This invitation has expired"
          body={`Invitations expire 48 hours after they are sent. This ${invitation.roleName} invite expired on ${expiresLabel}. Request a fresh link below and we'll email ${invitation.email}.`}
        />
        <InviteDetails rows={detailRows} />
        <RequestInviteButton token={token} />
        <p className="mt-4 text-[11px] leading-5 text-slate-400">
          The new link also expires after 48 hours.
        </p>
      </InviteShell>
    );
  }

  if (preview.status === "revoked") {
    return (
      <InviteShell>
        <InviteStatus
          tone="danger"
          icon={<XCircle className="size-6" />}
          title="This invitation was revoked"
          body={`${invitation.hospitalName} cancelled this invitation. If you still need access, ask your hospital administrator to invite you again.`}
        />
        <InviteDetails rows={detailRows} />
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-cyan-700">
          Return to CareBase
        </Link>
      </InviteShell>
    );
  }

  if (preview.status === "accepted") {
    return (
      <InviteShell>
        <InviteStatus
          tone="success"
          icon={<CheckCircle2 className="size-6" />}
          title="You've already joined"
          body={`This invitation for ${invitation.roleName} at ${invitation.hospitalName} was already accepted. Sign in to open your dashboard.`}
        />
        <Link
          href="/sign-in?redirect_url=%2Fhospital"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Sign in to continue
        </Link>
      </InviteShell>
    );
  }

  // Pending: show the confirmed invite details, then hand off to password setup.
  return (
    <InviteShell>
      <InviteStatus
        tone="success"
        icon={<CheckCircle2 className="size-6" />}
        title={`You're invited to join ${invitation.hospitalName}`}
        body="Review your invitation details below, then continue to set your password."
      />
      <InviteDetails rows={detailRows} />
      <p className="mt-4 text-xs leading-5 text-slate-500">
        This link is personal to{" "}
        <span className="font-semibold text-slate-700">{invitation.email}</span> and expires{" "}
        {expiresLabel}.
      </p>
      <Link
        href={`/invitation/password?token=${encodeURIComponent(token)}`}
        className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800"
      >
        Continue to password setup
      </Link>
      <InviteSecurityNote />
    </InviteShell>
  );
}
