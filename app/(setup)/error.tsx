"use client";

import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

/**
 * Error boundary for the invite flow + workspace setup routes (acceptance,
 * password setup, setup). Catches any Server Component crash during render,
 * logs the digest for ops, and shows a recoverable fallback instead of the
 * production blank/white screen.
 */
export default function SetupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[carebase-invite] setup route render failed", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          We couldn&apos;t complete that step. Your invitation is safe — try again, or
          ask your hospital administrator for a fresh link if the problem continues.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-slate-400">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800"
          >
            <Loader2 className="size-4" /> Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            Back to home
          </a>
        </div>
      </div>
    </main>
  );
}
