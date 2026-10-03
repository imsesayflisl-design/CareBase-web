import type { ReactNode } from "react";

export function PageHeader({
  eyebrow = "CareBase",
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-700">{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
