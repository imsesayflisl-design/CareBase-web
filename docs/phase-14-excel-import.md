# Phase 14 — Excel Import (Bulk staff management)

Implements the roadmap's Phase 14: download template → upload Excel → validation →
preview → error reporting → import confirmation → import history.

## What was added

| Area | File |
| --- | --- |
| Spreadsheet reader (`.xlsx` + `.csv`/`.tsv`) | `lib/carebase/spreadsheet.ts` |
| Template, column mapping and row validation | `lib/carebase/staff-import.ts` |
| Server actions (preview / confirm / discard) | `app/actions/carebase-import.ts` |
| Template download API | `app/api/hospital/staff/import-template/route.ts` |
| Page + client workbench | `app/(protected)/hospital/staff/import/` |
| Prisma model + migration | `prisma/schema.prisma`, `prisma/migrations/20261002000000_carebase_staff_import/` |
| Sidebar entry | `components/carebase/sidebar.tsx` |

## Apply the database change

The environment used to build this had no network access to the database, so the
migration is written but **not yet applied**. Run one of:

```bash
npx prisma migrate deploy   # apply the committed migration
```

The hand-written migration was verified to match Prisma's own generated SQL, so
`prisma migrate dev` will not detect any drift.

## How it works

1. **Template** — `GET /api/hospital/staff/import-template` returns a UTF-8 CSV
   (BOM + `\r\n`) that opens cleanly in Excel.
2. **Upload + validate** — the file is read server-side by
   `lib/carebase/spreadsheet.ts`. `.xlsx` is parsed directly (ZIP + shared
   strings + worksheet XML) with no third-party dependency; `.csv`/`.tsv` use an
   RFC-4180 style reader. Rows are mapped by header aliases
   (`Work email` → `Email`, `Dept` → `Department`, …) and validated:
   required name/email/role, email format, in-file duplicate emails, role must
   exist in *this* hospital, department must exist in *this* hospital.
   Rows whose email is already a team member are reported as **skipped**.
   Limits: 5 MB, 5000 sheet rows, 500 imported rows per batch.
3. **Preview** — every row is returned with its spreadsheet row number and a
   `valid` / `warning` / `error` status plus messages. Valid rows are staged in a
   `StaffImportBatch` with status `REVIEW`. Nothing is committed yet.
4. **Confirm** — for each staged row a `StaffInvitation` is created (7-day
   expiry, hashed token) and a Clerk invitation is emailed. This deliberately
   reuses the same activation flow as a single invite, so a `HospitalMember` is
   only created after the person authenticates and accepts. Failures are
   collected per row (never thrown mid-batch) and the batch becomes `COMPLETED`
   or `FAILED`.
5. **History** — the last 20 batches are listed with counts; a `REVIEW` batch can
   be discarded.

## Security / Definition of Done

- Authentication via `requireCarebasePermission("staff.manage")` (Clerk session).
- Authorization enforced **server-side**; the template route returns 403 without
  the permission and 401 without a session.
- Tenant isolation: every query is scoped by `hospitalId`; roles and departments
  are validated against the same hospital before an invitation is created.
- Audit logging: `staff.import_previewed`, `staff.import_completed`,
  `staff.import_discarded`.
- Realtime/notifications: `staff.imported` event + hospital notification on success.
- Loading / empty / error states: pending spinners, empty states for history and
  for "no importable rows", per-row and per-batch error reporting, plus a
  hospital-level `error.tsx` and `loading.tsx`.