import { createCarebaseHospital } from "@/app/actions/carebase-setup";
import { Button } from "@/components/ui/button";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Building2, MapPin, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function SetupPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses[0]?.emailAddress ?? "";

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/carebase-logo.png" alt="" width={48} height={48} className="h-10 w-10 rounded-xl object-contain" />
          <span className="text-lg font-bold tracking-tight text-slate-900">Care<span className="text-cyan-600">Base</span></span>
        </Link>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">Back to home</Link>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-6 pb-12 pt-5 lg:grid-cols-[0.9fr_1.1fr] lg:pt-16">
        <section className="flex flex-col justify-center">
          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
            <Building2 className="size-3.5" /> Hospital workspace setup
          </span>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight text-slate-950 md:text-5xl">
            Bring your care team onto one connected workspace.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-slate-500">
            Create your hospital workspace to manage people, appointments, patient records and daily operations with access scoped to your organization.
          </p>
          <div className="mt-9 space-y-4">
            {[
              ["One hospital, one secure workspace", "Hospital records stay inside their tenant."],
              ["Permissions from day one", "Your account becomes the hospital owner."],
              ["Invite the right care team", "Set up roles, departments and staff access."],
            ].map(([title, body]) => (
              <div className="flex gap-3" key={title}>
                <span className="mt-0.5 rounded-lg bg-white p-2 text-cyan-700 shadow-sm ring-1 ring-slate-200"><ShieldCheck className="size-4" /></span>
                <div><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mt-1 text-xs text-slate-500">{body}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.07)] md:p-9">
          <div className="mb-7">
            <p className="text-sm font-semibold text-slate-900">Set up your hospital</p>
            <p className="mt-1 text-sm text-slate-500">You can add departments and staff after setup.</p>
          </div>
          <form action={createCarebaseHospital} className="space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Hospital name <span className="text-rose-500">*</span></span>
              <input name="name" required minLength={2} placeholder="e.g. Freetown Community Hospital" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Hospital type</span>
              <select name="type" defaultValue="" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10">
                <option value="">Select type</option><option>General hospital</option><option>Clinic</option><option>Specialty hospital</option><option>Diagnostic center</option><option>Community health center</option>
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">City or town <span className="text-rose-500">*</span></span>
                <span className="relative block"><MapPin className="absolute left-3 top-3 size-4 text-slate-400" /><input name="city" required minLength={2} placeholder="Freetown" className="h-11 w-full rounded-xl border border-slate-200 px-9 pr-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" /></span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-700">Region / county</span>
                <input name="region" placeholder="Western Area" className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-700">Hospital phone</span>
              <input name="phone" type="tel" placeholder="+232 ..." className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
            </label>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Workspace owner: <span className="font-medium text-slate-700">{email}</span>
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl bg-cyan-700 text-white hover:bg-cyan-800">Create hospital workspace</Button>
            <p className="text-center text-[11px] leading-5 text-slate-400">By continuing, you confirm you are authorized to create this hospital workspace.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
