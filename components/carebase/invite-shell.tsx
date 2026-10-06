import Image from "next/image";
import { ShieldCheck } from "lucide-react";

/**
 * Branded card wrapper shared by every page in the invite flow
 * (acceptance, password setup, expired-link states). Server-rendered.
 */
export function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
        <Image
          src="/carebase-logo.png"
          alt="CareBase"
          width={60}
          height={60}
          className="mx-auto size-14 rounded-xl object-contain"
        />
        {children}
      </section>
    </main>
  );
}

const TONE_STYLES = {
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-rose-50 text-rose-600",
  info: "bg-cyan-50 text-cyan-700",
} as const;

/** Status icon + headline + explanation used by every invite state. */
export function InviteStatus({
  tone,
  icon,
  title,
  body,
}: {
  tone: keyof typeof TONE_STYLES;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <>
      <span
        className={`mx-auto mt-5 flex size-12 items-center justify-center rounded-full ${TONE_STYLES[tone]}`}
      >
        {icon}
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
    </>
  );
}

/** Definition list of invite details (name, email, role, department, expiry). */
export function InviteDetails({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="mt-5 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-left">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {row.label}
          </dt>
          <dd className="text-xs font-semibold text-slate-800">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InviteSecurityNote({ text }: { text?: string }) {
  return (
    <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
      <ShieldCheck className="size-3.5" /> {text ?? "Secure, one-time invitation"}
    </p>
  );
}
