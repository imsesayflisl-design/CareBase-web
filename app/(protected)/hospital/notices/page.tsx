import { createHospitalNotice } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { Megaphone } from "lucide-react";

export default async function HospitalNoticesPage() {
  const context = await requireCarebasePermission("notices.read");
  const canManage = await canAccess("notices.manage");
  const notices = await db.hospitalNotice.findMany({
    where: {
      hospitalId: context.hospital.id,
      OR: [{ audience: { isEmpty: true } }, { audience: { has: context.role.name } }],
    },
    include: { author: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 60,
  });

  return (
    <div>
      <PageHeader title="Hospital notices" description="Share service updates, closures and operational information with the hospital team." action={<div className="flex items-center gap-2 text-xs text-slate-500"><Megaphone className="size-4 text-cyan-700" /> Hospital communication</div>} />
      {canManage && <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Create a notice</summary>
        <form action={createHospitalNotice} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2">
          <Field label="Notice title" name="title" required placeholder="e.g. Radiology service unavailable" />
          <Field label="Expires on" name="expiresAt" type="date" />
          <div className="md:col-span-2"><TextAreaField label="Details" name="body" rows={4} required placeholder="Add the information staff need to know." /></div>
          <fieldset className="rounded-xl border border-slate-100 p-3"><legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Audience</legend><div className="flex flex-wrap gap-4">{["ADMIN", "DOCTOR", "NURSE", "TECHNICIAN", "RECEPTIONIST", "ACCOUNTANT", "STAFF"].map((role) => <label key={role} className="flex items-center gap-1.5 text-[11px] text-slate-600"><input type="checkbox" name="audience" value={role} className="size-3.5 rounded border-slate-300 text-cyan-700" />{role.toLowerCase()}</label>)}</div><p className="mt-2 text-[10px] text-slate-400">Leave unselected to publish to everyone in this hospital.</p></fieldset>
          <label className="flex items-center gap-2 self-center text-xs text-slate-600"><input type="checkbox" name="publish" className="size-4 rounded border-slate-300 text-cyan-700" /> Publish immediately</label>
          <div className="md:col-span-2"><FormSubmit>Save notice</FormSubmit></div>
        </form>
      </details>}

      <Panel title="Notices" description="Drafts and published hospital announcements">
        {notices.length ? <div className="space-y-3">{notices.map((notice) => <article key={notice.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-800">{notice.title}</h3><p className="mt-1 text-[10px] text-slate-500">{notice.author.fullName} · Created {format(notice.createdAt, "MMM d, yyyy · h:mm a")}{notice.publishAt ? " · Published " + format(notice.publishAt, "MMM d, yyyy") : ""}</p></div><StatusBadge status={notice.status} /></div><p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-600">{notice.body}</p><div className="mt-3 flex flex-wrap gap-1.5">{notice.audience.length ? notice.audience.map((role) => <span key={role} className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-600">{role.toLowerCase()}</span>) : <span className="rounded-full bg-cyan-50 px-2 py-1 text-[9px] font-medium text-cyan-800">Everyone</span>}{notice.expiresAt && <span className="ml-auto text-[10px] text-slate-400">Expires {format(notice.expiresAt, "MMM d, yyyy")}</span>}</div></article>)}</div> : <EmptyState title="No hospital notices" description="Create an announcement for service updates, operating hours or urgent information." />}
      </Panel>
    </div>
  );
}
