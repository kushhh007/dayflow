# Dayflow API Contract v1

Status: **agreed baseline** — backend implements this; frontend integrates against this.
Change process: frontend documents a needed endpoint here first → backend reviews → backend implements → frontend integrates. Frontend must not invent different names/shapes.

## Conventions

| Topic | Rule |
|---|---|
| Base path | `/api` |
| Auth | `Authorization: Bearer <JWT>` (except login/health) |
| JWT payload | `{ sub: userId, companyId, role: ADMIN\|EMPLOYEE, tv: tokenVersion }` |
| Money | **integer paise** everywhere (`wagePaise`, `grossPaise`, …). ₹1 = 100 paise |
| Dates | `yyyy-mm-dd` (company timezone `Asia/Kolkata` governs business dates) |
| Timestamps | ISO 8601 UTC |
| Error shape | `{ "error": "human message" }` (+ `details?: []` where useful) |
| Pagination | `?limit=&offset=` → responses carry `meta: { total, limit, offset }` |
| Roles | `ADMIN` / `EMPLOYEE`; every endpoint lists allowed roles |

---

## AUTH

### POST /api/auth/login — public
Request `{ "loginId": "OIJODO20260001", "password": "string" }`
Response 200 `{ "token": "...", "user": { "id", "loginId", "role", "mustChangePassword", "employee": { "id", "firstName", "lastName", "status" } } }`
Errors: `401` invalid credentials · `403` employee INACTIVE (account exists, login denied)

### POST /api/auth/change-password — ADMIN, EMPLOYEE
Request `{ "currentPassword": "string", "newPassword": "string" }` (min 8 chars)
Response 200 `{ "ok": true }` — clears `mustChangePassword`
Errors: `400` policy violation · `401` wrong current password

### POST /api/auth/logout — ADMIN, EMPLOYEE
Stateless JWT; client discards token. Response `204`.

> Password reset by Admin (below) bumps `tokenVersion` → all existing JWTs fail with `401`.

---

## EMPLOYEES

### GET /api/departments — ADMIN
Seeded list (no CRUD in MVP). Response 200 `{ "departments": [{ "id", "name" }] }`

### GET /api/job-positions — ADMIN
Response 200 `{ "jobPositions": [{ "id", "title" }] }`

### POST /api/employees — ADMIN
Creates employee + User account atomically. Login ID auto-generated `[initials][fn2][ln2][joinYear][serial]`, serial retries on unique collision. Temporary password returned **once**, stored hashed only.
Request `{ "firstName", "lastName", "phone?", "personalEmail?", "dateOfBirth?", "gender?", "maritalStatus?", "nationality?", "address?", "bankAccountNo?", "bankName?", "ifscCode?", "pan?", "uan?", "departmentId", "jobPositionId", "managerId?", "joinDate": "yyyy-mm-dd", "wagePaise?", "standardAllowancePaise?" }`
Response 201 `{ "employee": { "id", "loginId", ... }, "credentials": { "temporaryPassword": "shown-once" } }`
Errors: `400` validation · `409` login-id generation failed after retries

### GET /api/employees — ADMIN, EMPLOYEE
Query `?status=ACTIVE|INACTIVE&departmentId=&q=&limit=&offset=`
ADMIN → full profile rows. EMPLOYEE → restricted projection: `{ id, firstName, lastName, phone, department, jobPosition, status }` (per spec §7).
Response 200 `{ "employees": [...], "meta": {...} }`

### GET /api/employees/:id — ADMIN, EMPLOYEE
Field access enforced server-side (spec §7):
- own profile → general + private info (DOB, address, personal email, bank, PAN, UAN)
- other employee (as EMPLOYEE) → name/phone/department/jobPosition/status only → `403` fields beyond that
- ADMIN → everything incl. `salaryStructure`

Response 200 `{ "employee": { ...role-scoped... } }` · Errors: `404`

### PATCH /api/employees/:id — ADMIN, EMPLOYEE (self, limited)
EMPLOYEE may edit ONLY: `phone`, `personalEmail`, `address`, `profilePictureUrl`.
Everything else is Admin-edit-only.
Errors: `403` non-editable field as employee · `400` validation · `404`

Every profile change writes an AuditLog entry.

### POST /api/employees/:id/status — ADMIN
Transitions employment state via the authoritative **EmploymentPeriod** model.
Request `{ "status": "INACTIVE"|"ACTIVE", "employmentEndDate": "yyyy-mm-dd"? }`
- `ACTIVE → INACTIVE`: `employmentEndDate` required (defaults today if omitted); closes open EmploymentPeriod in same transaction; rejects dates before `joinDate`
- `INACTIVE → ACTIVE`: opens a NEW EmploymentPeriod from reactivation date; previous end dates are NEVER erased; clears `employmentEndDate`
Response 200 `{ "employee": {...}, "employmentPeriod": {...} }`
Errors: `400` bad date / invalid transition · `404`

### POST /api/employees/:id/reset-password — ADMIN
Generates new temporary password (shown once), bumps `tokenVersion` (kills sessions).
Response 200 `{ "credentials": { "temporaryPassword": "shown-once" } }` · Errors: `404`

---

## SALARY STRUCTURE — ADMIN

### PUT /api/employees/:id/salary
Upserts (UNIQUE per employee). Server derives and validates:
`Basic = round(50% wage)` · `HRA = round(50% Basic)` · `PerformanceBonus = round(8.33% Basic)` · `LTA = round(8.33% Basic)` · `FixedAllowance = wage − sum(others)` — **must be ≥ 0**
Request `{ "wagePaise": int, "standardAllowancePaise": int }`
Response 200 `{ "salaryStructure": { "wagePaise", "standardAllowancePaise", "derived": { "basicPaise", "hraPaise", "performanceBonusPaise", "ltaPaise", "fixedAllowancePaise" } } }`
Errors: `422` Fixed Allowance would be negative · `400` · `404`
Changes apply to next unfinalized run only. Salary changes are audit-logged.

---

## ATTENDANCE

### POST /api/attendance/check-in — ADMIN, EMPLOYEE (acts on self)
Rules: Monday–Friday only; timestamps within **06:00–22:00 company local**; one record per day; employee must be ACTIVE.
Response 201 `{ "attendance": { "id", "workDate", "status": "PRESENT", "checkIn" } }`
Errors: `400` weekend/outside window · `409` already checked in today · `403` INACTIVE employee

### POST /api/attendance/check-out — ADMIN, EMPLOYEE (self)
Sets `checkOut` on today's record. Response 200 `{ "attendance": {...} }`
Errors: `400` no check-in / checkout ≤ checkin · `409` already checked out

### GET /api/attendance — ADMIN, EMPLOYEE
EMPLOYEE: own records. Query `?from&to` (default current month). ADMIN: `?date=&employeeId=&status=`
Response 200 `{ "attendance": [...], "meta": {...} }`

### POST /api/attendance/corrections — ADMIN, EMPLOYEE (self)
Submit correction request. Max **one PENDING per employee+date**.
Request `{ "workDate": "yyyy-mm-dd", "requestedCheckIn": "ISO", "requestedCheckOut": "ISO", "reason": "string" }`
Response 201 `{ "correction": {...} }`
Errors: `400` checkout ≤ checkin / outside window · `409` pending request exists for this date

Allowed transitions on approval: `ABSENT→PRESENT`, `ABSENT→HALF_DAY`, `PRESENT→corrected PRESENT`, `HALF_DAY→corrected HALF_DAY/PRESENT`. **`LEAVE→PRESENT` permanently prohibited.**

### GET /api/attendance/corrections — ADMIN (all, `?status=PENDING`), EMPLOYEE (own)
Response 200 `{ "corrections": [...], "meta" }`

### POST /api/attendance/corrections/:id/approve — ADMIN
Guarded atomic transaction: `PENDING→APPROVED` (verify 1 row), validate transition + times, apply to Attendance, AuditLog, notification.
Response 200 `{ "correction": {...}, "note": "payroll-finalized notice if applicable" }`
Errors: `404` · `409` already decided (concurrent guard) · `422` prohibited transition (`LEAVE→PRESENT`)

### POST /api/attendance/corrections/:id/reject — ADMIN
Guarded `PENDING→REJECTED`. Response 200. Errors: `409` already decided.

> Correction touching a date inside a FINALIZED run is allowed but audit-logged and does NOT change the payslip.

---

## LEAVE

### GET /api/leave/types — ADMIN, EMPLOYEE
Response 200 `{ "types": [{ "code": "PAID|SICK|UNPAID", "requiresAllocation", "requiresAttachment" }] }`

### GET /api/leave/balances — ADMIN, EMPLOYEE
EMPLOYEE: own. ADMIN: `?employeeId=&year=`
`Available = Allocated − ApprovedOrUsed` (Unpaid has no allocation).
Response 200 `{ "balances": [{ "type": "PAID", "year", "allocatedDays", "approvedOrUsedDays", "availableDays" }] }`

### POST /api/leave/requests — ADMIN, EMPLOYEE (self)
Full-day requests only. Leave year = calendar year; **cross-year requests rejected**. Weekends count toward leave days.
Request `{ "typeCode": "PAID|SICK|UNPAID", "startDate": "yyyy-mm-dd", "endDate": "yyyy-mm-dd", "reason": "string", "attachmentUrl"? }`
SICK requires `attachmentUrl`.
Overlap vs PENDING/APPROVED requests checked atomically.
Response 201 `{ "request": { ..., "totalDays": n } }`
Errors: `400` cross-year / missing attachment / bad range · `409` overlapping request · `403` INACTIVE employee

### GET /api/leave/requests — ADMIN (all, `?status=&employeeId=`), EMPLOYEE (own)
Response 200 `{ "requests": [...], "meta" }`

### POST /api/leave/requests/:id/cancel — ADMIN, EMPLOYEE (owner)
Only while `PENDING` (no side effects — pending consumed nothing).
Response 200 `{ "request": {...} }` · Errors: `403` APPROVED is terminal · `409` not pending

### POST /api/leave/requests/:id/approve — ADMIN (not own request)
One database transaction, all-or-nothing:
1. Guarded flip `PENDING→APPROVED` (verify exactly 1 row)
2. Atomic balance increment (`WHERE used + days <= allocated` → else rollback)
3. Reject if any requested date falls after employee's `employmentEndDate`
4. Reject if conflicting PRESENT/HALF_DAY attendance exists on a requested date
5. Create/update Attendance `LEAVE` for each Mon–Fri requested date (weekends skipped)
6. Notification + AuditLog
Response 200 `{ "request": {...} }`
Errors: `409` insufficient balance / attendance conflict / concurrent decision · `422` post-departure date · `403` Admin approving own request (needs a different Admin; stays PENDING otherwise)

### POST /api/leave/requests/:id/reject — ADMIN (not own)
Guarded `PENDING→REJECTED` + notification + AuditLog, then runs **absence reconciliation**: past covered dates with no attendance and no other approved/pending leave become `ABSENT` immediately.
Response 200 `{ "request": {...} }` · Errors: `409` concurrent decision

---

## PAYROLL — ADMIN

### POST /api/payroll/runs
Request `{ "periodStart": "yyyy-mm-dd", "periodEnd": "yyyy-mm-dd" }` (`periodStart ≤ periodEnd`)
Rejects overlap with an existing FINALIZED run for the company.
Response 201 `{ "run": { "id", "status": "DRAFT", ... } }`
Errors: `400` invalid range / zero Mon–Fri days · `409` finalized-period overlap

### GET /api/payroll/runs — ADMIN
`?status=` filter. Response 200 `{ "runs": [...], "meta" }`

### GET /api/payroll/runs/:id — ADMIN
Detail incl. its payslips. Response 200 `{ "run": {...}, "payslips": [...] }`

### POST /api/payroll/runs/:id/calculate — ADMIN
Transaction 1 of the lifecycle (`DRAFT→CALCULATED`, re-runnable on `CALCULATED`).
Eligible = ≥1 EmploymentPeriod overlapping the period; employee-specific Working Days = Mon–Fri days inside those intersections; zero Working Days → excluded entirely (no payslip). Every eligible employee MUST have a SalaryStructure or the **whole calculation fails** and the run keeps its prior status. Recalculating replaces ALL provisional payslips wholesale. All math in integer paise per locked formula order.
Response 200 `{ "run": {...}, "payslipCount": n }`
Errors: `409` FINALIZED (terminal) · `422` eligible employee(s) missing SalaryStructure (`details` lists them)

### POST /api/payroll/runs/:id/finalize — ADMIN
Separate transaction (`CALCULATED→FINALIZED`): guarded status flip, re-verifies no finalized overlap, marks every payslip `finalized=true`. Payslips become immutable.
Response 200 `{ "run": {...} }`
Errors: `409` not CALCULATED / concurrent recalculation / finalized overlap

### GET /api/payslips — ADMIN, EMPLOYEE
EMPLOYEE: own only. ADMIN: `?runId=&employeeId=`
Response 200 `{ "payslips": [...], "meta" }`

### GET /api/payslips/:id — owner or ADMIN
Field visibility (spec §3):
- EMPLOYEE (own): totals only — `grossPaise`, `employeePfPaise`, `professionalTaxPaise`, `netPaise`, `payableDays`, `workingDays`, period info. **Never** the underlying structure/components.
- ADMIN: everything incl. prorated component snapshot.
Immutability: finalized payslips reject mutation (application-enforced).

---

## OPS INTELLIGENCE — ADMIN (exactly 4 rules, no ML)

### GET /api/ops/daily-brief
Active flags grouped by rule + Attention Score summary. Empty state returns `"message": "No issues detected today. All attendance, leave, and payroll signals are within expected parameters."`
Response 200 `{ "brief": { "flags": [{ "rule", "count", "items": [...] }], "attentionTotal": n }, "message"? }`

### GET /api/ops/attention
Attention-ranked queue (not chronological). Each item stacks applicable rule points, always with breakdown:
`+40` coverage risk HIGH · `+25` leave balance ≤10% · `+20` unexplained absence · `+15` payroll/attendance anomaly
Response 200 `{ "items": [{ "type", "refId", "employeeId", "score", "breakdown": [{ "rule", "points" }] }] }` (sorted `score` desc)

---

## NOTIFICATIONS — ADMIN, EMPLOYEE (own)

Schema: `recipient_id, type, message, is_read, created_at`. In-app only.

### GET /api/notifications — `?unreadOnly=true`
Response 200 `{ "notifications": [...], "meta" }`

### POST /api/notifications/:id/read → 200 `{ "notification": {...} }`
### POST /api/notifications/read-all → 200 `{ "updated": n }`

Events generated: leave approved/rejected, attendance anomaly detected, payroll ready for review.

---

## META

### GET /api/health — public
Response 200 `{ "status": "ok", "service": "dayflow-backend" }`

---

## Status codes

`200` ok · `201` created · `204` no content · `400` validation · `401` unauthenticated/expired/token-version bump · `403` forbidden (role, inactive, field-level access) · `404` not found · `409` conflict (state machine guard, duplicates, overlaps, races) · `422` business-rule rejection (prohibited transitions, negative fixed allowance, failed calculation)
