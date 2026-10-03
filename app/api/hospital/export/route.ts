import { NextRequest } from "next/server";
import { getCarebaseContext } from "@/lib/carebase/context";
import { recordCarebaseAudit } from "@/lib/carebase/audit";
import {
  buildExport,
  EXPORT_DATASETS,
  EXPORT_PERMISSIONS,
  type ExportDataset,
  type ExportFilters,
} from "@/lib/carebase/export";

/**
 * Hospital-scoped Excel export.
 *
 * Authorisation runs server-side before a single row is read:
 *   1. the caller must have a CareBase membership,
 *   2. the caller must hold the permission mapped to the dataset,
 *   3. every query is pinned to the caller's hospital (and department scope).
 * The export itself is written to the audit log.
 */
export async function GET(request: NextRequest) {
  const context = await getCarebaseContext();
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const dataset = params.get("dataset") as ExportDataset;

  if (!EXPORT_DATASETS.includes(dataset)) {
    return Response.json({ error: "Unknown export dataset." }, { status: 400 });
  }

  const required = EXPORT_PERMISSIONS[dataset];
  const granted =
    context.role.permissions.includes(required) ||
    context.role.permissions.includes("*");
  if (!granted) {
    return Response.json(
      { error: "You do not have permission to export this data." },
      { status: 403 }
    );
  }

  const value = (key: string) => params.get(key) ?? undefined;
  const filters: ExportFilters = {
    dateFrom: value("dateFrom"),
    dateTo: value("dateTo"),
    departmentId: value("departmentId"),
    memberId: value("memberId"),
    doctorId: value("doctorId"),
    patientId: value("patientId"),
    kind: value("kind"),
    status: value("status"),
    shift: value("shift"),
  };

  try {
    const { fileName, buffer } = await buildExport(dataset, context, filters);

    await recordCarebaseAudit(context, "export.downloaded", "Export", dataset, {
      dataset,
      fileName,
      filters,
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The export could not be generated.";
    return Response.json({ error: message }, { status: 400 });
  }
}
