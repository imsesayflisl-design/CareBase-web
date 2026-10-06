import { NurseOnboardingForm } from "@/components/carebase/nurse-onboarding-form";
import { InviteShell, InviteStatus } from "@/components/carebase/invite-shell";
import { getCarebaseContext } from "@/lib/carebase/context";
import { logInviteFailure } from "@/lib/carebase/invites";
import db from "@/lib/db";
import { AlertTriangle, Stethoscope } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Invite flow option 2: after the doctor finishes password setup they land
 * here to select an existing nurse or invite a new one by email. Skipping is
 * always allowed, so a missing/failed nurse invite never blocks onboarding.
 *
 * Protected: validates session + active hospital membership + DOCTOR role
 * before rendering, and redirects anyone already paired to their dashboard.
 */
export default async function NurseOnboardingPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in?redirect_url=" + encodeURIComponent("/onboarding/nurse"));
  }

  let data: {
    nurses: { id: string; fullName: string; email: string }[];
    hospitalName: string;
    roleName: string;
    activeDepartmentName: string | null;
    target: string;
    isDoctor: boolean;
    alreadyPaired: boolean;
    memberEmail: string;
  } | null = null;
  let loadFailed = false;

  try {
    const context = await getCarebaseContext();
    if (context) {
      const target = context.activeDepartment
        ? `/hospital/departments/${context.activeDepartment.id}`
        : "/hospital";
      let alreadyPaired = false;
      if (context.role.name === "DOCTOR") {
        const doctorProfile = await db.doctorProfile.findFirst({
          where: { hospitalId: context.hospital.id, memberId: context.membership.id },
          select: { id: true },
        });
        if (doctorProfile) {
          const assignment = await db.nurseDoctorAssignment.findFirst({
            where: { doctorId: doctorProfile.id },
            select: { id: true },
          });
          alreadyPaired = Boolean(assignment);
        }
      }
      const nurses =
        context.role.name === "DOCTOR" && !alreadyPaired
          ? await db.hospitalMember.findMany({
              where: {
                hospitalId: context.hospital.id,
                status: "ACTIVE",
                role: { name: "NURSE" },
              },
              select: { id: true, fullName: true, email: true },
              orderBy: { fullName: "asc" },
            })
          : [];
      data = {
        nurses,
        hospitalName: context.hospital.name,
        roleName: context.role.name,
        activeDepartmentName: context.activeDepartment?.name ?? null,
        target,
        isDoctor: context.role.name === "DOCTOR",
        alreadyPaired,
        memberEmail: context.membership.email,
      };
    }
  } catch (error) {
    loadFailed = true;
    logInviteFailure("nurse-onboarding-load", error, { userId });
  }

  if (loadFailed) {
    return (
      <InviteShell>
        <InviteStatus
          tone="danger"
          icon={<AlertTriangle className="size-6" />}
          title="We couldn't load onboarding"
          body="Something went wrong on our side — nothing was lost. Refresh the page or try again in a moment."
        />
        <Link
          href="/onboarding/nurse"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-cyan-700 text-sm font-semibold text-white hover:bg-cyan-800"
        >
          Try again
        </Link>
      </InviteShell>
    );
  }

  if (!data) redirect("/setup");
  // Role-based access: only DOCTORs pass through, and only until they have a nurse.
  if (!data.isDoctor || data.alreadyPaired) redirect(data.target);

  return (
    <InviteShell>
      <InviteStatus
        tone="info"
        icon={<Stethoscope className="size-6" />}
        title="Connect your nurse"
        body={`Choose the nurse you'll work with in ${data.activeDepartmentName ?? data.hospitalName}. You can pick someone already on the team, send an invite to a new nurse, or skip and do this later.`}
      />
      <NurseOnboardingForm
        nurses={data.nurses}
        fallbackTarget={data.target}
        doctorEmail={data.memberEmail}
      />
    </InviteShell>
  );
}
