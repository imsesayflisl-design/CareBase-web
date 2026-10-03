"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export default function HospitalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server actions throw safe, human-readable messages (for example a
    // permission or tenant-isolation rejection). Log full details for ops.
    console.error("[hospital workspace]", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {error.message ||
            "The hospital workspace could not complete that request. Your data is safe — try again."}
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-slate-400">Reference: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800"
          >
            <Loader2 className="size-4" /> Try again
          </button>
          <a
            href="/hospital"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            Back to overview
          </a>
        </div>
      </div>
    </div>
  );
}