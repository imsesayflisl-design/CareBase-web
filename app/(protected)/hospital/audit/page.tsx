import { requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { format } from "date-fns";
import { Activity, ShieldCheck } from "lucide-react";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requireCarebasePermission("audit.read");
  const { q = "" } = await searchParams;
  const search = q.trim();
  const events = await db.auditEvent.findMany({
    where: {
      hospitalId: context.hospital.id,
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: "insensitive" } },
              { entity: { contains: search, mode: "insensitive" } },
              { actorName: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { actor: { include: { role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Audit log" description="A traceable record of important changes and workflows within this hospital." action={<div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-cyan-700" /> Tenant-scoped</div>} />
      <Panel title="Recorded activity" description="Recent staff invitations, patient changes, appointments and operational updates." action={<form action="/hospital/audit" className="flex gap-2"><input name="q" defaultValue={search} placeholder="Search action, user or record" className="h-9 w-56 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500" /><button className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Search</button></form>}>
        {events.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left">
          <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Actor</th><th className="pb-3">Action</th><th className="pb-3">Resource</th><th className="pb-3">Details</th><th className="pb-3">Time</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{events.map((event) => <tr key={event.id} className="text-xs"><td className="py-3.5"><p className="font-semibold text-slate-800">{event.actorName || event.actor?.fullName || "System"}</p><p className="mt-1 text-[10px] text-slate-400">{event.actor?.role.name.toLowerCase().replaceAll("_", " ") || "Hospital member"}</p></td><td className="py-3.5"><span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-800"><Activity className="size-3" />{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</span></td><td className="py-3.5 text-slate-600">{event.entity}<p className="mt-1 max-w-36 truncate font-mono text-[9px] text-slate-400">{event.entityId || "—"}</p></td><td className="max-w-72 py-3.5 text-[10px] text-slate-500">{event.details ? Object.entries(event.details as Record<string, unknown>).map(([key, value]) => key + ": " + String(value)).join(" · ") : "—"}</td><td className="py-3.5 text-slate-500">{format(event.createdAt, "MMM d, yyyy · h:mm:ss a")}</td></tr>)}</tbody>
        </table></div> : <EmptyState title="No audit events" description="Important actions performed in this workspace will appear here." />}
      </Panel>
    </div>
  );
}
