"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Download, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DepartmentSwitcher } from "./department-switcher";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function CarebaseHeader({
  hospitalName,
  roleName,
  activeDepartmentName,
  activeDepartmentId,
  departments,
  unreadCount,
  permissions,
}: {
  hospitalName: string;
  roleName: string;
  activeDepartmentName: string | null;
  activeDepartmentId: string | null;
  departments: { id: string; name: string }[];
  unreadCount: number;
  permissions: string[];
}) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalledState = () => {
      setIsInstalled(
        standaloneQuery.matches ||
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    };
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    updateInstalledState();
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      toast.info("Open your browser menu and choose Install CareBase to install it on this computer.");
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      toast.error("CareBase could not be installed. Please try again from your browser menu.");
    }
  };

  const mobileLinks = [
    ["Overview", "/hospital", "dashboard.read"],
    ["Patients", "/hospital/patients", "patients.read"],
    ["Appointments", "/hospital/appointments", "appointments.read"],
    ["Staff", "/hospital/staff", "staff.read"],
    ["Beds", "/hospital/beds", "beds.read"],
    ["Diagnostics", "/hospital/diagnostics", "diagnostics.read"],
    ["Payments", "/hospital/payments", "payments.read"],
    ["Reports", "/hospital/reports", "reports.read"],
  ].filter((link) => permissions.includes(link[2]));
  return (
    <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur md:px-8">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">{hospitalName}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900">{activeDepartmentName ?? "Hospital-wide"}</h1>
          <span className="hidden shrink-0 rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 sm:inline">{roleName}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <DepartmentSwitcher departments={departments} activeDepartmentId={activeDepartmentId} />
        {!isInstalled && (
          <button
            type="button"
            onClick={handleInstall}
            aria-label="Install CareBase"
            title="Install CareBase"
            className="flex h-10 items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Install</span>
          </button>
        )}
        <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Menu</summary>
          <div className="absolute right-0 top-12 z-30 min-w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            {mobileLinks.map(([label, href]) => <Link key={href} href={href} className="block rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50">{label}</Link>)}
          </div>
        </details>
        <Link
          href="/hospital/search"
          aria-label="Search"
          className="hidden h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-500 transition hover:border-slate-300 hover:text-slate-800 sm:flex"
        >
          <Search className="size-4" />
          <span>Search records</span>
          <kbd className="ml-8 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
        </Link>
        <Link href="/hospital/notifications" aria-label="Notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="ml-1 border-l border-slate-200 pl-3">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}
