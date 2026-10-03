# Phase 15 — Department-level isolation & controlled department context

Implements the specification's foundational requirement (§5, §8, §26): staff are
scoped to the **hospital *and* the department they belong to**, and the active
department is always visible with a controlled selector.

Before this phase the context resolved only the hospital (`Current User →
Hospital → Permissions → Data`). Department membership (`DepartmentMember`) was
stored but never used for authorization. That gap is now closed.

## What was added

| Area | File |
| --- | --- |
| Department scope helpers | `lib/carebase/departments.ts` |
| Context now resolves departments + active department | `lib/carebase/context.ts` |
| Server action to switch active department (validated) | `app/actions/carebase-context.ts` |
| Controlled department selector | `components/carebase/department-switcher.tsx` |
| Header shows hospital + department + role | `components/carebase/header.tsx` |
| Layout passes department context | `app/(protected)/hospital/layout.tsx` |
| Queries scoped by department | `app/(protected)/hospital/appointments/page.tsx`, `app/(protected)/hospital/page.tsx` |

## How isolation works

```text
Current User → Hospital → Department → Permissions → Data
```

`lib/carebase/departments.ts` exports:

- `isHospitalWide(context)` — true for `OWNER` / `ADMIN` (or a `*` permission).
- `departmentScope(context)` — a Prisma filter fragment:
  - hospital-wide roles → `{}` (whole hospital),
  - members with no department → `{}` (governed by their role scope),
  - department-bound members → `{ departmentId: { in: [...] } }`.

Because the filter is derived from the **authenticated session**, a member can
never widen it by editing a URL or an id.

## Active department

`getCarebaseContext()` loads the member's `DepartmentMember` rows for their
hospital and resolves the active department from the `carebase-department`
cookie, falling back to their first department. The owner/administrator has no
department membership, so they operate **hospital-wide**.

`setActiveDepartment()` re-reads the session and verifies the requested
department (a) exists in the member's hospital, (b) is `ACTIVE`, and (c) the
member is actually assigned to it — otherwise it throws. There is **no hospital
switcher**: staff can only ever operate inside a hospital they belong to.

## UI

The header now reads `Hospital name → Department (or "Hospital-wide") → role`.
When a member belongs to more than one department the controlled
`DepartmentSwitcher` is rendered; with a single department the name is shown as
plain context and no selector appears.

## Verify

1. Sign in as an owner/admin → header shows `Hospital-wide`, no switcher.
2. Invite a receptionist and assign them to Pediatrics → header shows
   `Pediatrics`; the appointments list and dashboard counts contain only
   Pediatrics appointments.
3. Assign the same member to a second department → the switcher appears and
   changing it re-scopes the workspace.

## Still to adopt `departmentScope()`

The helper is reusable. The remaining departmental modules should apply it as
they are built: diagnostics/laboratory, scans, pharmacy, queue and reports.