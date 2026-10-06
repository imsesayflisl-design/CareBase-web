"use client";

import { useClerk, useSignUp, useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import { Check, Circle, KeyRound, Loader2, LogOut, MailCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  finalizeInviteAcceptance,
  type FinalizeInviteResult,
} from "@/app/actions/carebase-invitation";
import {
  PASSWORD_RULES,
  passwordRuleState,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/carebase/password-rules";

type FieldErrors = { password?: string; confirm?: string; code?: string };

/** Clerk errors carry a machine code + human message; we map both. */
type ClerkLikeError = {
  errors?: { code?: string; message?: string; longMessage?: string }[];
};

function isClerkError(error: unknown): error is ClerkLikeError {
  return Boolean(
    error &&
      typeof error === "object" &&
      Array.isArray((error as ClerkLikeError).errors),
  );
}

const INPUT =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

/**
 * Password setup step of the invite flow.
 *
 * - New users: creates the account through Clerk's sign-up with the invited
 *   email (inline password-rule validation, email-code step only when Clerk
 *   requires verification), then finalizes the invitation server-side.
 * - Already signed-in users: skips straight to finalizing.
 * - Existing-account / wrong-account / server failures all degrade to clear
 *   inline messages with the action needed to recover — never a dead end.
 */
export function PasswordSetupForm({
  token,
  invitedName,
  invitedEmail,
  hospitalName,
}: {
  token: string;
  invitedName: string;
  invitedEmail: string;
  hospitalName: string;
}) {
  const router = useRouter();
  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { signUp, setActive } = useSignUp();
  const clerk = useClerk();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"password" | "verify">("password");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<{ invited: string; actual: string } | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const passwordUrl = `/invitation/password?token=${encodeURIComponent(token)}`;
  const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(passwordUrl)}`;

  useEffect(() => {
    if (stage === "verify") codeRef.current?.focus();
  }, [stage]);

  /** Step 3: server-side finalize -> role-based dashboard redirect. */
  async function finalize() {
    const result: FinalizeInviteResult = await finalizeInviteAcceptance(token);
    if (result.success && result.redirectTo) {
      toast.success(result.message);
      router.push(result.redirectTo);
      return;
    }
    if (result.requiresSignIn) {
      setFormError(result.message);
      setShowSignIn(true);
      return;
    }
    if (result.emailMismatch) {
      setMismatch(result.emailMismatch);
      return;
    }
    setFormError(result.message);
  }

  function handleClerkError(error: unknown, scope: "password" | "code") {
    if (isClerkError(error)) {
      const first = error.errors?.[0];
      const code_ = first?.code ?? "";
      const message =
        first?.longMessage ?? first?.message ?? "Something went wrong. Please try again.";
      if (code_ === "form_identifier_exists") {
        setFormError(
          "An account already exists for this email. Sign in to finish setting up your invitation.",
        );
        setShowSignIn(true);
        return;
      }
      if (code_.startsWith("password") || /password/i.test(message)) {
        setFieldErrors((prev) => ({ ...prev, [scope]: message }));
        return;
      }
      if (scope === "code") {
        setFieldErrors((prev) => ({
          ...prev,
          code: /code|verif/i.test(message)
            ? message
            : "That code didn't work — check it and try again.",
        }));
        return;
      }
      setFormError(message);
      return;
    }
    console.error("[invite-password] unexpected client error", error);
    setFormError("Something went wrong while creating your account. Please try again.");
  }

  async function activateSession() {
    const sessionId = signUp?.createdSessionId;
    if (sessionId && setActive) {
      try {
        await setActive({ session: sessionId });
      } catch (error) {
        // A stale session id must not block onboarding — finalize re-checks auth.
        console.error("[invite-password] setActive failed", error);
      }
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: FieldErrors = {};
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    const confirmError = validatePasswordConfirmation(password, confirm);
    if (confirmError) errors.confirm = confirmError;
    setFieldErrors(errors);
    setFormError(null);
    setMismatch(null);
    if (Object.keys(errors).length) return;

    setBusy(true);
    try {
      if (isSignedIn) {
        await finalize();
        return;
      }
      if (!signUp) {
        setFormError("Account setup is not ready yet. Refresh the page and try again.");
        return;
      }
      const nameParts = invitedName.trim().split(/\s+/);
      await signUp.create({
        emailAddress: invitedEmail,
        password,
        firstName: nameParts[0] || invitedName,
        lastName: nameParts.slice(1).join(" ") || undefined,
      });
      if (signUp.status === "complete") {
        await activateSession();
        await finalize();
        return;
      }
      // Clerk still requires email verification for this instance — offer the
      // code step instead of failing (the invitee already has their inbox open).
      try {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setStage("verify");
      } catch (error) {
        console.error("[invite-password] prepare verification failed", error);
        setFormError(
          "We couldn't start email verification for this account. Please try again or contact your administrator.",
        );
      }
    } catch (error) {
      handleClerkError(error, "password");
    } finally {
      setBusy(false);
    }
  }

  async function handleCodeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    if (!code.trim()) {
      setFieldErrors({ code: "Enter the 6-digit code we emailed you." });
      return;
    }
    setBusy(true);
    try {
      if (!signUp) {
        setFormError("Your sign-up session expired — go back and try again.");
        return;
      }
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status === "complete") {
        await activateSession();
        await finalize();
        return;
      }
      setFieldErrors({
        code: "That code didn't finish verification — check the code and try again.",
      });
    } catch (error) {
      handleClerkError(error, "code");
    } finally {
      setBusy(false);
    }
  }

  async function handleResendCode() {
    setBusy(true);
    setFormError(null);
    try {
      if (!signUp) return;
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      toast.success("A new verification code is on its way.");
    } catch (error) {
      handleClerkError(error, "code");
    } finally {
      setBusy(false);
    }
  }

  async function handleContinue() {
    setBusy(true);
    setFormError(null);
    setMismatch(null);
    try {
      await finalize();
    } finally {
      setBusy(false);
    }
  }

  function signOutToThisPage() {
    void clerk.signOut({ redirectUrl: passwordUrl });
  }

  // Wrong signed-in account -> recover by switching to the invited email.
  if (mismatch) {
    return (
      <div className="mt-6 space-y-3 text-left">
        <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs font-medium leading-5 text-rose-700">
          This invitation was sent to{" "}
          <span className="font-semibold">{mismatch.invited}</span>, but you&apos;re signed in
          as <span className="font-semibold">{mismatch.actual}</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={signOutToThisPage}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
          >
            <LogOut className="size-4" /> Use the invited account
          </button>
          <button
            type="button"
            onClick={() => setMismatch(null)}
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  // Existing signed-in account: no new password needed — just finish onboarding.
  if (userLoaded && isSignedIn) {
    const signedInEmail =
      user?.primaryEmailAddress?.emailAddress ??
      user?.emailAddresses[0]?.emailAddress ??
      "";
    return (
      <div className="mt-6 space-y-4 text-left">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <UserRound className="size-4 text-cyan-700" /> Signed in as {signedInEmail}
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
            You already have an account, so no new password is needed. Continue to finish
            joining {hospitalName}.
          </p>
        </div>
        {formError && (
          <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium leading-5 text-rose-700">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleContinue}
            disabled={busy}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {busy ? "Finishing…" : "Continue to my dashboard"}
          </button>
          <button
            type="button"
            onClick={signOutToThisPage}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-60"
          >
            <LogOut className="size-4" /> Different account
          </button>
        </div>
      </div>
    );
  }

  const ruleState = passwordRuleState(password);

  return (
    <form
      onSubmit={stage === "password" ? handlePasswordSubmit : handleCodeSubmit}
      className="mt-6 space-y-4 text-left"
      noValidate
    >
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Setting up
        </p>
        <p className="mt-1 text-xs font-semibold text-slate-700">
          {invitedName} · {invitedEmail}
        </p>
      </div>

      {stage === "password" ? (
        <>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Password <span className="text-rose-500">*</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="Create a password"
              className={INPUT}
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {fieldErrors.password && (
              <span className="mt-1 block text-[11px] font-medium text-rose-600">
                {fieldErrors.password}
              </span>
            )}
          </label>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {PASSWORD_RULES.map((rule) => (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 text-[11px] ${
                  ruleState[rule.id] ? "text-emerald-600" : "text-slate-400"
                }`}
              >
                {ruleState[rule.id] ? (
                  <Check className="size-3.5" />
                ) : (
                  <Circle className="size-3.5" />
                )}
                {rule.label}
              </li>
            ))}
          </ul>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Confirm password <span className="text-rose-500">*</span>
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Re-enter your password"
              className={INPUT}
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.confirm)}
            />
            {fieldErrors.confirm && (
              <span className="mt-1 block text-[11px] font-medium text-rose-600">
                {fieldErrors.confirm}
              </span>
            )}
          </label>
        </>
      ) : (
        <>
          <p className="rounded-xl bg-cyan-50 px-3.5 py-3 text-xs leading-5 text-cyan-800">
            We sent a 6-digit verification code to{" "}
            <span className="font-semibold">{invitedEmail}</span>. Enter it below to activate
            your account.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Verification code <span className="text-rose-500">*</span>
            </span>
            <input
              ref={codeRef}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={`${INPUT} tracking-[0.4em]`}
              disabled={busy}
              aria-invalid={Boolean(fieldErrors.code)}
            />
            {fieldErrors.code && (
              <span className="mt-1 block text-[11px] font-medium text-rose-600">
                {fieldErrors.code}
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={handleResendCode}
            disabled={busy}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 disabled:opacity-60"
          >
            Resend code
          </button>
        </>
      )}

      {formError && !showSignIn && (
        <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-medium leading-5 text-rose-700">
          {formError}
        </p>
      )}
      {formError && showSignIn && (
        <div className="space-y-2 rounded-xl bg-amber-50 px-3.5 py-3">
          <p className="text-xs font-medium leading-5 text-amber-800">{formError}</p>
          <a
            href={signInUrl}
            className="inline-flex text-xs font-semibold text-cyan-700 hover:text-cyan-900"
          >
            Sign in instead →
          </a>
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : stage === "password" ? (
          <KeyRound className="size-4" />
        ) : (
          <MailCheck className="size-4" />
        )}
        {busy
          ? stage === "password"
            ? "Creating your account…"
            : "Verifying…"
          : stage === "password"
            ? "Set password & continue"
            : "Verify & continue"}
      </button>

      {stage === "verify" && (
        <button
          type="button"
          onClick={() => setStage("password")}
          disabled={busy}
          className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          ← Back to password
        </button>
      )}
    </form>
  );
}
