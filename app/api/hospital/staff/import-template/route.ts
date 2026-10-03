import { NextResponse } from "next/server";
import { getCarebaseContext } from "@/lib/carebase/context";
import { buildStaffImportTemplateCsv } from "@/lib/carebase/staff-import";

export async function GET() {
  const context = await getCarebaseContext();
  if (!context) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (
    !context.role.permissions.includes("staff.manage") &&
    !context.role.permissions.includes("*")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const content = "\uFEFF" + buildStaffImportTemplateCsv() + "\r\n";
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="carebase-staff-import-template.csv"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}