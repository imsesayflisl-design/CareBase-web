"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { inviteHospitalMember, type InviteActionResult } from "@/app/actions/carebase-admin";

const INITIAL: InviteActionResult = { success: false, message: "" };

/** Single-team-member invite with loading + toast feedback (never a page crash). */
export function InviteMemberForm({
  roles,
  departments,
}: {
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
}) {
  // React 19 invokes useActionState actions as (prevState, formData).
  const [state, action, pending] = useActionState(
    (_prev: InviteActionResult, formData: FormData) => inviteHospitalMember(formData),
    INITIAL,
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const input =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

  return (
    <form action={action} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Full name <span className="text-rose-500">*</span></span>
        <input name="fullName" required minLength={2} placeholder="Jane Conteh" className={input} disabled={pending} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Work email <span className="text-rose-500">*</span></span>
        <input name="email" type="email" required placeholder="staff@hospital.com" className={input} disabled={pending} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Role <span className="text-rose-500">*</span></span>
        <select name="roleId" required defaultValue="" className={input} disabled={pending}>
          <option value="" disabled>Select role</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name.replaceAll("_", " ")}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Department</span>
        <select name="departmentId" defaultValue="" className={input} disabled={pending}>
          <option value="">No department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <div className="xl:col-span-4">
        {state.message && (
          <p className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {state.message}
          </p>
        )}
        <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 text-xs font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </div>
    </form>
  );
}
