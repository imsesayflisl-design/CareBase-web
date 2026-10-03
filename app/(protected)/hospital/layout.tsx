import { CarebaseHeader } from "@/components/carebase/header";
import { CarebaseSidebar } from "@/components/carebase/sidebar";
import { CarebaseRealtimeRefresh } from "@/components/carebase/realtime-refresh";
import { requireCarebaseContext } from "@/lib/carebase/context";
import db from "@/lib/db";

export default async function HospitalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireCarebaseContext();
  const unreadCount = await db.hospitalNotification.count({
    where: {
      hospitalId: context.hospital.id,
      readAt: null,
      OR: [{ memberId: null }, { memberId: context.membership.id }],
    },
  });

  return (
    <div className="flex min-h-screen bg-[#f6f8fb]">
      <CarebaseSidebar
        hospitalName={context.hospital.name}
        roleName={context.role.name}
        permissions={context.role.permissions}
      />
      <div className="min-w-0 flex-1">
        <CarebaseRealtimeRefresh />
        <CarebaseHeader
          hospitalName={context.hospital.name}
          roleName={context.role.name}
          activeDepartmentName={context.activeDepartment?.name ?? null}
          activeDepartmentId={context.activeDepartment?.id ?? null}
          departments={context.departments.map((department) => ({ id: department.id, name: department.name }))}
          unreadCount={unreadCount}
          permissions={context.role.permissions}
        />
        <main className="mx-auto w-full max-w-[1600px] px-5 py-7 md:px-8 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
