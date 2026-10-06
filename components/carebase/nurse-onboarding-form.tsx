"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, MailPlus, SkipForward, UserCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  completeNurseOnboarding,
  type NurseOnboardingResult,
} from "@/app/actions/carebase-onboarding";

const INITIAL: NurseOnboardingResult = { success: false, message: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

/**
 * Doctor onboarding nurse step: pick an existing nurse, invite a new one by
 * email (auto-invited when she's not in the system yet), or skip. Result is
 * surfaced inline + as a toast, and a successful step routes to the doctor's
 * department dashboard via the action's `redirectTo`.
 */
export function NurseOnboardingForm({
  nurses,
  fallbackTarget,
  doctorEmail,
}: {
  nurses: { id: string; fullName: string; email: string }[];
  fallbackTarget: string;
  doctorEmail: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(completeNurseOnboarding, INITIAL);
  const [mode, setMode] = useState<"existing" | "new">(nurses.length ? "existing" : "new");
  const [nurseEmail, setNurseEmail] = useState("");
  const [nurseName, setNurseName] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.message) return;
    if (state.success) {
      toast.success(state.message);
      router.push(state.redirectTo ?? fallbackTarget);
    } else {
      toast.error(state.message);
    }
  }, [state, router, fallbackTarget]);

  function validateNewNurse(): boolean {
    const nextEmailError = EMAIL_RE.test(nurseEmail.trim())
      ? null
      : "Enter a valid nurse email address.";
    const trimmedName = nurseName.trim();
    const nextNameError =
      trimmedName && trimmedName.length < 2 ? "Enter the nurse's full name or leave it blank." : null;
    setEmailError(nextEmailError);
    setNameError(nextNameError);
    return !nextEmailError && !nextNameError;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
        {(["existing", "new"] as const).map((option) => (
          <button
            key={option}
            type="button"
            disabled={pending}
            onClick={() => setMode(option)}
            className={`flex-1 rounded-md px-2 py-1.5 transition ${
              mode === option
                ? "bg-white text-cyan-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {option === "existing" ? "Pick from the team" : "Invite a new nurse"}
          </button>
        ))}
      </div>

      <form
        action={action}
        noValidate
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as
            | HTMLButtonElement
            | null;
          if (submitter?.value === "skip") return; // skipping never validates
          if (mode === "existing") {
            const select = event.currentTarget.elements.namedItem("nurseId") as
              | HTMLSelectElement
              | null;
            if (!select?.value) {
              event.preventDefault();
              toast.error("Choose a nurse from the list.");
              return;
            }
          } else if (!validateNewNurse()) {
            event.preventDefault();
          }
        }}
        className="space-y-3 text-left"
      >
        {mode === "existing" && (
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">
              Select nurse <span className="text-rose-500">*</span>
            </span>
            <select name="nurseId" required defaultValue="" className={INPUT} disabled={pending}>
              <option value="" disabled>
                {nurses.length
                  ? "Choose a nurse from your hospital"
                  : "No nurses on the team yet — invite one instead"}
              </option>
              {nurses.map((nurse) => (
                <option key={nurse.id} value={nurse.id}>
                  {nurse.fullName} · {nurse.email}
                </option>
              ))}
            </select>
          </label>
        )}

        {mode === "new" && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Nurse email <span className="text-rose-500">*</span>
              </span>
              <input
                name="nurseEmail"
                type="email"
                value={nurseEmail}
                onChange={(event) => setNurseEmail(event.target.value)}
                placeholder="nurse@hospital.com"
                className={INPUT}
                disabled={pending}
                aria-invalid={Boolean(emailError)}
              />
              {emailError && (
                <span className="mt-1 block text-[11px] font-medium text-rose-600">
                  {emailError}
                </span>
              )}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                Nurse name <span className="text-slate-400 font-normal">(optional)</span>
              </span>
              <input
                name="nurseFullName"
                value={nurseName}
                onChange={(event) => setNurseName(event.target.value)}
                placeholder="Nurse Aminata Diallo"
                className={INPUT}
                disabled={pending}
                aria-invalid={Boolean(nameError)}
              />
              {nameError && (
                <span className="mt-1 block text-[11px] font-medium text-rose-600">
                  {nameError}
                </span>
              )}
            </label>
            <p className="text-[11px] leading-5 text-slate-500">
              If she isn&apos;t in the system yet, an invitation email is sent automatically —
              you&apos;ll be linked when she accepts.
            </p>
          </>
        )}

        {state.message && !state.success && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium leading-5 text-rose-700">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="mode"
            value={mode}
            disabled={pending}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-xs font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "existing" ? (
              <UserCheck className="size-4" />
            ) : (
              <MailPlus className="size-4" />
            )}
            {pending
              ? "Saving…"
              : mode === "existing"
                ? "Assign this nurse"
                : "Send nurse invite"}
          </button>
          <button
            type="submit"
            name="mode"
            value="skip"
            disabled={pending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 disabled:opacity-60"
          >
            <SkipForward className="size-4" /> Skip for now
          </button>
        </div>
      </form>

      <p className="text-center text-[11px] text-slate-400">
        You can connect or change your nurse later from Staff &amp; access (signed in as{" "}
        {doctorEmail}).
      </p>
    </div>
  );
}
