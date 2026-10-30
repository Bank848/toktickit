# Lab 4 Sprint Engineering Specification

**Status:** Authored 2026-09-23, against `SE+Lab+4.pdf` (11 pages) and the actual Lab 3 increment
already merged to `main`. This document extends `docs/lab-03/specification.md`; every Lab 1-3
Functional Requirement, Business Rule, and Acceptance Criterion continues to hold except where
explicitly superseded below. Do not re-derive Lab 1-3 behavior from this document alone; read all
three.

Companion deliverables: `ui-spec.md`, `api-spec.md`, `tests.md`, plus `reviewer.md` and `ai-use.md`
(produced at submission time, not authored ahead of implementation).

### Roadmap and GitHub Issue Decomposition

Six issues, sequenced so nothing downstream is blocked on something not yet merged:

| Order | Issue | Scope | Depends on |
|---|---|---|---|
| 1 | Sprint 4 engineering contract | This document, `ui-spec.md`, `api-spec.md`, `tests.md` | none |
| 2 | Action Taken foundation | Prisma migration (§9), seed data (§9.6), `ActionTaken` model, authorization, base API routes (#1-4 in §10) | 1 |
| 3 | Action Taken UI | Ticket Detail list/create/edit for IT Staff, read-only view for Requesters | 2 |
| 4 | Ticket resolution gate | FR-06/BR-09 check on `PATCH /staff/tickets/:id/status`, its UI-facing rejection message | 2 |
| 5 | Role dashboards | Dashboard API routes (#5-6 in §10), Requester/IT Staff/Administrator dashboard pages and navigation | 2 |
| 6 | Final hardening and regression | Full Lab 1-3 + Lab 4 regression pass, accessibility/visual polish, documented Playwright run, `reviewer.md`/`ai-use.md` | 3, 4, 5 |

Issues 3, 4, and 5 can proceed in parallel once issue 2 merges, since they touch disjoint route
files and disjoint client screens; issue 6 is the only hard join point.

## 1. Sprint Goal

Give IT Staff a formal, auditable record of the work performed on a Ticket, and make Resolved mean
something: a Ticket cannot become Resolved until at least one Action Taken has been recorded
against it, and that gate is enforced by the backend regardless of what the client sends. Requesters
and IT Staff each get a dashboard that summarizes their own operational picture without duplicating
the existing Ticket Queue and My Tickets screens. Every Lab 1-3 capability, role boundary, and test
keeps passing; the application is hardened and polished for final demonstration.

## 2. Stakeholder Request Interpretation

The service desk can already receive Tickets and let IT Staff talk to Requesters, but there is still
no record of what was actually done to fix anything, and a Requester's own claim that a problem
looks fixed has never been enough to close a Ticket. Lab 4 closes that gap with Actions Taken: a
dated, attributable log entry under each Ticket, written and editable by any IT Staff or
Administrator, describing what was tried, its result, and whether the Requester needs to do
something next. The Ticket Owner still coordinates the Ticket as a whole, but the handout is
explicit that a different IT Staff member may be the one who actually performs and records a given
action, so authorship of an Action Taken is independent of Ticket ownership. Requesters and IT Staff
both need a landing page that tells them, at a glance, what needs attention right now, without
forcing them to read the full Ticket Queue or My Tickets list first. None of this replaces the
detailed screens; both dashboards link out to them.

## 3. Scope

### Included

- Action Taken: create and edit (any accessible Ticket, by IT Staff or Administrator), list and view
  (all roles with Ticket access, including read-only for Requesters), on Ticket Detail
- A new Business Rule blocking the `RESOLVED` status transition until the Ticket has at least one
  Action Taken recorded
- Requester Dashboard: a dedicated landing page after login, summarizing the Requester's own Tickets
  by status with links into My Tickets
- IT Staff Dashboard: a dedicated landing page after login, summarizing unassigned Tickets, Tickets
  owned by the current user, Tickets by status and by IT Priority, and recently updated Tickets, with
  links into the Ticket Queue
- Administrator Dashboard: reuses the IT Staff Dashboard and adds a concise breakdown of user
  accounts by role
- Final regression across every Lab 1-3 screen, role, and API endpoint, plus a documented,
  reproducible Playwright end-to-end run
- Final Zen Green visual and accessibility polish: consistent empty/loading/error states, no
  console errors, no placeholder text, no clipped or overlapping controls

### Excluded

- Automatic SLA clocks, escalation engines, on-call scheduling, breach notifications
- Email, SMS, LINE, push, or any other external notification service
- Inventory, spare-parts management, purchasing, or cost accounting for services
- Time-sheet billing, payroll, or detailed labor-cost calculation
- Multi-level approval workflows and electronic signatures
- Advanced business-intelligence tools, custom report builders, export/CSV, date-range filters, or
  dashboard caching
- Multi-tenant organizations and production-scale cloud operations
- Auto-transitioning a Ticket's status based on an Action Taken's `Result` value; the resolution gate
  only checks that a qualifying record exists, and status still changes exclusively through the
  existing status endpoint
- Real file upload behind an Action Taken's Attachment Notes; the field is a text hint only, and the
  existing Attachment model is untouched
- Follow-up due dates, reminders, or assignment of a follow-up to a specific user
- A Ticket-wide revision counter: `Ticket.version` remains the unused column it already was in
  Lab 1-3. Stale-write protection uses an `If-Match` precondition built from `updatedAt` instead
  (api-spec.md §4.4 and §4.5)
- Writing `Ticket.resolutionSummary` or `Ticket.requesterResolutionConfirmedAt`; both remain the
  unused columns they already were before Lab 4 (see §10)
- Edit history, revision diffing, or soft delete for Action Taken records. Append-only in the Lab 4
  answer sheet is read as in D-07: Action Taken is editable by design (labsheet §8.3 edit mode), and
  the append-only guarantee applies to Comments, Internal Notes and the `TicketEvent` trail
- Restricting who may edit an Action Taken beyond role (any IT Staff or Administrator may edit any
  record on an accessible Ticket, not only the record's original author)

## 4. Functional Requirements

### Action Taken

- **FR-01** IT Staff and Administrators shall be able to create an Action Taken on any accessible,
  non-terminal Ticket, recording Action Date/Time, Description, Result, Follow-Up Required, an
  optional Follow-up Note, and optional Attachment Notes.
- **FR-02** IT Staff and Administrators shall be able to edit an existing Action Taken on any
  accessible, non-terminal Ticket, regardless of which IT Staff member originally created it.
- **FR-03** Requesters shall be able to view every Action Taken recorded against a Ticket they own,
  with the same field detail IT Staff sees; Requesters shall not be able to create or edit one.
- **FR-04** The system shall record who performed an Action Taken automatically from the
  authenticated session at creation time; the field is never accepted from the request body and
  never changes on a later edit, even when a different IT Staff member performs the edit.
- **FR-05** The system shall record who last edited an Action Taken automatically from the
  authenticated session, separately from who performed it.
- **FR-06** A Ticket's status shall not become `RESOLVED` unless that Ticket already has at least one
  Action Taken recorded; the check runs server-side on the existing status-change endpoint and
  cannot be bypassed by a client that skips the Action Taken screen.

### Dashboards

- **FR-07** The system shall expose a Requester Dashboard summarizing the authenticated Requester's
  own Tickets by status, plus a short list of their most recently updated Tickets, computed entirely
  server-side from authoritative data.
- **FR-08** The system shall expose an IT Staff Dashboard summarizing unassigned Tickets, Tickets
  owned by the authenticated user, Ticket counts by status, Ticket counts by IT Priority, and a short
  list of recently updated Tickets across all Requesters, computed entirely server-side.
- **FR-09** An Administrator viewing the IT Staff Dashboard shall additionally see a count of active
  user accounts by role.
- **FR-10** Every dashboard metric shall have a defined empty state (a zero or an empty list, never
  an omitted field or an error) and, where practical, a link into the corresponding detailed screen
  filtered to match.

## 5. Ticket Status Transition Matrix (restated, unchanged from Lab 3)

| From | Allowed To | Who | Trigger |
|---|---|---|---|
| `NEW` | `OPEN` | IT Staff | Automatic side effect of the Ticket's first ownership assignment; never a direct status write while unowned |
| `NEW` | `CANCELLED` | IT Staff | Direct status change; no owner required |
| `OPEN` | `IN_PROGRESS` | IT Staff | Direct status change |
| `OPEN` | `WAITING_FOR_REQUESTER` | IT Staff | Direct status change |
| `OPEN` | `CANCELLED` | IT Staff | Direct status change |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER` | IT Staff | Direct status change |
| `IN_PROGRESS` | `RESOLVED` | IT Staff | Direct status change, subject to FR-06 |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS` | IT Staff | Direct status change (staff resumes work) |
| `WAITING_FOR_REQUESTER` | `RESOLVED` | IT Staff | Direct status change, subject to FR-06 |
| `WAITING_FOR_REQUESTER` | `CANCELLED` | IT Staff | Direct status change |
| `RESOLVED` | `CLOSED` | IT Staff | Direct status change (formal close) |
| `RESOLVED` | `REOPENED` | IT Staff | Direct status change |
| `CLOSED` | `REOPENED` | IT Staff | Direct status change (only outbound transition from `CLOSED`) |
| `REOPENED` | `OPEN` | IT Staff | Direct status change (only outbound transition from `REOPENED`) |

No row changes shape in Lab 4; the only addition is that the two rows landing on `RESOLVED` now
carry the FR-06 precondition. `CANCELLED` remains terminal with no outbound transition. After a
Ticket cycles `RESOLVED` → `REOPENED` → `OPEN` → `IN_PROGRESS`, its earlier Action Taken records
still exist, so a second pass through `RESOLVED` satisfies FR-06 without a new Action Taken; this is
intentional, not a gap.

## 6. Business Rules

- **BR-01** An Action Taken belongs to exactly one Ticket.
- **BR-02** The Ticket Owner coordinates the Ticket, but an Action Taken may be created or edited by
  any IT Staff member or Administrator with access to that Ticket, not only the Owner.
- **BR-03** Once created, an Action Taken's `performedBy` value never changes, including when a
  different IT Staff member later edits the record.
- **BR-04** Editing an Action Taken records the editor separately, as `lastEditedBy`, distinct from
  `performedBy`.
- **BR-05** A Follow-up Note is required and must be non-empty when Follow-Up Required is true, and
  is cleared to empty whenever Follow-Up Required is set back to false, on both create and edit.
- **BR-06** Attachment Notes is a free-text field describing where a related file can be found; it is
  not a file upload and creates no `Attachment` row.
- **BR-07** Action Date/Time may not be set in the future.
- **BR-08** Action Taken creation and editing are locked once the parent Ticket reaches `CLOSED` or
  `CANCELLED`, matching the existing lock on owner, IT Priority, and status changes; the record
  already on file remains visible.
- **BR-09** A Ticket cannot transition to `RESOLVED` unless it has at least one Action Taken on
  record, regardless of that record's `Result` value; the check applies to every transition that
  targets `RESOLVED`, is evaluated after the existing transition-matrix and terminal-lock checks, and
  is enforced identically whether the request comes from the UI or directly against the API.
- **BR-10** A Requester's indication that a problem appears resolved remains advisory only and never
  changes Ticket status by itself (unchanged from Lab 3 BR-05); it has no interaction with FR-06/BR-09.
- **BR-11** A Requester may view every field of every Action Taken on a Ticket they own; Action Taken
  content is not treated as IT-Staff-private the way an Internal Note is.
- **BR-12** The Requester Dashboard is always scoped to the authenticated Requester's own Tickets;
  the server never accepts a Requester id from the client for this purpose. The IT Staff Dashboard's
  "owned by me" metric is always scoped to the authenticated IT Staff user in the same way.
- **BR-13** Every dashboard metric is produced by a database count or aggregate query; no metric is
  computed by fetching a full Ticket list and counting in application code.
- **BR-14** A Ticket's `updatedAt` timestamp reflects changes to the Ticket's own fields (status,
  owner, IT Priority) only. Creating or editing an Action Taken, like posting a Comment or an
  Internal Note, does not change the parent Ticket's `updatedAt`, keeping Lab 4 consistent with Lab
  1-3 behavior on that point.

## 7. Required Roles and Authorization Matrix

| Role | Minimum permitted behavior |
|---|---|
| Requester | View Action Taken information for owned Tickets; cannot create or edit one. View own Requester Dashboard. |
| IT Staff | Create and edit Action Taken on any accessible Ticket. View own IT Staff Dashboard. |
| Administrator | Perform every IT Staff behavior above; view the IT Staff Dashboard extended with user-account counts by role. |

As in Lab 1-3, every write is enforced server-side; hiding a control in the client is never treated
as authorization.

## 8. UI Specification Summary

Full detail lives in `ui-spec.md`. Summary: five screens ship or change, all extending the Zen Green
token set and shared component conventions carried forward from Lab 2-3 without introducing a second
visual system.

- **IT Staff Ticket Detail** gains an Actions Taken section: a list or table of existing records,
  a create form, and an edit mode per record, each with its own loading, validation, submitting,
  success, and safe-failure states that preserve entered data after a recoverable error.
- **Requester Ticket Detail** gains a read-only Actions Taken list using the same field layout.
- **Requester Dashboard** (new route, reached from primary navigation) shows metric cards for open,
  waiting, resolved, and closed Ticket counts, a short recent-Tickets list, and quick actions (Create
  Ticket, View My Tickets), matching the labsheet §8.2 mockup.
- **IT Staff Dashboard** (new route, reached from primary navigation, also the Administrator's
  landing page) shows metric cards for New, Open, In Progress, Waiting, and the current user's
  assigned count, plus a recent-Tickets list and quick actions, matching the labsheet §8.1 mockup;
  the Administrator variant adds a compact user-count-by-role card.
- **Status change control** on IT Staff Ticket Detail surfaces the FR-06 rejection as an inline
  message directing the user to record an Action Taken first, rather than a raw error.

All screens meet the responsive breakpoints and WCAG 2.2 AA rules carried over unchanged from Lab
2-3 (`ui-spec.md` §7).

## 9. Data Changes

### 9.1 New model: `ActionTaken`

```prisma
enum ActionResult {
  RESOLVED
  ESCALATED
  NO_ACTION_NEEDED
  PENDING_FOLLOW_UP
}

model ActionTaken {
  id               String       @id @default(uuid())
  ticketId         String
  ticket           Ticket       @relation(fields: [ticketId], references: [id], onDelete: Restrict)

  performedById    String
  performedBy      User         @relation("ActionPerformer", fields: [performedById], references: [id], onDelete: Restrict)
  lastEditedById   String?
  lastEditedBy     User?        @relation("ActionEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  actionAt         DateTime
  description      String       @db.VarChar(2000)
  result           ActionResult
  followUpRequired Boolean      @default(false)
  followUpNote     String?      @db.VarChar(1000)
  attachmentNotes  String?      @db.VarChar(500)
  idempotencyKey   String?      @db.VarChar(64)

  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  @@index([ticketId, actionAt])
  @@unique([ticketId, performedById, idempotencyKey])
}
```

`actionAt` is the user-entered time the work happened, distinct from `createdAt`/`updatedAt`, which
are row-level audit timestamps; `actionAt` is editable subject to BR-07. `performedById` is set once
from the session and frozen thereafter (BR-03); `lastEditedById` records the editor of the most
recent write. `Result` is a closed enum rather than free text specifically so the dashboards can
aggregate it (§9.2); the four values are chosen to cover an action's outcome without encoding a
workflow rule about what happens to the Ticket next.

### 9.2 Extended indexes on `Ticket`

`ownerId` carries no index today, and both IT Staff Dashboard metrics that filter on it (unassigned,
owned-by-me) would otherwise scan the full table:

```prisma
model Ticket {
  // ...existing fields unchanged...
  actionsTaken ActionTaken[]

  @@index([requesterId, createdAt])
  @@index([status])
  @@index([categoryId])
  @@index([ownerId, status])
  @@index([updatedAt])
}
```

### 9.3 Extended enum on `User` back-relations

```prisma
model User {
  // ...existing fields unchanged...
  performedActions ActionTaken[] @relation("ActionPerformer")
  editedActions    ActionTaken[] @relation("ActionEditor")
}
```

### 9.4 Extended `TicketEventType`

```prisma
enum TicketEventType {
  TICKET_CREATED
  COMMENT_ADDED
  ATTACHMENT_ADDED
  ATTACHMENT_REMOVED
  ACTION_TAKEN_ADDED
  ACTION_TAKEN_UPDATED
}
```

Creating or editing an Action Taken writes a `TicketEvent` inside the same transaction as the
Comment and Attachment endpoints already do, keeping the audit trail consistent across Lab 3 and
Lab 4 record types.

### 9.5 Migration and backfill

The migration is additive only: one new table, one new enum, one extended enum, and four new
indexes: `ActionTaken(ticketId, actionAt)`, the unique `ActionTaken(ticketId, performedById,
idempotencyKey)`, `Ticket(ownerId, status)` and `Ticket(updatedAt)`. The `Ticket` indexes on
`requesterId, createdAt`, `status` and `categoryId` already exist from Lab 3 and are not counted.
No existing column changes type or nullability, and no existing row is rewritten. A Ticket created
before Lab 4 simply has zero Action Taken records until one is added, which is exactly the state
FR-06/BR-09 already expect for any Ticket that has never been worked; no legacy-record special case
is required.

### 9.5.1 Recovery from a failed or rolled-back migration

- **Failed apply.** Prisma Migrate does not add a transaction around a PostgreSQL migration by
  itself, so the Lab 4 `migration.sql` starts with `BEGIN;` and ends with `COMMIT;`. A failing
  statement then rolls back every earlier statement and leaves no partial object. Fix the cause, run
  `prisma migrate resolve --rolled-back <name>` if `_prisma_migrations` shows the row as failed, then
  re-run `prisma migrate deploy`. If a partial schema is ever found anyway (for example a migration
  edited later without the wrapper), inspect it with `\d "ActionTaken"` and `\dT`, drop the leftover
  objects by hand, and only then resolve and retry; the retry must never run against a partial schema.
- **Deliberate rollback.** `server/prisma/migrations/<name>/down.sql` (kept beside the migration)
  drops `ActionTaken` and the `ActionResult` enum, then removes the two Lab 4 indexes on `Ticket`. The
  three `TicketEventType` values stay, because PostgreSQL cannot drop an enum value in place; they are
  unused once the table is gone.
- **New Action Taken records.** A rollback deletes them with the table. Before running `down.sql`,
  export them with `pg_dump --data-only --table="ActionTaken"`; re-applying the migration and
  restoring that file brings them back. Lab 1-3 rows are never touched in either direction.
- Proved by API-44 (tests.md): failed apply with a deliberately broken last statement leaves no object; apply, add records, roll back, check Lab 3 data, re-apply.

### 9.6 Seed data

The Lab 4 seed extends the existing idempotent seed script with:

- at least one Ticket with zero Action Taken records (to demonstrate the FR-06/BR-09 rejection)
- at least one Ticket with exactly one Action Taken (to demonstrate the minimum passing case)
- at least one Ticket with multiple Action Taken records authored by different IT Staff users (to
  demonstrate BR-02)
- at least one Action Taken with `followUpRequired = true` and a populated `followUpNote`
- Tickets covering every status and every IT Priority value, and both an unassigned Ticket and a
  Ticket owned by the seeded IT Staff user, so every dashboard metric has a non-zero seed value at
  least once

## 10. API Contract

Full detail lives in `api-spec.md`. Error envelope, correlation id, and role middleware follow the
existing Lab 2-3 conventions unchanged (`{ error: { code, message, fieldErrors, correlationId } }`).

| # | Method + path | Role | Success | Key errors |
|---|---|---|---|---|
| 1 | `GET /api/v1/tickets/:id/actions` | Requester, own Ticket | 200, list | 404 `TICKET_NOT_ACCESSIBLE` |
| 2 | `GET /api/v1/staff/tickets/:id/actions` | IT Staff/Administrator | 200, list | 404 `TICKET_NOT_FOUND` |
| 3 | `POST /api/v1/staff/tickets/:id/actions` | IT Staff/Administrator | 201, created record | 422 validation, 404, 409 `TICKET_LOCKED` |
| 4 | `PATCH /api/v1/staff/tickets/:id/actions/:actionId` | IT Staff/Administrator | 200, updated record | 422 validation, 404 `TICKET_NOT_FOUND`/`ACTION_NOT_FOUND`, 409 `TICKET_LOCKED` |
| 5 | `GET /api/v1/dashboard` | Requester | 200, always (zeros when empty) | 401, 403 |
| 6 | `GET /api/v1/staff/dashboard` | IT Staff/Administrator | 200, always (zeros when empty) | 401, 403 |

`PATCH /api/v1/staff/tickets/:id/status` is extended (not replaced): it gains a new failure mode,
409 `RESOLUTION_REQUIRES_ACTION_TAKEN`, returned only when the target status is `RESOLVED` and the
Ticket has zero Action Taken records, checked after the existing transition-matrix and
terminal-status checks so that an invalid transition or a locked Ticket keeps returning its existing
error code unchanged.

There is no delete endpoint for Action Taken. The Requester namespace exposes read access only; no
write route exists there at all for a Requester to be rejected from.

Both dashboard endpoints accept no query parameters. Neither accepts a user id, date range, or
filter from the client; `GET /api/v1/dashboard` is always scoped to the caller's own session, and
`GET /api/v1/staff/dashboard`'s `ownedByMe` count is always scoped the same way. An Administrator
calling `GET /api/v1/staff/dashboard` additionally receives a `userCounts` object counting only
accounts with `isActive = true`; an IT Staff caller does not.

## 11. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated user as `performedBy`. |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-03 | Given an Action Taken created by IT Staff user A, when IT Staff user B edits it, then `performedBy` still reads user A and `lastEditedBy` reads user B. |
| AC-04 | Given a Ticket with zero Action Taken records, when a status change to `RESOLVED` is requested directly against the API, then the request is rejected with 409 `RESOLUTION_REQUIRES_ACTION_TAKEN` and the Ticket's status is unchanged. |
| AC-05 | Given a Ticket with at least one Action Taken record, when its status is `IN_PROGRESS` or `WAITING_FOR_REQUESTER` and a valid status change to `RESOLVED` is requested, then the change succeeds. |
| AC-06 | Given an Action Taken create or edit request with `followUpRequired: true` and an empty `followUpNote`, then the request is rejected with 422 and the field is identified in `fieldErrors`. |
| AC-07 | Given `followUpRequired` set from `true` to `false` on edit, then the stored `followUpNote` is cleared regardless of what the request body contains for it. |
| AC-08 | Given a Ticket in `CLOSED` or `CANCELLED` status, when an Action Taken create or edit is attempted, then the request is rejected with 409 `TICKET_LOCKED` and no record is created or changed. |
| AC-09 | Given a Requester who owns a Ticket, when they retrieve its Action Taken list, then every field of every record is visible, and a create or edit attempt against the same Ticket is rejected. |
| AC-10 | Given the IT Staff Dashboard, when at least one Ticket is unassigned, then the unassigned count matches a direct count of Tickets with `ownerId = null` and a non-terminal status. |
| AC-11 | Given the Administrator Dashboard, then a `userCounts` breakdown by role is present in the response; the same request made by an IT Staff user omits it. |
| AC-12 | Given no seeded Tickets for a freshly created Requester account, when their dashboard is retrieved, then every count is `0` and the recent-Tickets list is an empty array, not an omitted field or an error. |
| AC-13 | Every Lab 1-3 acceptance criterion continues to pass unchanged against the Lab 4 codebase. |

## 12. Definition of Done

A feature is done when: the migration applies cleanly against seeded Lab 1-3 data with no data loss;
every Functional Requirement and Business Rule above has at least one passing automated test; every
Acceptance Criterion in §11 is demonstrated; the full Lab 1-3 regression suite (unit, API,
component, and end-to-end) passes on `main`, including a single documented Playwright run with an
explicit pass count and the configuration used to obtain it; the Requester, IT Staff, and
Administrator Dashboards render correctly at desktop, tablet, and mobile widths with no console
errors, no placeholder text, and no broken links; and `docs/lab-04/{specification,ui-spec,api-spec,
tests,reviewer,ai-use}.md` are all committed and internally consistent with the shipped code.

## 13. Assumptions and Decisions

- **D-01** `Ticket.version` and `Ticket.requesterResolutionConfirmedAt` are dead columns inherited
  from Lab 1-3 (present in the schema, never read or written by any endpoint). Lab 4 does not wire
  either one up; doing so would be Lab 1-3 rework outside this sprint's contract and would add
  regression risk for no requirement in the Lab 4 handout. `Ticket.resolutionSummary` is likewise
  never written by any endpoint and stays that way in Lab 4, for the same reason: the handout does
  not ask for a resolution-summary capture, and adding one now would be scope beyond the Sprint 4
  contract.
- **D-02** The FR-06/BR-09 resolution gate checks only that at least one Action Taken exists on the
  Ticket, not that its `Result` is `RESOLVED`. A Ticket may legitimately resolve after a final action
  whose result is `ESCALATED` or `NO_ACTION_NEEDED`; requiring a specific `Result` value would encode
  an approval-workflow rule the handout explicitly excludes, and would make the gate's outcome
  depend on which Action Taken record happens to be most recent, which an editable record makes
  unstable.
- **D-03** Result is a four-value enum rather than free text specifically so dashboard metrics could
  aggregate it if a later lab needs to; Lab 4 itself does not surface a Result breakdown on either
  dashboard, since the handout's dashboard examples do not ask for one.
- **D-04** Duplicate-click protection stays client-side (disable the submit control while the request
  is in flight). Network-retry safety is server-side: `POST` carries an `Idempotency-Key` and a replay
  returns the stored record (labsheet §8.5). Stale writes are refused through an `If-Match`
  precondition on `updatedAt` (labsheet §6.1). `Ticket.version` stays unused (D-01).
- **D-05** Attachment Notes is a plain text field with no relationship to the `Attachment` model;
  it exists to let IT Staff point a reader at a file that lives outside the system (for example, a
  photo shared through another channel), not to accept an upload.
- **D-06** Creating or editing an Action Taken does not update the parent Ticket's `updatedAt`, for
  consistency with how Comments and Internal Notes already behave in Lab 3; "recently updated" on
  both dashboards is defined as a change to the Ticket's own status, owner, or IT Priority fields.
- **D-07** Append-only reading for the Lab 4 answer sheet, Part 7. The Lab 4 handout uses the word
  once, in the grading row for Answer Part 7, "Working Ticket Workflow": "Demonstrate permitted Ticket
  transitions, stable ordering, append-only behavior, and role-appropriate visibility." The row sits
  under Ticket Workflow, not under Actions Taken, and the same handout requires Actions Taken to have
  a "view/edit mode" (section 8.3). Read together, the append-only record is the Ticket's workflow
  trail: the `TicketEvent` entries written for every status change and for every Action Taken create
  and edit, together with the append-only Public Comments and Internal Notes inherited from Lab 3.
  Action Taken rows stay editable, with `performedBy` frozen, `lastEditedBy` recorded, a
  `TicketEvent` per create and edit, and no delete. Source: Lab 4 handout, section 8.3 and the Answer
  Part 7 row. The handout does not define the term further and Issue #52 adds nothing, so this is a
  reading grounded in the handout text, not an instructor ruling. If the instructor says otherwise,
  D-07, API-45 and API-10 change together.
