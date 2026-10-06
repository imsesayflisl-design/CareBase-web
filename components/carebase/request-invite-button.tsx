"use client";

import { useActionState, useEffect } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  requestNewInvitation,
  type RequestInviteResult,
} from "@/app/actions/carebase-invitation";

const INITIAL: RequestInviteResult = { success: false, message: "" };

/**
 * "Send me a new invite" on the expired-link page. Rotates the token server
 * side and re-sends the email; result is shown inline and as a toast.
 */
export function RequestInviteButton({ token }: { token: string }) {
  const [state, action, pending] = useActionState(
    async (_prev: RequestInviteResult, _formData: FormData) => requestNewInvitation(token),
    INITIAL,
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.success) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  return (
    <form action={action} className="mt-6 space-y-3">
      <button
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 text-sm font-semibold text-white transition hover:bg-cyan-800 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RotateCcw className="size-4" />
        )}
        {pending ? "Sending a new invite…" : "Send me a new invite"}
      </button>
      {state.message && (
        <p
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            state.success
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
