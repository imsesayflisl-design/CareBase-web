import { createWard, updateBedStatus } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { BedDouble, Building2, Wrench } from "lucide-react";

export default async function BedsPage() {
  const context = await requireCarebasePermission("beds.read");
  const canManage = await canAccess("beds.manage");
  const [wards, available, occupied, reserved, maintenance] = await Promise.all([
    db.ward.findMany({
      where: { hospitalId: context.hospital.id },
      include: { rooms: { include: { beds: { orderBy: { label: "asc" } } }, orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    }),
    db.bed.count({ where: { status: "AVAILABLE", room: { ward: { hospitalId: context.hospital.id } } } }),
    db.bed.count({ where: { status: "OCCUPIED", room: { ward: { hospitalId: context.hospital.id } } } }),
    db.bed.count({ where: { status: "RESERVED", room: { ward: { hospitalId: context.hospital.id } } } }),
    db.bed.count({ where: { status: "MAINTENANCE", room: { ward: { hospitalId: context.hospital.id } } } }),
  ]);
  const totalBeds = available + occupied + reserved + maintenance + await db.bed.count({
    where: { status: "UNAVAILABLE", room: { ward: { hospitalId: context.hospital.id } } },
  });

  return (
    <div>
      <PageHeader title="Beds & wards" description="Track ward capacity and keep bed availability current for the care team." action={<a href="/hospital/bed-requests" className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"><BedDouble className="size-4 text-cyan-700" /> Bed requests</a>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total beds" value={totalBeds} icon={BedDouble} accent="cyan" />
        <Metric label="Available" value={available} icon={BedDouble} accent="green" />
        <Metric label="Occupied" value={occupied} icon={Building2} accent="rose" />
        <Metric label="Reserved / maintenance" value={reserved + maintenance} icon={Wrench} accent="amber" />
      </div>

      {canManage && <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Add ward and beds</summary>
        <form action={createWard} className="grid gap-4 border-t border-cyan-100 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Ward name" name="name" required placeholder="General ward" />
          <Field label="Room name" name="roomName" placeholder="Room 1" />
          <Field label="Floor" name="floor" placeholder="Ground floor" />
          <Field label="Number of beds" name="bedCount" type="number" min={1} defaultValue={8} required />
          <Field label="Location" name="location" placeholder="East wing" />
          <Field label="Description" name="description" placeholder="Adult inpatient care" />
          <div className="sm:col-span-2 xl:col-span-4"><FormSubmit>Create ward</FormSubmit></div>
        </form>
      </details>}

      <div className="space-y-5">
        {wards.length ? wards.map((ward) => {
          const beds = ward.rooms.flatMap((room) => room.beds);
          const wardAvailable = beds.filter((bed) => bed.status === "AVAILABLE").length;
          return (
            <Panel key={ward.id} title={ward.name} description={(ward.location || "Hospital ward") + " · " + ward.rooms.length + " rooms · " + beds.length + " beds"} action={<span className="text-xs font-semibold text-emerald-700">{wardAvailable} available</span>}>
              <div className="mb-4 flex flex-wrap gap-1.5">{beds.map((bed) => <StatusBadge key={bed.id} status={bed.status} />).length === 0 ? <p className="text-xs text-slate-400">No beds added to this ward yet.</p> : null}</div>
              {ward.rooms.map((room) => <div key={room.id} className="mb-4 last:mb-0"><div className="mb-2 flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-700">{room.name}</h4><span className="text-[10px] text-slate-400">{room.floor || "Floor not set"}</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{room.beds.map((bed) => <div key={bed.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div><p className="text-xs font-semibold text-slate-800">{bed.label}</p><p className="mt-1 text-[10px] capitalize text-slate-500">{bed.status.toLowerCase()}</p></div>{canManage && <form action={updateBedStatus} className="flex items-center gap-1"><input type="hidden" name="bedId" value={bed.id} /><select name="status" defaultValue={bed.status} aria-label={"Status for " + bed.label} className="max-w-28 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px]"><option value="AVAILABLE">Available</option><option value="OCCUPIED">Occupied</option><option value="RESERVED">Reserved</option><option value="MAINTENANCE">Maintenance</option><option value="UNAVAILABLE">Unavailable</option></select><button className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white">Save</button></form>}</div>)}</div></div>)}
              {!beds.length && <EmptyState title="No beds in this ward" description="Add rooms and beds to start tracking capacity." />}
            </Panel>
          );
        }) : <Panel><EmptyState title="No wards configured" description="Add your first ward and bed inventory to make hospital capacity visible." /></Panel>}
      </div>
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof BedDouble; accent: "cyan" | "green" | "rose" | "amber" }) {
  const tones = { cyan: "bg-cyan-50 text-cyan-700", green: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700", amber: "bg-amber-50 text-amber-700" };
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className={"rounded-lg p-2.5 " + tones[accent]}><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
