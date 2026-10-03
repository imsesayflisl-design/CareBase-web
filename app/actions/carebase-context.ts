"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { getCarebaseContext } from "@/lib/carebase/context";

/**
 * Sets the active department for the signed-in member.
 *
 * The requested department must belong to the member's hospital AND the member
 * must actually be a member of that department, so a staff member can never
 * switch into a department they were not assigned to.
 */
export async function setActiveDepartment(formData: FormData) {
  const context = await getCarebaseContext();
  if (!context) throw new Error("Sign in to change the active department.");

  const departmentId = String(formData.get("departmentId") ?? "").trim();
  const cookieStore = await cookies();

  if (!departmentId) {
    cookieStore.delete("carebase-department");
    revalidatePath("/hospital");
    return;
  }

  const membership = await db.departmentMember.findFirst({
    where: {
      hospitalId: context.hospital.id,
      memberId: context.membership.id,
      departmentId,
      department: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!membership) throw new Error("You are not assigned to that department.");

  cookieStore.set("carebase-department", departmentId, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/hospital");
}