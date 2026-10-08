"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { createDepartment, type CreateDepartmentResult } from "@/app/actions/carebase-admin";

const INITIAL: CreateDepartmentResult = { success: false, message: "" };

export function CreateDepartmentForm({
  departments,
  locations,
  contacts,
  descriptions,
}: {
  departments: { id: string; name: string }[];
  locations: string[];
  contacts: string[];
  descriptions: string[];
}) {
  const [state, action, pending] = useActionState(
    (_prev: CreateDepartmentResult, formData: FormData) => createDepartment(formData),
    INITIAL,
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!state.message) return;
    if (state.success) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);

  useEffect(() => {
    setCopied(false);
  }, [state.departmentId]);

  async function copyToken() {
    if (!state.departmentId) return;
    try {
      await navigator.clipboard.writeText(state.departmentId);
      setCopied(true);
      toast.success("Department id copied.");
    } catch {
      toast.error("Copy failed — select the id manually.");
    }
  }

  const input =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 disabled:opacity-60";

  return (
    <form action={action} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
      <label>
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Department</span>
        <DepartmentPresetPicker />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Location</span>
        <select name="location" defaultValue="" className={input} disabled={pending}>
          <option value="">Select a location</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Contact</span>
        <input name="contact" placeholder="Extension or phone" className={input} disabled={pending} />
      </label>
      <div className="xl:col-span-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-slate-700">Description</span>
          <textarea
            name="description"
            rows={2}
            className={
              input +
              " mt-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            }
            disabled={pending}
          />
        </label>
        {state.message && (
          <p className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${state.success ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {state.message}
          </p>
        )}
        {state.departmentId && (
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 sm:flex-row sm:items-center">
            <p className="min-w-0 flex-1 truncate text-xs text-amber-900">
              <span className="font-semibold">Department id:</span>{" "}
              <span className="font-mono">{state.departmentId}</span>
            </p>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-semibold text-white transition hover:bg-amber-700"
            >
              {copied ? "Copied" : "Copy id"}
            </button>
          </div>
        )}
        <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-5 text-xs font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {pending ? "Saving…" : "Create department"}
        </button>
      </div>
    </form>
  );
}

