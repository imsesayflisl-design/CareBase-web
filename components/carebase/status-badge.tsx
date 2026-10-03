import { cn } from "@/lib/utils";

const colorByStatus: Record<string, string> = {
  REQUESTED: "bg-amber-50 text-amber-700 ring-amber-600/15",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/15",
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-600/15",
  SCHEDULED: "bg-blue-50 text-blue-700 ring-blue-600/15",
  IN_PROGRESS: "bg-violet-50 text-violet-700 ring-violet-600/15",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  PRESENT: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  REJECTED: "bg-rose-50 text-rose-700 ring-rose-600/15",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-500/10",
  NO_SHOW: "bg-rose-50 text-rose-700 ring-rose-600/15",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/15",
  ABSENT: "bg-rose-50 text-rose-700 ring-rose-600/15",
  REFUNDED: "bg-slate-100 text-slate-600 ring-slate-500/10",
  PARTIAL: "bg-violet-50 text-violet-700 ring-violet-600/15",
  MAINTENANCE: "bg-orange-50 text-orange-700 ring-orange-600/15",
  OCCUPIED: "bg-rose-50 text-rose-700 ring-rose-600/15",
  RESERVED: "bg-blue-50 text-blue-700 ring-blue-600/15",
  AVAILABLE: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  LEAVE: "bg-slate-100 text-slate-600 ring-slate-500/10",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset",
        colorByStatus[status] ?? "bg-slate-100 text-slate-600 ring-slate-500/10"
      )}
    >
      {status.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
