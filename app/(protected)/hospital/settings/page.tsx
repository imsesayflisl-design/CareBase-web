import { updateHospitalSettings } from "@/app/actions/carebase-operations";
import { requireCarebasePermission } from "@/lib/carebase/context";
import { PageHeader } from "@/components/carebase/page-header";
import { Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { Building2, MapPin, ShieldCheck } from "lucide-react";

export default async function HospitalSettingsPage() {
  const context = await requireCarebasePermission("hospital.manage");
  const hospital = context.hospital;

  return (
    <div>
      <PageHeader title="Hospital settings" description="Manage the hospital profile and operational defaults for this workspace." action={<div className="flex items-center gap-2 text-xs text-emerald-700"><ShieldCheck className="size-4" /> Owner / administrator access</div>} />
      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Hospital profile" description="This profile belongs to the currently selected tenant.">
          <form action={updateHospitalSettings} className="grid gap-4 md:grid-cols-2">
            <Field label="Hospital name" name="name" required defaultValue={hospital.name} />
            <Field label="Hospital type" name="type" defaultValue={hospital.type ?? ""} placeholder="General hospital, clinic..." />
            <Field label="Email" name="email" type="email" defaultValue={hospital.email ?? ""} />
            <Field label="Phone" name="phone" type="tel" defaultValue={hospital.phone ?? ""} />
            <Field label="Address" name="address" defaultValue={hospital.address ?? ""} />
            <Field label="City / town" name="city" defaultValue={hospital.city ?? ""} />
            <Field label="Region / county" name="region" defaultValue={hospital.region ?? ""} />
            <Field label="Country" name="country" defaultValue={hospital.country} />
            <Field label="Emergency contact" name="emergencyContact" defaultValue={hospital.emergencyContact ?? ""} />
            <Field label="Website" name="website" type="url" defaultValue={hospital.website ?? ""} placeholder="https://" />
            <SelectField label="Default currency" name="currency" defaultValue={hospital.currency} options={[{ label: "Sierra Leonean Leone · SLE", value: "SLE" }, { label: "US Dollar · USD", value: "USD" }, { label: "Liberian Dollar · LRD", value: "LRD" }, { label: "Guinean Franc · GNF", value: "GNF" }]} />
            <TextAreaField label="Description" name="description" defaultValue={hospital.description} rows={3} />
            <div className="md:col-span-2"><FormSubmit>Save hospital profile</FormSubmit></div>
          </form>
        </Panel>
        <div className="space-y-5">
          <Panel title="Workspace details">
            <div className="space-y-4 text-xs">
              <Info icon={Building2} label="Workspace slug" value={hospital.slug} />
              <Info icon={MapPin} label="Workspace region" value={[hospital.city, hospital.region, hospital.country].filter(Boolean).join(", ")} />
              <div className="rounded-xl bg-cyan-50 p-4 text-cyan-900"><p className="text-xs font-semibold">Tenant isolation is active</p><p className="mt-1 text-[11px] leading-5 text-cyan-800/80">Hospital records are queried and changed using the current membership's hospital ID, resolved on the server.</p></div>
            </div>
          </Panel>
          <Panel title="Your account">
            <div className="space-y-3 text-xs"><Info icon={ShieldCheck} label="Role" value={context.role.name.replaceAll("_", " ")} /><Info icon={Building2} label="Member since" value={hospital.createdAt.toLocaleDateString()} /><p className="border-t border-slate-100 pt-3 leading-5 text-slate-500">Use Clerk account settings to change your sign-in method, password or profile photo.</p></div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return <div className="flex gap-3"><span className="rounded-lg bg-slate-50 p-2 text-slate-500"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-800">{value || "Not set"}</p></div></div>;
}
