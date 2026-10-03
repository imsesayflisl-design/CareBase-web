import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import type { Department, HospitalMember, HospitalRole, Hospital, Prisma } from "@prisma/client";
import type { CarebasePermission } from "./permissions";

export type CarebaseContext = {
  userId: string;
  membership: HospitalMember;
  role: HospitalRole;
  hospital: Hospital;
  /** Active departments this member belongs to (department-level isolation). */
  departments: Department[];
  /** Department the member is currently working in, or null for hospital-wide. */
  activeDepartment: Department | null;
};

export async function getCarebaseContext(): Promise<CarebaseContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const cookieStore = await cookies();
  const selectedHospitalId = cookieStore.get("carebase-hospital")?.value;
  const where: Prisma.HospitalMemberWhereInput = {
      userId,
      status: "ACTIVE",
      hospital: { status: "ACTIVE" },
    };
  const membership =
    (selectedHospitalId
      ? await db.hospitalMember.findFirst({
          where: { ...where, hospitalId: selectedHospitalId },
          include: { hospital: true, role: true },
        })
      : null) ??
    (await db.hospitalMember.findFirst({
      where,
      include: { hospital: true, role: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!membership) return null;

  // Department memberships for this member, resolved inside their own hospital.
  const departmentMemberships = await db.departmentMember.findMany({
    where: {
      hospitalId: membership.hospitalId,
      memberId: membership.id,
      department: { status: "ACTIVE" },
    },
    include: { department: true },
    orderBy: { department: { name: "asc" } },
  });
  const departments = departmentMemberships.map((item) => item.department);
  const selectedDepartmentId = cookieStore.get("carebase-department")?.value;
  const activeDepartment =
    departments.find((department) => department.id === selectedDepartmentId) ??
    departments[0] ??
    null;

  return {
    userId,
    membership,
    role: membership.role,
    hospital: membership.hospital,
    departments,
    activeDepartment,
  };
}

export async function requireCarebaseContext() {
  const context = await getCarebaseContext();
  if (!context) redirect("/setup");
  return context;
}

export async function requireCarebasePermission(permission: CarebasePermission) {
  const context = await requireCarebaseContext();
  if (!context.role.permissions.includes(permission) && !context.role.permissions.includes("*")) {
    throw new Error("You do not have permission to perform this action.");
  }
  return context;
}

export async function canAccess(permission: CarebasePermission) {
  const context = await getCarebaseContext();
  return Boolean(
    context &&
      (context.role.permissions.includes(permission) ||
        context.role.permissions.includes("*"))
  );
}
