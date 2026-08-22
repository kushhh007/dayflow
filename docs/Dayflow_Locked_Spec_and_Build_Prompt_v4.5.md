# Dayflow — Locked Specification v4.5
## Team Reconstruction / Working Specification

> **Status:** Team-created working specification reconstructed from the Dayflow v4.5 team workflow.
>
> **Important:** This document is **not the original official v4.5 specification**. The original file was not present in the supplied repository/workflow document. This version consolidates the business and technical rules explicitly present in the team workflow so the team and AI coding agents can work from one shared source of truth.
>
> **Stack confirmed by team:** Node.js backend + PostgreSQL database.
>
> **Frontend:** React.
>
> **Architecture:** Frontend → REST API → Backend → Domain → PostgreSQL.

---

# 1. Project Overview

Dayflow is an HRMS (Human Resource Management System) designed to manage:

- Employees
- Employment history
- Attendance
- Attendance corrections
- Leave
- Salary structures
- Payroll
- Payslips
- Notifications
- Operations intelligence

The application is one integrated system.

```text
DAYFLOW

React Frontend
      |
      | HTTP / JSON
      v
REST API
      |
      v
Node.js Backend
      |
      v
Domain / Business Logic
      |
      v
PostgreSQL
```

The frontend must never communicate directly with PostgreSQL.

The backend owns API behavior.

The domain layer owns business rules.

The database owns persistence, constraints, relationships, and transactional integrity.

---

# 2. Team Ownership

## Member 1 — Backend + Integration Lead

Branch:

```text
feature/backend
```

Owns:

- Backend application
- Authentication
- Authorization / RBAC
- Login ID generation
- Temporary password flow
- API layer
- Validation
- API documentation
- Integration coordination
- Merging stable PRs into `main`

---

## Member 2 — Database + Domain + Payroll Lead

Branch:

```text
feature/domain-payroll
```

Owns:

- PostgreSQL schema
- Database migrations
- Employee domain
- EmploymentPeriod
- Attendance
- AttendanceCorrectionRequest
- LeaveType
- LeaveAllocation
- LeaveRequest
- SalaryStructure
- PayrollRun
- Payslip
- Payroll calculation
- Domain validation
- Database constraints
- Transactional domain operations
- Domain/payroll tests

---

## Member 3 — Frontend Lead

Branch:

```text
feature/frontend
```

Owns:

- React application
- Routing
- Authentication screens
- Admin dashboard
- Employee dashboard
- Employee pages
- Attendance UI
- Leave UI
- Payroll UI
- Ops Intelligence UI
- Notifications
- API integration
- Loading/error/empty states
- Responsive polish

---

## Member 4 — UI Support

Branch:

```text
feature/frontend-ui
```

Owns:

- Reusable UI components
- Navigation/sidebar
- Login visual UI
- Buttons
- Cards
- Tables
- Forms
- Basic employee dashboard shell
- Mock/demo data
- Loading states
- Empty states
- Error states
- Minor responsive/accessibility fixes

Member 4 does not own database, payroll, backend authentication, deployment, or critical business logic.

---

# 3. Core Architecture Rules

1. Use one GitHub repository.
2. Use one `main` branch.
3. Each member works on their assigned feature branch.
4. Do not work directly on `main`.
5. Use:
   `branch → commit → push → PR → review → merge`.
6. `main` must remain runnable.
7. Never force-push shared branches.
8. Never create fake commits.
9. Run tests/build before committing.
10. Do not modify another member's ownership area without agreement.

---

# 4. Confirmed Technology Stack

## Backend

```text
Node.js
```

The exact Node.js web framework and ORM/migration library must be agreed with Member 1 before implementation.

Possible choices may include Express/Fastify and Prisma/Drizzle/Knex, but the AI must **not choose one silently**.

If an ORM/migration tool is already present in the repository, use the existing project choice.

---

## Database

```text
PostgreSQL
```

PostgreSQL is the team's confirmed database.

Use PostgreSQL features where appropriate:

- Foreign keys
- Unique constraints
- Check constraints
- Transactions
- Indexes
- Numeric/integer monetary storage
- Referential integrity

---

## Frontend

```text
React
```

Frontend communicates with the backend through REST/HTTP and JSON.

---

# 5. Roles

The application has at least the following conceptual roles:

```text
ADMIN
EMPLOYEE
```

The backend is the final authority for authorization.

Frontend restrictions are for user experience and must not be treated as the security boundary.

Employees must not access administrative payroll information or salary structures.

Employees may access only their own payslips.

Admins may access administrative payroll information.

---

# 6. Authentication Requirements

Authentication is primarily owned by Member 1.

The domain specification requires:

1. Employees cannot self-register.
2. Admin creates employees.
3. System generates Login ID.
4. System generates temporary password according to the agreed implementation.
5. Temporary password is shown only once.
6. Only password hashes are stored.
7. Employee must change the temporary password on first login.
8. Inactive employees cannot log in.
9. Password reset invalidates existing sessions/tokens.

Member 2 must not independently implement a competing authentication system.

---

# 7. Employee Domain

Employee is the main employee record.

The employee model includes at minimum:

```text
Employee
- id
- status
- join_date
```

Additional fields may be required by the agreed UI/API, but must not conflict with the domain specification.

Possible status values include:

```text
ACTIVE
INACTIVE
```

The database should enforce valid status values.

---

# 8. EmploymentPeriod — Authoritative Employment History

`EmploymentPeriod` is the authoritative model for employment history.

Do not replace it with a single employment-end-date field.

Conceptual model:

```text
Employee
   |
   +-- status
   +-- join_date

EmploymentPeriod
   |
   +-- employee_id
   +-- start_date
   +-- end_date
```

Rules:

1. An ACTIVE employee must have exactly one open EmploymentPeriod.
2. An INACTIVE employee must have no open EmploymentPeriod.
3. ACTIVE → INACTIVE:
   - Close the current EmploymentPeriod.
4. INACTIVE → ACTIVE:
   - Create a new EmploymentPeriod.
5. Never erase the previous employment period.
6. Employment periods for one employee must not overlap.
7. An open period has `end_date = NULL`.

Example:

```text
Employee 101

Period 1:
2026-01-01 → 2026-08-10

Employee becomes inactive.

Later employee becomes active.

Period 2:
2026-08-20 → NULL
```

The first period must remain unchanged.

Do not reactivate an employee by deleting or clearing the old `end_date`.

---

# 9. Employment Period and Payroll Intersection

Employee-specific Working Days must be calculated using the intersection between:

```text
EmploymentPeriod
```

and:

```text
Payroll Period
```

If the employee has no working days inside the payroll period:

```text
Working Days = 0
```

then:

- Exclude the employee from the payroll run.
- Do not generate a payslip for that employee.

This rule is important for:

- Mid-month joiners
- Mid-month departures
- Reactivated employees
- Employees whose employment period does not intersect the payroll period

---

# 10. Attendance

The domain includes:

```text
Attendance
AttendanceCorrectionRequest
```

Attendance must support the states required by the application specification.

For payroll contribution, the following values are authoritative:

```text
PRESENT  = 1
HALF_DAY = 0.5
ABSENT   = 0
PAID     = 1
SICK     = 1
UNPAID   = 0
```

Attendance correction approval must be atomic.

If an approval modifies multiple records, all required changes must succeed or all must roll back.

---

# 11. Attendance Correction

Conceptual workflow:

```text
Employee
   |
   v
Correction Request
   |
   v
PENDING
   |
   v
Approval / Rejection
   |
   v
Attendance updated if approved
```

Rules:

1. Correction approval must be transactional.
2. Invalid corrections must be rejected.
3. Approved leave may create `LEAVE` attendance according to the application rules.
4. `LEAVE → PRESENT` correction is prohibited.
5. Domain constraints must prevent invalid states.

---

# 12. Leave Management

The domain contains:

```text
LeaveType
LeaveAllocation
LeaveRequest
```

## LeaveType

Defines the available types of leave.

The exact leave types should come from the approved project requirements and seed/demo configuration.

Do not invent additional business rules.

---

## LeaveAllocation

Represents an employee's leave balance/allocation.

It must support the required balance validation and update operations.

---

## LeaveRequest

Represents an employee's request for leave.

Conceptual states:

```text
PENDING
APPROVED
REJECTED
```

The exact enum names must remain consistent throughout the backend and database.

---

# 13. Leave Transaction Rules

Leave approval must be atomic.

The following operations must be protected from race conditions:

1. Balance validation
2. Leave overlap validation
3. Leave approval
4. Leave balance increment/decrement/update
5. Related attendance updates where required

The approval operation must not partially succeed.

Example:

```text
BEGIN TRANSACTION

Check leave overlap
Check balance
Approve leave
Update allocation
Create/update required attendance

COMMIT
```

If any required operation fails:

```text
ROLLBACK
```

Do not implement a sequence that can approve leave while failing to update the associated balance.

---

# 14. Leave Overlap

Leave overlap checking must be performed atomically with approval.

The system must prevent conflicting approved/pending leave according to the agreed business rules.

Do not rely only on frontend validation.

Backend/domain/database validation is required.

---

# 15. Salary Structure

The domain includes:

```text
SalaryStructure
```

SalaryStructure contains the salary information/components required by the payroll calculation.

The exact salary components and calculation order must follow the approved Dayflow requirements.

Do not invent salary formulas.

Do not duplicate payroll calculations in the frontend.

The frontend only displays payroll results returned by the backend.

---

# 16. Monetary Values

All monetary calculations must use integer smallest units.

For this project:

```text
1 rupee = 100 paise
```

Store monetary values as integer paise wherever possible.

Do not use floating-point arithmetic for payroll money calculations.

Example:

```text
₹25,000.50

stored as:

2500050 paise
```

All rounding must follow the approved payroll calculation order.

---

# 17. PayrollRun

The domain includes:

```text
PayrollRun
```

Payroll lifecycle:

```text
DRAFT
   ↓
CALCULATED
   ↓
FINALIZED
```

Rules:

1. A draft payroll run can be calculated.
2. Calculation and finalization are separate transactions.
3. Finalization must validate the calculated payroll.
4. Finalized payroll is immutable.
5. Finalized payslips are immutable.
6. A finalized payroll must not silently recalculate or overwrite payslip data.

---

# 18. Payroll Calculation

Payroll calculation must follow the approved salary-component calculation order and rounding dependencies.

Do not simplify the formula.

Do not invent formulas.

The calculation must use:

- Employee employment-period intersection
- Working Days
- Attendance contribution
- Leave contribution
- Salary structure
- Required salary components
- Required rounding rules

Payable day contribution:

```text
PRESENT  = 1
HALF_DAY = 0.5
ABSENT   = 0
PAID     = 1
SICK     = 1
UNPAID   = 0
```

---

# 19. Zero Working Days

If:

```text
Employee-specific Working Days = 0
```

then:

```text
Do not include employee in payroll.
Do not generate payslip.
```

This must be tested.

---

# 20. Payslip

The domain includes:

```text
Payslip
```

A payslip represents the calculated payroll snapshot for an employee.

A finalized payslip must be immutable.

The system should retain the values used at finalization so that historical payroll does not change when future employee/salary data changes.

The exact payslip fields must follow the agreed database/API contract.

---

# 21. Payroll Recalculation

Payroll calculation and finalization are different operations.

Conceptual flow:

```text
DRAFT
  |
  | calculate
  v
CALCULATED
  |
  | recalculate if allowed
  v
CALCULATED
  |
  | finalize
  v
FINALIZED
```

Once finalized:

```text
FINALIZED
   ↓
IMMUTABLE
```

Do not permit normal recalculation of finalized payroll.

---

# 22. Database Requirements

Use migrations for all schema changes.

Every domain table must have appropriate:

- Primary key
- Foreign keys
- NOT NULL constraints
- Unique constraints
- Check constraints
- Indexes
- Referential actions

The database must prevent invalid states whenever practical.

Do not remove constraints merely to make tests pass.

---

# 23. Transaction Requirements

The following operations require transaction protection:

### Leave approval

```text
Validate
+
Update balance
+
Approve request
+
Required attendance update
```

### Attendance correction approval

```text
Validate
+
Approve correction
+
Update attendance
```

### Payroll calculation

```text
Read required data
+
Calculate
+
Persist calculated payroll
```

### Payroll finalization

```text
Validate calculated payroll
+
Create/finalize immutable payslips
+
Finalize PayrollRun
```

The exact transaction implementation depends on the Node.js database/ORM stack selected by the team.

---

# 24. API Contract

The team workflow defines the following endpoint structure as the expected API direction.

These are **working endpoint names**, not a finalized external API specification.

Member 1 owns the final API contract.

## Authentication

```text
POST /api/auth/login
```

## Employees

```text
GET /api/employees
GET /api/employees/:id
```

## Attendance

```text
POST /api/attendance/check-in
POST /api/attendance/check-out
GET /api/attendance
```

## Leave

```text
POST /api/leave-requests
GET /api/leave-requests
POST /api/leave-requests/:id/approve
POST /api/leave-requests/:id/reject
```

## Payroll

```text
POST /api/payroll/runs
POST /api/payroll/runs/:id/calculate
POST /api/payroll/runs/:id/finalize
GET /api/payslips
```

## Operations

```text
GET /api/ops/daily-brief
GET /api/ops/attention
GET /api/notifications
```

Before implementation, Member 1 and Member 2 must agree on:

- Request schemas
- Response schemas
- Authentication requirements
- Roles
- HTTP status codes
- Error format
- Validation errors

Frontend must not invent a different response format.

---

# 25. Domain/API Boundary

Member 2 owns domain logic.

Member 1 owns API behavior.

Recommended structure:

```text
HTTP Request
    ↓
Controller / Route
    ↓
Service / Domain
    ↓
Repository / ORM
    ↓
PostgreSQL
```

The API layer must call domain services rather than duplicating payroll or leave business logic.

The frontend must not contain authoritative payroll calculations.

---

# 26. Testing Requirements

Tests must cover:

## Employee

- Employee creation
- Employee activation
- Employee deactivation

## EmploymentPeriod

- Initial period
- Closing period
- Reactivation
- Previous period preserved
- Overlapping periods rejected
- Active employee has one open period
- Inactive employee has no open period

## Attendance

- Check-in
- Check-out
- Attendance states
- Correction request
- Correction approval
- Correction rejection
- Atomic correction transaction
- LEAVE → PRESENT prohibited

## Leave

- Leave request
- Leave approval
- Leave rejection
- Balance validation
- Leave overlap
- Concurrent approval
- Atomic approval

## Payroll

- Zero working days
- Half-day
- Mid-month joiner
- Mid-month departure
- Reactivation payroll
- Payroll calculation
- Payroll recalculation
- Payroll finalization
- Payslip creation
- Payslip immutability

---

# 27. Golden Integration Path

The complete application should support the following demonstration flow:

```text
Create Employee
       ↓
Generate Login ID
       ↓
Employee Login
       ↓
Check In
       ↓
Apply Leave
       ↓
Admin Approves Leave
       ↓
Attendance becomes LEAVE
       ↓
Payroll Calculation
       ↓
Payslip Snapshot
       ↓
Ops Intelligence
```

This path should be tested during final integration.

---

# 28. Ops Intelligence

The project includes an Ops Intelligence area.

The frontend should display the explicit Ops Intelligence rules defined by the approved project specification.

Do not invent:

- ML models
- Extra scoring systems
- New business rules

The Attention Score and four explicit Ops Intelligence rules must come from the agreed Dayflow specification.

---

# 29. Notifications

The project includes notifications.

The backend/API layer owns notification delivery behavior.

The domain should expose the necessary events/data without creating a second notification architecture.

---

# 30. Security Rules

1. Employees cannot self-register.
2. Inactive employees cannot log in.
3. Temporary passwords are shown only once.
4. Only password hashes are stored.
5. Password reset invalidates existing sessions/tokens.
6. Employees cannot access salary structures.
7. Employees can access only their own payslips.
8. Backend authorization is the final security layer.
9. Frontend role restrictions are not sufficient security.
10. Sensitive payroll information must not be exposed through unauthorized APIs.

---

# 31. AI Coding Agent Rules

Any AI coding agent working on this project must:

1. Inspect before modifying.
2. Never assume missing architecture.
3. Never invent business rules.
4. Treat this specification as the current team source of truth.
5. Respect member ownership.
6. Modify only necessary files.
7. Never create fake commits.
8. Never force-push.
9. Run tests/build before committing.
10. Report blockers rather than silently working around them.
11. Never remove constraints to make tests pass.
12. Never replace EmploymentPeriod with a simpler employment-end-date model.
13. Never implement payroll using floating-point monetary values.
14. Never implement payroll independently in the frontend.
15. Never create a second competing API.

---

# 32. Member 2 Development Order

Member 2 should implement in this order:

```text
Phase 1
Database foundation
        ↓
Phase 2
Employee + EmploymentPeriod
        ↓
Phase 3
Attendance
        ↓
Phase 4
Attendance Corrections
        ↓
Phase 5
LeaveType + LeaveAllocation + LeaveRequest
        ↓
Phase 6
SalaryStructure
        ↓
Phase 7
PayrollRun
        ↓
Phase 8
Payroll calculation
        ↓
Phase 9
Payslip
        ↓
Phase 10
Tests
        ↓
Phase 11
Integration with Member 1
```

Do not start with payroll before the underlying employee, employment, attendance, leave, and salary data models are stable.

---

# 33. Git Workflow

Member 2 branch:

```text
feature/domain-payroll
```

Start:

```bash
git checkout main
git pull origin main
git checkout feature/domain-payroll
git merge origin/main
```

Save work:

```bash
git status
git add .
git commit -m "feat(db): create initial domain schema"
git push
```

Update from main:

```bash
git fetch origin
git merge origin/main
```

Create PR:

```text
feature/domain-payroll → main
```

Never use:

```bash
git push --force
git reset --hard origin/main
git commit --allow-empty
```

unless the team explicitly agrees to a legitimate exception.

---

# 34. Commit Strategy

Use real, meaningful commits.

Examples:

```text
feat(db): create initial domain schema

feat(domain): implement employee employment periods

feat(attendance): add attendance domain

feat(attendance): implement correction workflow

feat(leave): implement leave allocation and requests

feat(leave): make leave approval transactional

feat(payroll): add salary structure

feat(payroll): implement payroll calculation

feat(payroll): add payroll lifecycle

feat(payroll): create immutable payslips

test(domain): add employment period tests

test(attendance): add correction transaction tests

test(leave): add concurrency tests

test(payroll): add payroll edge cases

fix(domain): prevent overlapping employment periods
```

Do not create empty commits merely to show activity.

---

# 35. Pull Request Requirements

Every PR should explain:

```text
What changed?

Why was it changed?

What was tested?

Does it change an API contract?

Does it change the database schema?
```

Example:

```markdown
## What changed

Added Employee and EmploymentPeriod domain models.

## Tests

- employee creation
- employment period creation
- employee deactivation
- employee reactivation
- overlapping period rejection

## API

No API changes.

## Database

Added initial employee and employment period migrations.
```

---

# 36. Conflict Rules

If two members need to modify the same file:

1. Talk before changing it.
2. Prefer one owner for the file.
3. Do not overwrite another member's work.
4. Pull/merge latest `main`.
5. Resolve conflicts deliberately.

Never use destructive Git commands to erase another member's work.

---

# 37. Definition of Done — Member 2

Member 2 is considered complete when:

- PostgreSQL schema exists.
- All schema changes have migrations.
- Employee domain works.
- EmploymentPeriod is authoritative.
- Employment history is preserved.
- Attendance domain works.
- Attendance corrections are transactional.
- Leave domain works.
- Leave approval is transactional.
- SalaryStructure works.
- PayrollRun lifecycle works.
- Payroll calculations follow the approved rules.
- Monetary calculations use integer paise.
- Zero-working-day employees are excluded.
- Payslips are generated.
- Finalized payroll/payslips are immutable.
- Domain tests pass.
- Payroll tests pass.
- Member 1 can consume the domain layer.
- No frontend ownership was violated.
- No fake commits were created.
- No force-push was performed.

---

# 38. Final Golden Rule

The goal is:

```text
4 contributors
      +
parallel development
      +
genuine commits
      +
correct domain logic
      +
correct payroll
      +
strong database integrity
      +
frequent testing
      +
one integrated application
      +
working main branch
```

The objective is not to create commits for the sake of commits.

The objective is to create a working Dayflow HRMS.

---

# 39. Current Team Decisions

As of this working specification:

```text
Backend:
Node.js

Database:
PostgreSQL

Frontend:
React

Member 1:
Backend + Integration

Member 2:
Database + Domain + Payroll

Member 3:
Frontend

Member 4:
UI Support
```

The exact Node.js framework, ORM, migration tool, final API schemas, and any business rules not explicitly covered above must be agreed by the team before implementation.

---

# 40. Important Status Notice

This file is a **team reconstruction / working specification** based on the available Dayflow team workflow.

It must NOT be represented as the original official:

`Dayflow_Locked_Spec_and_Build_Prompt_v4.5.md`

If the original v4.5 specification becomes available, compare this document against it and update this working specification before implementing conflicting requirements.

**End of Dayflow Working Specification v4.5**
