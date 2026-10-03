import { Download } from "lucide-react";
import type { ExportDataset } from "@/lib/carebase/export";

type Option = { id: string; name: string };

/**
 * Filtered Excel download form.
 *
 * Submits a GET to `/api/hospital/export`, so the browser downloads the
 * `.xlsx` (the response is sent as an attachment) without leaving the page.
 * Only the filters relevant to a dataset are rendered.
 */
export function ExportMenu({
  dataset,
  departments,
  staff,
  patients,
  statuses,
  kinds = false,
  shifts = false,
  label = "Export Excel",
  defaultDepartmentId,
}: {
  dataset: ExportDataset;
  departments?: Option[];
  staff?: Option[];
  patients?: Option[];
  statuses?: { value: string; label: string }[];
  kinds?: boolean;
  shifts?: boolean;
  label?: string;
  defaultDepartmentId?: string;
}) {
  const inputClass =
    "h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-cyan-500";

  return (
    <details className="group relative">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-800">
        <Download className="size-4 text-cyan-700" />
        {label}
      </summary>

      <form
        method="get"
        action="/api/hospital/export"
        target="_blank"
        className="absolute right-0 z-30 mt-2 w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
      >
        <input type="hidden" name="dataset" value={dataset} />
        <p className="mb-3 text-xs font-semibold text-slate-800">
          Download <span className="text-cyan-700">.xlsx</span> for {dataset}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[11px] text-slate-500">
            From
            <input type="date" name="dateFrom" className={inputClass} />
          </label>
          <label className="block text-[11px] text-slate-500">
            To
            <input type="date" name="dateTo" className={inputClass} />
          </label>
        </div>

        {departments && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Department
            <select name="departmentId" className={inputClass} defaultValue={defaultDepartmentId ?? ""}>
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {staff && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Staff member
            <select name="memberId" className={inputClass} defaultValue="">
              <option value="">All staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {patients && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Patient
            <select name="patientId" className={inputClass} defaultValue="">
              <option value="">All patients</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {kinds && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Test / scan type
            <select name="kind" className={inputClass} defaultValue="">
              <option value="">All types</option>
              <option value="TEST">Laboratory test</option>
              <option value="SCAN">Scan / imaging</option>
            </select>
          </label>
        )}

        {statuses && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Status
            <select name="status" className={inputClass} defaultValue="">
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {shifts && (
          <label className="mt-2 block text-[11px] text-slate-500">
            Shift
            <select name="shift" className={inputClass} defaultValue="">
              <option value="">All shifts</option>
              <option value="MORNING">Morning</option>
              <option value="EVENING">Evening</option>
            </select>
          </label>
        )}

        <button className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 text-xs font-semibold text-white transition hover:bg-cyan-800">
          <Download className="size-4" />
          Download workbook
        </button>
        <p className="mt-2 text-[10px] leading-4 text-slate-400">
          Your hospital name and the export date are written into the file.
        </p>
      </form>
    </details>
  );
}
