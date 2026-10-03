"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BedDouble,
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FileBarChart,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  UserRoundCog,
  UserRoundPlus,
  UserSearch,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  permission: string;
  icon: LucideIcon;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/hospital", permission: "dashboard.read", icon: LayoutDashboard },
      { label: "Patients", href: "/hospital/patients", permission: "patients.read", icon: UserSearch },
      { label: "Appointments", href: "/hospital/appointments", permission: "appointments.read", icon: CalendarDays },
      { label: "Doctors", href: "/hospital/doctors", permission: "staff.read", icon: Stethoscope },
      { label: "Staff & access", href: "/hospital/staff", permission: "staff.read", icon: Users },
      { label: "Bulk import", href: "/hospital/staff/import", permission: "staff.manage", icon: Upload },
      { label: "Departments", href: "/hospital/departments", permission: "departments.read", icon: ClipboardList },
    ],
  },
  {
    label: "Care operations",
    items: [
      { label: "Medical records", href: "/hospital/records", permission: "clinical.read", icon: Activity },
      { label: "Beds & wards", href: "/hospital/beds", permission: "beds.read", icon: BedDouble },
      { label: "Bed requests", href: "/hospital/bed-requests", permission: "beds.read", icon: UserRoundPlus },
      { label: "Diagnostics", href: "/hospital/diagnostics", permission: "diagnostics.read", icon: FlaskConical },
      { label: "Attendance", href: "/hospital/attendance", permission: "attendance.read", icon: ClipboardList },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Payments", href: "/hospital/payments", permission: "payments.read", icon: CreditCard },
      { label: "Reports", href: "/hospital/reports", permission: "reports.read", icon: FileBarChart },
      { label: "Notifications", href: "/hospital/notifications", permission: "notifications.read", icon: Bell },
      { label: "Hospital notices", href: "/hospital/notices", permission: "notices.read", icon: Megaphone },
      { label: "Roles & permissions", href: "/hospital/access", permission: "roles.manage", icon: ShieldCheck },
      { label: "Audit log", href: "/hospital/audit", permission: "audit.read", icon: Activity },
      { label: "Settings", href: "/hospital/settings", permission: "hospital.manage", icon: Settings2 },
    ],
  },
];

export function CarebaseSidebar({
  hospitalName,
  roleName,
  permissions,
}: {
  hospitalName: string;
  roleName: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length);
  const activeHref = visibleGroups
    .flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="hidden h-screen w-[264px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
      <Link href="/hospital" className="flex h-[82px] items-center gap-3 border-b border-slate-100 px-6">
        <Image src="/carebase-logo.png" alt="CareBase" width={52} height={52} className="h-11 w-11 rounded-xl object-contain" priority />
        <span className="text-[19px] font-bold tracking-tight text-slate-900">Care<span className="text-cyan-600">Base</span></span>
      </Link>
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="truncate text-sm font-semibold text-slate-800">{hospitalName}</p>
        <p className="mt-1 text-xs text-slate-500">{roleName}</p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {visibleGroups.map((group) => {
          return (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ label, href, icon: Icon }) => {
                  const active = href === activeHref;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-cyan-50 text-cyan-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("size-[17px]", active ? "text-cyan-700" : "text-slate-400")} />
                      {label}
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-600" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <p className="text-xs font-semibold text-slate-700">CareBase workspace</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">Hospital operations, connected in one place.</p>
        </div>
      </div>
    </aside>
  );
}
