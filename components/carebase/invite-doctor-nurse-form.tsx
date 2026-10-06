"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import type { InviteActionResult } from "@/app/actions/carebase-admin";
import { inviteDoctorWithNurse } from "@/app/actions/carebase-doctor-nurse-invite";

const INITIAL: InviteActionResult = { success: false, message: "" };

/**
 * Owner flow: invite a doctor + nurse together.
 * Nurse: pick existing from the list, type new (auto-invited), or blank.
 */
export function InviteDoctorNurseForm({
  departments,
  nurses,
}: {
  departments: { id: string; name: string }[];
  nurses: { id: string; fullName: string; email: string }[];
}) {
  // React 19 invokes useActionState actions as (prevState, formData).
  const [state, action, pending] = useActionState(
    (_prev: InviteActionResult, formData: FormData) => inviteDoctorWithNurse(formData),
    INITIAL,
  );
  const [fieldErrors, setFieldErrors] = useState<{
    doctorFullName?: string;
    doctorEmail?: string;
    departmentId?: string;
  }>({});

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /** Client-side validation for the doctor's required fields only — nurse
   * problems must never block the owner (the server degrades them to a note). */
  function validateBeforeSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const doctorName = (
      form.elements.namedItem("doctorFullName") as HTMLInputElement
    ).value.trim();
    const doctorEmail = (form.elements.namedItem("doctorEmail") as HTMLInputElement).value.trim();
    const departmentId = (
      form.elements.namedItem("departmentId") as HTMLSelectElement
    ).value;
    const errors: typeof fieldErrors = {};
    if (doctorName.length < 2) errors.doctorFullName = "Enter the doctor's full name.";
    if (!EMAIL_RE.test(doctorEmail)) errors.doctorEmail = "Enter a valid doctor email address.";
    if (!departmentId) errors.departmentId = "Choose a department.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) event.preventDefault();
  }
  const [nurseMode, setNurseMode] = useState<"existing" | "new" | "none">(
    nurses.length ? "existing" : "new",
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const input =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

  return (
    <form action={action} noValidate onSubmit={validateBeforeSubmit} className="border-t border-cyan-100 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Doctor name <span className="text-rose-500">*</span></span>
          <input name="doctorFullName" required minLength={2} placeholder="Dr. Jane Conteh" className={input} disabled={pending} aria-invalid={Boolean(fieldErrors.doctorFullName)} />
          {fieldErrors.doctorFullName && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.doctorFullName}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Doctor email <span className="text-rose-500">*</span></span>
          <input name="doctorEmail" type="email" required placeholder="doctor@hospital.com" className={input} disabled={pending} aria-invalid={Boolean(fieldErrors.doctorEmail)} />
          {fieldErrors.doctorEmail && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.doctorEmail}</span>}
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Department <span className="text-rose-500">*</span></span>
          <select name="departmentId" required defaultValue="" className={input} disabled={pending}>
            <option value="" disabled>Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {fieldErrors.departmentId && <span className="mt-1 block text-[11px] font-medium text-rose-600">{fieldErrors.departmentId}</span>}
        </label>
        <div className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nurse</span>
          <div className="flex h-10 items-center gap-1 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
            {(["existing", "new", "none"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={pending}
                onClick={() => setNurseMode(mode)}
                className={`flex-1 rounded-md px-2 py-1.5 transition ${nurseMode === mode ? "bg-white text-cyan-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                {mode === "existing" ? "Pick nurse" : mode === "new" ? "New nurse" : "Later"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {nurseMode === "existing" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Select nurse</span>
            <select name="nurseMemberId" className={input} disabled={pending} defaultValue="">
              <option value="">Choose a nurse from this hospital</option>
              {nurses.map((n) => <option key={n.id} value={n.id}>{n.fullName} · {n.email}</option>)}
            </select>
          </label>
          <p className="self-end text-[11px] leading-5 text-slate-500">
            The nurse is already on the team — they'll be linked to the doctor when the doctor accepts.
          </p>
        </div>
      )}

      {nurseMode === "new" && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nurse name</span>
            <input name="nurseFullName" minLength={2} placeholder="Nurse Aminata Diallo" className={input} disabled={pending} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Nurse email</span>
            <input name="nurseEmail" type="email" placeholder="nurse@hospital.com" className={input} disabled={pending} />
          </label>
          <p className="text-[11px] leading-5 text-slate-500 md:col-span-2">
            If this nurse isn't in the system yet, an invitation is sent to them automatically — the owner is never blocked.
          </p>
        </div>
      )}

      {state.message && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {state.message}
        </p>
      )}

      <div className="mt-4">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 text-xs font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Stethoscope className="size-4" />}
          {pending ? "Sending invitations…" : "Invite doctor + nurse"}
        </button>
        <span className="ml-3 text-[11px] text-slate-400">Both links expire after 48 hours.</span>
      </div>
    </form>
  );
}
