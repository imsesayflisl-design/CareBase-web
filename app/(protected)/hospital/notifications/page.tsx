import { markNotificationRead } from "@/app/actions/carebase-operations";
import { requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { format } from "date-fns";
import { Activity, Bell, BedDouble, CalendarDays, Check } from "lucide-react";
import Link from "next/link";

const icons: Record<string, typeof Bell> = {
  APPOINTMENT: CalendarDays,
  BED_REQUEST: BedDouble,
  NOTICE: Bell,
  PATIENT: Activity,
  TEST: Activity,
  SCAN: Activity,
};

export default async function NotificationsPage() {
  const context = await requireCarebasePermission("notifications.read");
  const notifications = await db.hospitalNotification.findMany({
    where: {
      hospitalId: context.hospital.id,
      OR: [{ memberId: null }, { memberId: context.membership.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div>
      <PageHeader title="Notifications" description="A live operational feed for the care team." action={<span className="rounded-full bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">{unread} unread</span>} />
      <Panel title="Recent activity" description="Updates for this hospital and your assigned work">
        {notifications.length ? <div className="divide-y divide-slate-100">{notifications.map((notification) => { const Icon = icons[notification.category] ?? Bell; return <article key={notification.id} className={"flex items-start gap-3 py-4 first:pt-0 " + (!notification.readAt ? "rounded-lg bg-cyan-50/40 px-3" : "")}><span className="mt-0.5 rounded-lg bg-white p-2 text-cyan-700 ring-1 ring-slate-200"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-slate-800">{notification.title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{notification.body}</p><p className="mt-2 text-[10px] text-slate-400">{format(notification.createdAt, "MMM d, yyyy · h:mm a")}</p></div>{notification.href && <Link href={notification.href} className="mt-1 text-[10px] font-semibold text-cyan-700">Open</Link>}{!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><button aria-label="Mark as read" className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-cyan-700"><Check className="size-4" /></button></form>}</article>; })}</div> : <EmptyState title="You're all caught up" description="New appointments, bed requests and hospital updates will appear here." />}
      </Panel>
    </div>
  );
}
