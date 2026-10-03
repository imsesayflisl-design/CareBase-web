import { discardStaffImport } from "@/app/actions/carebase-import";
import { requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Panel } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { STAFF_IMPORT_COLUMNS, buildStaffImportExampleRow } from "@/lib/carebase/staff-import";
import { format } from "date-fns";
import { FileSpreadsheet, History } from "lucide-react";
import { StaffImportWorkbench } from "./import-client";

export default async function StaffImportPage() {
  const context = await requireCarebasePermission("staff.manage");
  const [roles, departments, batches] = await Promise.all([
    db.hospitalRole.findMany({
      where: { hospitalId: context.hospital.id },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { hospitalId: context.hospital.id, status: "ACTIVE" },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    db.staffImportBatch.findMany({
      where: { hospitalId: context.hospital.id },
      include: { createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const exampleRole = roles.find((role) => role.name === "NURSE")?.name ?? roles[0]?.name ?? "NURSE";
  const exampleDepartment = departments[0]?.name ?? "General";
  const exampleRow = buildStaffImportExampleRow(exampleRole, exampleDepartment);

  return (
    <div>
      <PageHeader
        title="Bulk staff import"
        description="Onboard a whole team at once. Download the template, upload an Excel or CSV file, review every row, then send secure invitations."
        action={<div className="flex items-center gap-2 text-xs text-slate-500"><FileSpreadsheet className="size-4 text-cyan-700" /> Excel import</div>}
      />

      <StaffImportWorkbench
        columns={[...STAFF_IMPORT_COLUMNS]}
        exampleRow={exampleRow}
        templateHref="/api/hospital/staff/import-template"
      />

      <div className="mt-5">
        <Panel
          title="Import history"
          description="Every bulk import for this hospital, with validation results and invitation counts."
        >
          {batches.length ? (
            <div className="divide-y divide-slate-100">
              {batches.map((batch) => (
                <div key={batch.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700"><History className="size-4" /></span>
                  <div className="min-w-52 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{batch.fileName}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      {format(batch.createdAt, "MMM d, yyyy · h:mm a")}
                      {batch.createdBy ? " · " + batch.createdBy.fullName : ""}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {batch.totalRows} rows · {batch.validRows} ready · {batch.invalidRows} errors · {batch.skippedRows} skipped
                      {batch.importedRows ? " · " + batch.importedRows + " invited" : ""}
                    </p>
                  </div>
                  <StatusBadge status={batch.status} />
                  {batch.status === "REVIEW" && (
                    <form action={discardStaffImport}>
                      <input type="hidden" name="batchId" value={batch.id} />
                      <button className="text-[10px] font-semibold text-rose-600 hover:text-rose-800">Discard</button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No imports yet"
              description="Your first bulk import will appear here with its validation results and invitation counts."
            />
          )}
        </Panel>
      </div>
    </div>
  );
}