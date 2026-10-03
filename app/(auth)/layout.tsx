import Image from "next/image";
import Link from "next/link";
import React from "react";

const clinicianPhoto = "/auth-clinician.png";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* ------------------------- Brand panel (desktop) ------------------------- */}
      <section className="relative hidden overflow-hidden bg-gradient-to-b from-[#f4f9ff] via-[#eaf3ff] to-[#dbeaff] lg:flex lg:min-h-screen lg:flex-col">
        {/* Decorative shapes anchored to the bottom edge, behind the photo. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
          <span className="absolute -bottom-24 -left-24 size-72 rounded-full bg-[#22c7bf]/85" />
          <span className="absolute -bottom-20 left-36 size-44 rounded-full bg-[#a78bfa]/80" />
          <span className="absolute -bottom-8 left-[52%] size-24 rounded-full bg-[#f6a531]" />
          <span className="absolute -right-20 bottom-8 size-56 rounded-full bg-[#3b82f6]/25" />
          <span className="absolute -top-28 right-4 size-64 rounded-full bg-white/70 blur-2xl" />
        </div>

        <div className="home-hero-copy relative z-10 flex flex-1 flex-col px-10 pt-10 xl:px-16 xl:pt-14">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2.5 text-base font-bold tracking-tight text-slate-900"
          >
            <Image
              src="/carebase-logo.png"
              alt="CareBase"
              width={40}
              height={40}
              className="size-9 rounded-lg object-contain"
              priority
            />
            <span>
              Care<span className="text-[#1260c7]">Base</span>
            </span>
          </Link>

          <div className="mt-14 max-w-[440px]">
            <h1 className="text-[44px] font-bold leading-[1.03] tracking-[-0.03em] text-[#0f2a5c] xl:text-[54px]">
              The Next
              <br />
              Generation
            </h1>
            <p className="mt-1 text-[30px] font-bold leading-tight text-[#2563eb] xl:text-[38px]">
              Of Hospital Care
            </p>
            <p className="mt-5 max-w-[360px] text-sm leading-6 text-slate-600">
              CareBase brings your hospital&apos;s care teams, patients and operations together in one
              connected workspace.
            </p>
          </div>
        </div>

        <div className="relative z-[1] flex justify-center">
          <Image
            src={clinicianPhoto}
            alt="Clinician ready to support your care team"
            width={564}
            height={734}
            sizes="(min-width: 1280px) 40vw, (min-width: 1024px) 36vw, 0px"
            priority
            className="home-hero-image h-auto w-[300px] object-contain object-bottom drop-shadow-[0_24px_45px_rgba(18,96,199,0.25)] xl:w-[370px]"
          />
        </div>
      </section>

      {/* ------------------------- Brand strip (mobile) ------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f4f9ff] to-[#dbeaff] px-6 pb-7 pt-6 lg:hidden">
        <span aria-hidden className="absolute -bottom-16 right-8 size-32 rounded-full bg-[#22c7bf]/80" />
        <span aria-hidden className="absolute -bottom-10 right-32 size-16 rounded-full bg-[#f6a531]" />
        <span aria-hidden className="absolute -bottom-14 right-0 size-20 rounded-full bg-[#a78bfa]/70" />
        <Link href="/" className="relative z-10 inline-flex items-center gap-2 text-sm font-bold">
          <Image
            src="/carebase-logo.png"
            alt="CareBase"
            width={34}
            height={34}
            className="size-8 rounded-lg object-contain"
            priority
          />
          <span>
            Care<span className="text-[#1260c7]">Base</span>
          </span>
        </Link>
        <h1 className="relative z-10 mt-4 max-w-[290px] text-2xl font-bold leading-tight text-[#0f2a5c]">
          The Next Generation of Hospital Care
        </h1>
      </section>

      {/* ------------------------- Form panel ------------------------- */}
      <section className="flex min-h-[calc(100vh-13rem)] items-center justify-center px-6 py-12 sm:px-10 lg:min-h-screen lg:py-16">
        <div className="home-hero-copy w-full max-w-[400px]">{children}</div>
      </section>
    </main>
  );
}
