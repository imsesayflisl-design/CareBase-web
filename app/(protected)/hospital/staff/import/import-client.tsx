"use client";

import { useActionState } from "react";
import { confirmStaffImport, previewStaffImport } from "@/app/actions/carebase-import";
import type { StaffImportState } from "@/lib/carebase/staff-import";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";

const idleState: StaffImportState = { status: "idle" };

const statusStyles: Record<string, string> = {
  valid: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  error: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function StaffImportWorkbench({
  columns,
  exampleRow,
  templateHref,
}: {
  columns: string[];
  exampleRow: string;
  templateHref: string;
}) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewStaffImport,
    idleState
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmStaffImport,
    idleState
  );

  const preview = previewState.preview;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><FileSpreadsheet className="size-4" /></span>
            <div>
              <p className="text-sm font-semibold text-slate-900">1. Prepare your file</p>
              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                Download the template and keep these columns: <span className="font-medium text-slate-700">{columns.join(", ")}</span>.
                Role must match a role in this hospital.
              </p>
            </div>
          </div>
          <a href={templateHref} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:border-slate-300">
            <Download className="size-4" /> Download template
          </a>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Example row</p>
          <code className="mt-1 block whitespace-nowrap font-mono text-[11px] text-slate-600">{exampleRow}</code>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
        <p className="text-sm font-semibold text-slate-900">2. Upload and review</p>
        <p className="mt-1 text-xs text-slate-500">Accepted formats: .xlsx, .csv and .tsv, up to 5 MB and 500 rows. Nothing is saved until you confirm.</p>
        <form action={previewAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.csv,.tsv,.txt"
            className="h-10 w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-cyan-800"
          />
          <button
            type="submit"
            disabled={previewPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {previewPending ? "Validating…" : "Validate file"}
          </button>
        </form>
        {previewState.status === "error" && previewState.message && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {previewState.message}
          </p>
        )}
      </section>

      {preview && <PreviewPanel previewState={previewState} />}

      {preview && previewState.status === "ready" && previewState.batchId && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
          <p className="text-sm font-semibold text-slate-900">3. Confirm import</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Confirming sends a secure, time-limited invitation to every ready row. They join the hospital
            only after signing in and accepting, exactly like a single invitation.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <form action={confirmAction}>
              <input type="hidden" name="batchId" value={previewState.batchId} />
              <button
                type="submit"
                disabled={confirmPending}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {confirmPending ? "Sending invitations…" : "Confirm and send invitations"}
              </button>
            </form>
            <a href="/hospital/staff/import" className="text-xs font-semibold text-slate-500 hover:text-slate-800">Start over</a>
          </div>
        </section>
      )}

      {confirmState.status === "done" && <ResultPanel state={confirmState} />}
      {confirmState.status === "error" && confirmState.message && (
        <p className="flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {confirmState.message}
        </p>
      )}
    </div>
  );
}

function PreviewPanel({ previewState }: { previewState: StaffImportState }) {
  const preview = previewState.preview;
  if (!preview) return null;
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-6">
        <div>
          <p className="text-sm font-semibold text-slate-900">Validation preview</p>
          <p className="mt-1 text-xs text-slate-500">{previewState.fileName} · row numbers match your spreadsheet</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Total {preview.total}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Ready {preview.valid}</span>
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700">Errors {preview.invalid}</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">Skipped {preview.skipped}</span>
        </div>
      </div>
      <div className="overflow-x-auto p-5 md:p-6">
        <table className="w-full min-w-[860px] text-left">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <th className="pb-3">Row</th>
              <th className="pb-3">Name</th>
              <th className="pb-3">Email</th>
              <th className="pb-3">Role</th>
              <th className="pb-3">Department</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => (
              <tr key={row.rowNumber} className="align-top text-xs">
                <td className="py-3 font-mono text-slate-400">{row.rowNumber}</td>
                <td className="py-3 font-semibold text-slate-800">{row.fullName || "—"}</td>
                <td className="py-3 text-slate-600">{row.email || "—"}</td>
                <td className="py-3 text-slate-600">{row.role || "—"}</td>
                <td className="py-3 text-slate-600">{row.department || "—"}</td>
                <td className="py-3">
                  <span className={"inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 " + statusStyles[row.status]}>
                    {row.status}
                  </span>
                </td>
                <td className="py-3 text-slate-500">
                  {row.messages.length ? (
                    <ul className="space-y-1">
                      {row.messages.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  ) : (
                    <span className="text-emerald-600">Looks good</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultPanel({ state }: { state: StaffImportState }) {
  const imported = state.importedCount ?? 0;
  const failures = state.failedRows ?? [];
  return (
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-lg bg-white p-2.5 text-emerald-700"><CheckCircle2 className="size-4" /></span>
        <div>
          <p className="text-sm font-semibold text-emerald-900">Import confirmed</p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">{state.message}</p>
          <a href="/hospital/staff/import" className="mt-2 inline-flex text-xs font-semibold text-emerald-900 underline">Start another import</a>
        </div>
      </div>
      {failures.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4">
          <p className="text-xs font-semibold text-amber-900">{failures.length} row(s) were not invited</p>
          <ul className="mt-2 space-y-1.5">
            {failures.map((failure) => (
              <li key={failure.rowNumber + failure.email} className="text-[11px] text-slate-600">
                <span className="font-mono text-slate-400">Row {failure.rowNumber}</span> · {failure.email} — {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {imported === 0 && failures.length === 0 && (
        <p className="mt-3 text-xs text-amber-800">No invitations were created.</p>
      )}
    </section>
  );
}