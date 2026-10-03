import { auth } from "@clerk/nextjs/server";
import { getCarebaseContext } from "@/lib/carebase/context";
import { PublicHome } from "@/components/public-home";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId, sessionClaims } = await auth();
  if (userId) {
    const context = await getCarebaseContext();
    if (context) redirect("/hospital");
    if (sessionClaims?.metadata?.role?.toLowerCase() === "patient") redirect("/patient");
    redirect("/setup");
  }

  return <PublicHome />;
}
