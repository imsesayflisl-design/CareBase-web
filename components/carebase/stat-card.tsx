import type { LucideIcon } from "lucide-react";

export function CarebaseStat({
  label,
  value,
  note,
  icon: Icon,
  accent = "cyan",
}: {
  label: string;
  value: string | number;
  note: string;
  icon: LucideIcon;
  accent?: "cyan" | "blue" | "amber" | "green" | "rose" | "violet";
}) {
  const accents = {
    cyan: "bg-cyan-50 text-cyan-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_2px_12px_rgba(15,23,42,0.025)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-[30px] font-semibold leading-none tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={"rounded-xl p-2.5 " + accents[accent]}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-xs text-slate-400">{note}</p>
    </div>
  );
}
