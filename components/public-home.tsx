import {
  Activity,
  ArrowDown,
  ArrowRight,
  BedDouble,
  CalendarDays,
  Check,
  ClipboardList,
  HeartPulse,
  Hospital,
  Stethoscope,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Reveal } from "@/components/reveal";

const hospitalPhoto =
  "https://images.pexels.com/photos/36000439/pexels-photo-36000439.jpeg?auto=compress&cs=tinysrgb&w=1800&h=1350&dpr=1";
const clinicianPhoto =
  "https://images.pexels.com/photos/6129437/pexels-photo-6129437.jpeg?auto=compress&cs=tinysrgb&w=1200&h=1000&dpr=1";

const capabilities = [
  {
    icon: CalendarDays,
    title: "Appointments",
    description: "Receive requests, coordinate schedules and track visits through follow-up.",
    tone: "bg-blue-50 text-blue-800",
  },
  {
    icon: ClipboardList,
    title: "Patient records",
    description: "Keep patient details, allergies, medical history and care notes together.",
    tone: "bg-emerald-50 text-emerald-800",
  },
  {
    icon: Stethoscope,
    title: "Clinical workflows",
    description: "Document encounters, diagnoses, treatment plans and prescriptions.",
    tone: "bg-violet-50 text-violet-800",
  },
  {
    icon: Users,
    title: "Staff and departments",
    description: "Organize staff, specialties, department membership, roles and invitations.",
    tone: "bg-amber-50 text-amber-800",
  },
  {
    icon: Activity,
    title: "Diagnostics",
    description: "Coordinate laboratory and imaging services, orders, schedules and results.",
    tone: "bg-cyan-50 text-cyan-900",
  },
  {
    icon: BedDouble,
    title: "Hospital operations",
    description: "Manage bed requests, attendance, payments, notices and reports.",
    tone: "bg-rose-50 text-rose-800",
  },
];

const audiences = [
  {
    icon: Hospital,
    title: "Hospital administrators",
    description: "Configure the workspace, teams, permissions and daily operations.",
  },
  {
    icon: Stethoscope,
    title: "Doctors, nurses and staff",
    description: "Work with appointments, patient details and clinical tasks for your role.",
  },
  {
    icon: HeartPulse,
    title: "Patients and families",
    description: "Connect with hospital services, appointment requests and care information.",
  },
];

const setupSteps = [
  {
    number: "01",
    title: "Set up your hospital",
    description: "Create a hospital workspace and add its departments and core settings.",
  },
  {
    number: "02",
    title: "Bring in your care team",
    description: "Invite staff and assign roles that match their responsibilities.",
  },
  {
    number: "03",
    title: "Coordinate everyday care",
    description: "Manage visits, records, clinical work and supporting operations together.",
  },
];

export function PublicHome() {
  return (
    <main className="bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <nav aria-label="Main navigation" className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-slate-900">
            <Image src="/carebase-logo.png" alt="" width={42} height={42} className="size-10 object-contain" priority />
            <span>Care<span className="text-cyan-700">Base</span></span>
          </Link>
          <div className="hidden items-center gap-7 lg:flex">
            <Link href="#system" className="nav-link text-xs font-medium text-slate-600 transition-colors hover:text-cyan-800">System</Link>
            <Link href="#how-it-works" className="nav-link text-xs font-medium text-slate-600 transition-colors hover:text-cyan-800">How it works</Link>
            <Link href="#who-its-for" className="nav-link text-xs font-medium text-slate-600 transition-colors hover:text-cyan-800">Who it’s for</Link>
            <Link href="#about" className="nav-link text-xs font-medium text-slate-600 transition-colors hover:text-cyan-800">About</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link href="/sign-in" className="px-2 py-2 text-xs font-semibold text-slate-600 hover:text-slate-950">Sign in</Link>
            <Link href="/sign-up" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1763b8] px-3.5 text-xs font-semibold text-white transition hover:bg-[#124f96] sm:px-4">
              Create workspace <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </nav>
      </header>

      <section className="grid min-h-[570px] overflow-hidden lg:min-h-[600px] lg:grid-cols-[0.88fr_1.12fr]">
        <div className="home-hero-copy flex flex-col justify-center bg-[#f0f7ff] px-6 py-14 sm:px-10 lg:px-14 xl:px-[8vw]">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#245eb8]">
            <HeartPulse className="size-3.5" /> Care, connected
          </p>
          <h1 className="gradient-text max-w-[520px] text-[42px] font-semibold leading-[1.04] sm:text-[54px]">
            CareBase
          </h1>
          <p className="mt-4 max-w-[520px] text-xl font-medium leading-7 text-[#3577b9] sm:text-2xl sm:leading-8">
            A connected hospital system for better coordinated care.
          </p>
          <p className="mt-4 max-w-[500px] text-sm leading-6 text-slate-600 sm:text-[15px]">
            Bring appointments, patient records, clinical work and hospital operations into one role-aware workspace.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex h-12 items-center gap-2 rounded-md bg-[#1763b8] px-5 text-sm font-semibold text-white transition hover:bg-[#124f96]">
              Create hospital workspace <ArrowRight className="size-4" />
            </Link>
            <Link href="#system" className="inline-flex h-12 items-center gap-2 rounded-md border border-[#b7cfe8] px-4 text-sm font-semibold text-[#194e80] transition hover:bg-white">
              See what’s included <ArrowDown className="size-4" />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[330px] overflow-hidden bg-[#d9eafa] sm:min-h-[400px] lg:min-h-[600px]">
          <Image
            src={hospitalPhoto}
            alt="Modern hospital exterior in daylight"
            fill
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="home-hero-image object-cover object-[68%_center]"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f0f7ff]/50 via-transparent to-[#173d61]/10" />
          <div className="motion-safe:animate-float-slow absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm sm:bottom-8 sm:left-8">
            <Hospital className="size-4 text-[#1763b8]" /> Built for hospital teams
          </div>
        </div>
      </section>

      <section aria-label="CareBase benefits" className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-4 sm:divide-y-0">
          {[
            { icon: Stethoscope, title: "Care teams", text: "Roles for every discipline", color: "text-[#1763b8]" },
            { icon: Activity, title: "Connected care", text: "Clinical and operational work", color: "text-emerald-700" },
            { icon: CalendarDays, title: "Daily workflows", text: "Appointments to follow-ups", color: "text-violet-700" },
            { icon: Check, title: "Role-aware access", text: "Information by permission", color: "text-amber-700" },
          ].map(({ icon: Icon, title, text, color }, index) => (
            <Reveal
              as="div"
              key={title}
              variant="up"
              delay={index * 90}
              className="flex items-center gap-3 px-3 py-4 sm:px-5 sm:py-3"
            >
              <Icon className={`size-6 shrink-0 ${color}`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-[11px]">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="system" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Reveal as="div" variant="up" className="grid gap-6 border-b border-slate-200 pb-8 md:grid-cols-[0.75fr_1.25fr] md:items-end md:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">Inside CareBase</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">One system for the work around care.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              CareBase supports the everyday hospital journey: organize the team, coordinate a visit, document care and keep related services moving.
            </p>
          </Reveal>
          <div className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description, tone }, index) => (
              <Reveal
                as="article"
                key={title}
                variant="up"
                delay={index * 90}
                className="group card-lift border-b border-slate-200 py-6 hover:border-cyan-200 sm:min-h-[188px]"
              >
                <div className="flex items-center justify-between">
                  <span className={`inline-flex size-10 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${tone}`}><Icon className="size-5" /></span>
                  <span className="text-xs font-semibold text-slate-300">0{index + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-24 bg-[#f1f7fc] px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Reveal as="div" variant="up" className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Start with your hospital. Build around your team.</h2>
          </Reveal>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {setupSteps.map(({ number, title, description }, index) => (
              <Reveal
                as="article"
                key={number}
                variant="up"
                delay={index * 120}
                className="card-lift border-t-2 border-[#2bb9ae] pt-5"
              >
                <span className="text-xs font-bold text-[#1763b8]">{number}</span>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="who-its-for" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Reveal as="div" variant="up" className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">Who it’s for</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Different roles. One connected view of care.</h2>
          </Reveal>
          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-10">
            {audiences.map(({ icon: Icon, title, description }, index) => (
              <Reveal
                as="article"
                key={title}
                variant="up"
                delay={index * 120}
                className="group card-lift border-t-2 border-[#28b8ad] pt-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">0{index + 1}</span>
                  <Icon className="size-5 text-[#1763b8] transition-transform duration-300 group-hover:scale-110" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-16">
          <Reveal as="div" variant="left" className="group relative min-h-[330px] overflow-hidden bg-[#e8f1fa] sm:min-h-[430px]">
            <Image src={clinicianPhoto} alt="Care professional in a clinical setting" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover object-[center_35%] transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
          </Reveal>
          <Reveal as="div" variant="right" delay={120}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">Designed for real workflows</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Keep the patient journey in view.</h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              Teams can move from appointment requests to visits, documentation and supporting services without losing sight of the person receiving care.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Appointments connect to patient and department details.",
                "Clinical notes, diagnoses and prescriptions stay with the encounter.",
                "Diagnostic orders, bed requests and payments support ongoing care.",
              ].map((item) => <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700"><Check className="mt-1 size-4 shrink-0 text-emerald-700" />{item}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="bg-[#143e69] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.75fr_1.25fr] md:items-center md:gap-16">
          <Reveal as="div" variant="left">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200">Access and accountability</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">The right information for the right role.</h2>
          </Reveal>
          <Reveal as="div" variant="right" delay={120}>
            <p className="max-w-2xl text-sm leading-7 text-white/80">
              Each hospital has its own workspace. Staff access is managed with hospital roles and permissions, helping teams work with the information needed for their responsibilities.
            </p>
            <div className="mt-7 grid gap-x-8 sm:grid-cols-2">
              {[
                "Hospital-scoped workspaces",
                "Role-based permissions",
                "Staff and department management",
                "Audit and operational records",
              ].map((item) => <p key={item} className="flex items-center gap-2 border-t border-white/20 py-3 text-xs font-medium text-white"><Check className="size-4 text-cyan-300" />{item}</p>)}
            </div>
          </Reveal>
        </div>
      </section>

      <section id="about" className="scroll-mt-24 px-5 py-16 sm:px-8 sm:py-20 lg:px-10">
        <Reveal as="div" variant="up" className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[0.7fr_1.3fr] md:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">About CareBase</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">Technology that supports the people who provide care.</h2>
          </div>
          <div className="max-w-3xl">
            <p className="text-lg leading-8 text-slate-700">
              CareBase is a hospital workspace connecting administration, clinical teams and patient-facing services. It brings essential workflows together so hospitals can organize their work around the needs of their communities.
            </p>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              The system includes appointment coordination, patient records, clinical documentation, diagnostics, bed requests, staff operations and reporting. Its purpose is practical: make responsibilities clearer and care easier to coordinate.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="bg-[#f0f7ff] px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
        <Reveal as="div" variant="up" className="mx-auto flex max-w-7xl flex-col gap-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-800">Get started</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">Bring your hospital team into one workspace.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1763b8] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#124f96]">Create workspace <ArrowRight className="size-4" /></Link>
            <Link href="/sign-in" className="inline-flex h-11 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-white">Sign in</Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-7 text-slate-800 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold">
            <Image src="/carebase-logo.png" alt="" width={34} height={34} className="size-8 object-contain" />
            <span>Care<span className="text-cyan-700">Base</span></span>
          </Link>
          <p className="text-xs text-slate-500">Connected hospital care. © {new Date().getFullYear()} CareBase</p>
          <div className="flex gap-5 text-xs font-medium text-slate-600">
            <Link href="/sign-in" className="hover:text-slate-950">Sign in</Link>
            <Link href="/sign-up" className="hover:text-slate-950">Create workspace</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
