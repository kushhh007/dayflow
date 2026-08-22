# Compatibility Checklist — enforced every audit cycle

Audit cadence: **every ~15 minutes** during active development.
Sources of truth, in order: wireframe workflow → locked spec v4.5 (`docs/DAYFLOW_SPEC_v4.5.md`) → `docs/api.md` contract.
**Everything is frozen except UI styling/component internals.**

Backend (feature/backend) is the reference implementation. Any divergence below = drift that must be fixed by the drifting branch.

## A. All branches must

1. Never invent endpoint paths, request/response shapes, or status codes outside `docs/api.md`.
2. Implement business rules exactly as locked spec v4.5 — especially:
   - EmploymentPeriod as the only employment-history model
   - Integer paise money math (no floats)
   - Guarded atomic transitions (`WHERE status='PENDING'`, verify row count)
   - LEAVE→PRESENT correction permanently prohibited
   - Payroll DRAFT→CALCULATED→FINALIZED two-phase lifecycle; FINALIZED immutable
3. Not modify files owned by another member's area without agreement.
4. Use conventional commits, no force-push, no empty commits.
5. Keep `main` merge-ready: branch → PR → integration-lead review.

## B. Frontend branches additionally

1. Amounts arrive as integer paise → convert to ₹ only at render.
2. Auth responses carry `{ token, user: { id, loginId, role, name, mustChangePassword, employeeId } }`; send `Authorization: Bearer` on every call.
3. Change password requires `currentPassword` + `newPassword` (min 8).
4. Balances include UNPAID with `null` allocation fields.
5. Payslips include `periodStart/periodEnd` from the parent run (for labels) — never compute payroll client-side.

## C. Domain/database branches additionally

1. Schema changes must match spec §11 entities/columns incl. company_id scoping.
2. No second ORM/migration system alongside Prisma in `backend/`.
3. Concurrency rules: row locks or conditional updates, never read-then-write.

## D. Audit log format (posted each cycle)

Per branch: verdict (PASS/WARN/FAIL), new commits since last check, drift found, action taken, owner of fix.
