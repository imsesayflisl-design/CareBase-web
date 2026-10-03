# Phase 16 — Department Management, Tests & Scans, Attendance & Excel Export

Implements the four-module update: **Department Management**, **Tests & Scans**,
**Staff Attendance** and **Excel Export** — all inside CareBase's existing
hospital + department isolation.

## 1. Department Management (§1)

| Piece | File |
| --- | --- |
| 32 standard departments + diagnostic/service presets | `lib/carebase/presets.ts` (client-safe) |
| Preset re-exports for server code | `lib/carebase/departments.ts` |
| Select-or-type picker ("+ Custom department…") | `components/carebase/department-picker.tsx` |
| Create form now uses the picker | `app/(protected)/hospital/departments/page.tsx` |
| **Per-department dashboard** | `app/(protected)/hospital/departments/[id]/page.tsx` |

`DEPARTMENT_PRESETS` contains the 32 requested departments (Emergency / OPD,
Pediatrics, Radiology / Imaging, Laboratory, Pharmacy, ICU, Blood Bank,
Mortuary, …). Choosing **"Custom department…"** reveals a free-text name field,
so authorised users can always create a department that is not on the list.

The department dashboard shows only that department's patients, staff,
appointments, tests & scans and attendance. The id is resolved against **both**
the hospital and the caller's department scope, so a department-bound member
gets a 404 for any other department.

## 2. Tests & Scans (§2)

- Service form: department `SelectField` **or** a typed `departmentName`
  (`resolveDepartmentId` creates it in-hospital and audits it).
- Service name suggestions via `<datalist>` fed by `DIAGNOSTIC_SERVICE_PRESETS`
  (CBC, Glucose, Urinalysis, X-Ray, Ultrasound, CT, MRI, ECG …).
- Orders are now **department-scoped**: `service: { departmentId: { in: … } }`
  for department-bound staff.
- **Complete history** panel reads the immutable `AuditEvent` trail for
  `DiagnosticOrder` (created / status changes / who).
- Statuses: Pending → Scheduled → In progress → Completed / Cancelled, with
  result entry and `completedBy` (the staff member who entered the result).

## 3. Staff Attendance (§3)

- `AttendanceStatus` gains **`LATE`** (schema + migration).
- `StaffAttendance` gains `departmentId`, `createdByMemberId`,
  `updatedByMemberId` — who recorded and who modified each entry.
- The record form adds **Department (select) / "Or type a new department"** and
  the **Late** status.
- Filters: **date, daily/weekly/monthly view, department, staff member, shift**.
- The table now shows Date, Department and Original/Modified, so history stays
  traceable.
- Writes remain gated by `requireCarebasePermission("attendance.manage")`, so
  staff without that permission cannot create or change attendance.

## 4. Excel Export (§4–§6)

| Piece | File |
| --- | --- |
| Dependency-free `.xlsx` writer (zip + SpreadsheetML) | `lib/carebase/xlsx.ts` |
| Dataset builders + filters | `lib/carebase/export.ts` |
| Auth + permission + audit + download | `app/api/hospital/export/route.ts` |
| Filtered download UI | `components/carebase/export-button.tsx` |

**Datasets:** `patients`, `staff`, `attendance`, `diagnostics`, `hospital`
(7 sheets: Departments, Staff, Patients, Appointments, Tests & scans, Beds,
Attendance) and `department` (all-departments or one department).

**Filters (§5):** `dateFrom`/`dateTo`, `departmentId`, `memberId`, `doctorId`,
`patientId`, `kind` (test/scan), `status` (attendance), `shift`.

Every sheet carries the **hospital name, export title and export date** in bold
rows above a styled column header.

**Security (§6):** the route returns **401** without a CareBase membership and
**403** without the dataset's mapped permission (`EXPORT_PERMISSIONS`); every
query is pinned to `context.hospital.id` plus `departmentScope(context)`, and
`resolveExportDepartment()` refuses a department outside the caller's own scope.
Each download is written to the audit log as `export.downloaded`.

Menus are wired into: Patients, Staff & access, Attendance, Tests & scans,
Departments, the department dashboard and Reports (hospital records).

## Apply the database change

```bash
npx prisma migrate deploy
npx prisma generate
```

The migration `20261003000000_carebase_department_tests_export` was verified to
match `prisma migrate diff --from-empty --to-schema-datamodel` exactly (enum
value, columns and index names), so `migrate dev` will not detect drift.

## Verification

- `npm run build` → exit 0 (full type-check).
- `npx prisma validate` → schema valid.
- Dev server: `/sign-in` 200; hospital routes 307 without a session;
  `/api/hospital/export` returns **401** with no session (authorisation is
  server-side).
- `buildXlsx` output validated with Python `zipfile` + XML parsing: valid ZIP
  integrity, well-formed XML in all parts, correct cell refs and entity escaping
  for single- and multi-sheet workbooks.
