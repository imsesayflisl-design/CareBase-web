import { acceptCarebaseInvitation } from "@/app/actions/carebase-invitation";
import { auth } from "@clerk/nextjs/server";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return <InvitationMessage title="Invitation link is incomplete" body="Ask your hospital administrator to send you a new invitation." />;
  }
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=" + encodeURIComponent("/invitation/accept?token=" + token));
  }
  const accept = acceptCarebaseInvitation.bind(null, token);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
        <Image src="/carebase-logo.png" alt="CareBase" width={60} height={60} className="mx-auto size-14 rounded-xl object-contain" />
        <span className="mx-auto mt-5 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-6" /></span>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Join your hospital workspace</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your invitation assigns your hospital and role. Those details are managed by your hospital administrator.</p>
        <form action={accept} className="mt-6">
          <button className="h-11 w-full rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800">Accept invitation</button>
        </form>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="size-3.5" /> Secure, one-time invitation</p>
      </section>
    </main>
  );
}

function InvitationMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center">
        <Image src="/carebase-logo.png" alt="" width={56} height={56} className="mx-auto size-14 rounded-xl object-contain" />
        <h1 className="mt-5 text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-cyan-700">Return to CareBase</Link>
      </div>
    </main>
  );
}
