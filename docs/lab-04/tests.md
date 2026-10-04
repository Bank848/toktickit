# Lab 4 Test Plan

Extends `docs/lab-03/tests.md`. Every Functional Requirement, Business Rule, and Acceptance Criterion
in `specification.md` has at least one automated test below. Tooling is unchanged: Vitest (client:
jsdom and Testing Library; server: Supertest) and Playwright for end-to-end. The **Status** column
shows whether a test already exists in the repository (`Done`) or is still to be written for the
issue named in the column (`Issue #N`).

## 1. Test Strategy and File Layout

- `server/tests/lab-04/actionTakenModel.test.ts` — schema and audit-event behavior
- `server/tests/lab-04/actionTakenRequest.validator.test.ts` — request validator, pure unit tests
- `server/tests/lab-04/staffActions.api.test.ts` — staff create, edit, list
- `server/tests/lab-04/requesterActions.api.test.ts` — Requester read-only route
- `server/tests/lab-04/resolutionGate.api.test.ts` — FR-06/BR-09 gate on the status endpoint
- `server/tests/lab-04/dashboardMetrics.service.test.ts` — metric queries, service level
- `server/tests/lab-04/dashboard.api.test.ts` — dashboard routes and scoping
- `client/tests/lab-04/*.test.tsx` — Actions Taken sections, both dashboards, URL filter hydration,
  detail-page integration, datetime helper
- `e2e/lab-04/*.spec.ts` — Playwright flows (Issue #57)

**Regression rule.** AC-13 is proven by running the complete Lab 1-3 suites (`server/tests/lab-0[1-3]`,
`client/tests/lab-0[1-3]`, `e2e/lab-0[1-3]`) unchanged against the Lab 4 codebase. One Lab 3 test is
deliberately extended, not weakened: the "allows each valid direct transition" table in
`server/tests/lab-03/staffTicketStatus.api.test.ts` now seeds one Action Taken before any transition
that targets `RESOLVED`, because FR-06 changes the precondition for exactly those rows.

**Harness note.** Server tests run against the isolated `toktickit_test` database with migration and
seed in global setup; Playwright runs against `toktickit_e2e` on the dedicated E2E port, both as in
Lab 2-3. Lab 4 adds no environment variable. A migration regression test (§4) proves the Lab 4
migration applies over seeded Lab 3 data with no row lost.

**Timezone note.** Date/time tests assert the exact instant after a round trip, and are run under at
least two `TZ` values, so a conversion bug cannot hide in a runner that happens to sit at UTC.

## 2. Planned Tests

### 2.1 Unit and Service

| ID | Requirement | What it tests | Expected result | File | Status |
|---|---|---|---|---|---|
| UNIT-01 | FR-01, BR-05 | Validator accepts a minimal valid body | `ok`, `followUpNote` and `attachmentNotes` null | `actionTakenRequest.validator.test.ts` | Done |
| UNIT-02 | FR-01 | Result outside the four enum values | Rejected, field `result` | same | Done |
| UNIT-03 | FR-01 | Description empty, then 2001 characters | Rejected both; 1 and 2000 accepted | same | Done |
| UNIT-04 | BR-05, AC-06 | `followUpRequired` true with empty note | Rejected, field `followUpNote` | same | Done |
| UNIT-05 | BR-05 | `followUpRequired` true with a note | Accepted, note trimmed | same | Done |
| UNIT-06 | BR-05, AC-07 | `followUpRequired` false with note text in body | Accepted, stored note `null` | same | Done |
| UNIT-07 | BR-07 | `actionAt` one instant in the future | Rejected, field `actionAt` | same | Done |
| UNIT-08 | BR-07 | `actionAt` exactly now | Accepted (boundary inclusive) | same | Done |
| UNIT-09 | FR-01 | Unparseable `actionAt` | Rejected | same | Done |
| UNIT-10 | BR-06 | `attachmentNotes` 501 characters; omitted | Rejected; omitted accepted as null | same | Done |
| UNIT-11 | D-06, BR-14 | Creating an ActionTaken row | `Ticket.updatedAt` unchanged | `actionTakenModel.test.ts` | Done |
| UNIT-12 | BR-03, BR-04 | `lastEditedById` may differ from `performedById` | Both persist independently | same | Done |
| UNIT-13 | FR-10, AC-12 | New Requester, zero Tickets | All 8 status counts `0`, empty list | `dashboardMetrics.service.test.ts` | Done |
| UNIT-14 | AC-02, BR-12 | Two Requesters' Tickets | Each sees only their own counts and list | same | Done |
| UNIT-15 | FR-07 | More than 5 Tickets | `recentTickets` holds 5, newest `updatedAt` first | same | Done |
| UNIT-16 | AC-10 | Unassigned count | Equals Tickets with `ownerId` null and non-terminal status | same | Done |
| UNIT-17 | FR-08 | Owned-by-me count | Counts every status including `CLOSED` and `CANCELLED` | same | Done |
| UNIT-18 | BR-12 | Two staff users | Each sees their own owned-by-me count | same | Done |
| UNIT-19 | FR-08 | Status and priority counts | Span all Requesters, zero-filled | same | Done |
| UNIT-20 | FR-09, AC-11 | `userCounts` flag | Present only when requested, all 3 roles zero-filled | same | Done |

### 2.2 API

| ID | Requirement / AC | What it tests | Expected result | File | Status |
|---|---|---|---|---|---|
| API-01 | FR-01, FR-04, AC-01 | IT Staff creates an Action Taken | 201; `performedBy` is the session user | `staffActions.api.test.ts` | Done |
| API-02 | FR-04 | Body carries a foreign `performedById` | Ignored; session user stored | same | Done |
| API-03 | FR-01 | Invalid body | 422, nothing created | same | Done |
| API-04 | BR-01 | Create on an unknown Ticket | 404 `TICKET_NOT_FOUND` | same | Done |
| API-05 | BR-08, AC-08 | Create on `CLOSED`, then on `CANCELLED` | 409 `TICKET_LOCKED`, nothing created | same | Done |
| API-06 | FR-02, FR-05, AC-03, BR-02, BR-03, BR-04 | User B edits a record by user A | `performedBy` still A, `lastEditedBy` is B | same | Done |
| API-07 | AC-07 | Edit flips follow-up true to false | Stored `followUpNote` cleared | same | Done |
| API-08 | FR-02 | Edit an unknown action id | 404 `ACTION_NOT_FOUND` | same | Done |
| API-09 | BR-08 | Edit after the Ticket is `CLOSED` | 409, record unchanged | same | Done |
| API-10 | §9.4 | Create, then edit | `ACTION_TAKEN_ADDED` then `ACTION_TAKEN_UPDATED` TicketEvent | same | Done |
| API-11 | BR-14, D-06 | Create and edit | Parent `updatedAt` unchanged | same | Done |
| API-12 | BR-06 | Create with `attachmentNotes` | No `Attachment` row created | same | Done |
| API-13 | §10 #2 | List on a Ticket | Oldest first | same | Done |
| API-14 | §7 | Requester calls a staff actions route | 403 `FORBIDDEN_ROLE` | same | Done |
| API-15 | FR-03, BR-11, AC-09 | Requester lists an owned Ticket's actions | Every field of every record visible | `requesterActions.api.test.ts` | Done |
| API-16 | D-24 | Requester reads another user's Ticket | 404 `TICKET_NOT_ACCESSIBLE`, same body as unknown id | same | Done |
| API-17 | AC-09 | Requester `POST` and `PATCH` on their actions path | 404, not 403 or 405 | same | Done |
| API-18 | FR-06, BR-09, AC-04 | `RESOLVED` with zero actions | 409 `RESOLUTION_REQUIRES_ACTION_TAKEN`, status unchanged | `resolutionGate.api.test.ts` | Done |
| API-19 | AC-05 | `RESOLVED` from `IN_PROGRESS` with one action | 200 | same | Done |
| API-20 | AC-05 | `RESOLVED` from `WAITING_FOR_REQUESTER` with one action | 200 | same | Done |
| API-21 | D-02 | Only action has `result` `ESCALATED` | 200; gate ignores `result` | same | Done |
| API-22 | §5 | Invalid transition to `RESOLVED` (from `NEW`) | Existing `INVALID_STATUS_TRANSITION`, not the gate error | same | Done |
| API-23 | §5 | Any transition not targeting `RESOLVED`, zero actions | Unaffected | same | Done |
| API-24 | §5 | `RESOLVED` → `REOPENED` → `OPEN` → `IN_PROGRESS` → `RESOLVED` | Second pass satisfied by the earlier record | same | Done |
| API-25 | FR-01, §7 | Administrator creates an action and resolves a Ticket | Same behavior as IT Staff | same | Done |
| API-26 | AC-12, FR-10 | New Requester calls `GET /dashboard` | Every count 0, `recentTickets` is `[]` | `dashboard.api.test.ts` | Done |
| API-27 | AC-02, FR-07 | Requester dashboard with mixed data | Only own Tickets counted and listed | same | Done |
| API-28 | §7 | IT Staff on `/dashboard`; Requester on `/staff/dashboard` | 403 both | same | Done |
| API-29 | AC-10, FR-08 | IT Staff dashboard unassigned count | Matches direct count | same | Done |
| API-30 | AC-11 | IT Staff caller | No `userCounts` key | same | Done |
| API-31 | AC-11, FR-09 | Administrator caller | `userCounts` with 3 roles | same | Done |
| API-32 | BR-12 | `?requesterId=` and `?userId=` query overrides | Ignored on both routes | same | Done |
| API-33 | §7 | Administrator reaches existing staff write routes | Allowed after the gate widened to `IT_STAFF` or `ADMINISTRATOR` | same | Done |
| API-34 | AC-13 | Lab 3 valid-transition table with the gate in place | Every row still passes (RESOLVED rows seed one action) | `server/tests/lab-03/staffTicketStatus.api.test.ts` | Done |
| API-35 | §9.5 | Lab 4 migration over Lab 3 seeded data | Every Lab 3 row and id intact; Tickets have zero actions | `server/tests/lab-04/migration.test.ts` | Issue #53 |
| API-36 | §9.6 | Seed verification script | Required seed Tickets present (zero, one, many actions; follow-up; every status and priority) | `server/prisma/verify-seed-lab4.ts` | Done |

### 2.3 Component (client)

| ID | Requirement | What it tests | Expected result | File | Status |
|---|---|---|---|---|---|
| CMP-01 | FR-01 | Staff section, no records | `No Actions Taken yet.` | `ActionsTakenSection.test.tsx` | Done |
| CMP-02 | FR-01 | Staff section lists records | Performer, Result badge, Follow-Up badge shown | same | Done |
| CMP-03 | FR-01 | Create | New record appended without reload | same | Done |
| CMP-04 | BR-05 | Follow-Up Required checked, note empty | Save disabled | same | Done |
| CMP-05 | FR-02, FR-05 | Edit | Updated record shows `Edited by` | same | Done |
| CMP-06 | BR-08 | Ticket locked | Record button disabled | same | Done |
| CMP-07 | §3 | Create fails | Error alert, form open, values kept | same | Done |
| CMP-08 | BR-11 | Attachment notes | Shown on the staff row | same | Done |
| CMP-09 | §3 | Action Date/Time cleared | Save disabled; `postStaffAction` never called | same | Done |
| CMP-10 | §3 | Datetime round trip | Same instant in any timezone | `datetimeLocal.test.ts` | Done |
| CMP-11 | FR-03 | Requester section, no records | Empty text | `ActionsTakenReadOnlySection.test.tsx` | Done |
| CMP-12 | FR-03, BR-11 | Requester section with records | All fields shown, no create or edit control | same | Done |
| CMP-13 | §5 | Requester list fetch fails | Error alert with Retry | same | Done |
| CMP-14 | §3 | Staff detail page | Actions Taken section rendered | `StaffTicketDetailPage.actions.test.tsx` | Done |
| CMP-15 | BR-08 | Closed or Cancelled Ticket on detail page | Record button disabled | same | Done |
| CMP-16 | FR-06, §4 | Server returns `RESOLUTION_REQUIRES_ACTION_TAKEN` | Directed message shown, not the raw error | same | Done |
| CMP-17 | §4 | Different 409 mentioning "action" | Directed message not shown (branches on code) | same | Done |
| CMP-18 | §4 | Unrelated status failure | Existing fallback message | same | Done |
| CMP-19 | §5 | Requester detail page | Read-only section below Comments | `TicketDetailPage.actions.test.tsx` | Done |
| CMP-20 | AC-12, FR-10 | Requester Dashboard, fresh account | Zero-valued cards, not omitted | `RequesterDashboardPage.test.tsx` | Done |
| CMP-21 | FR-07 | Requester Dashboard with data | Four cards with counts, recent list | same | Done |
| CMP-22 | FR-10 | Requester card links | Each links to `/tickets?status=<STATUS>` | same | Done |
| CMP-23 | §6 | Requester Dashboard load error | Alert with Retry | same | Done |
| CMP-24 | FR-08 | Staff Dashboard status cards | New, Open, In Progress, Waiting, Assigned to me | `StaffDashboardPage.test.tsx` | Done |
| CMP-25 | FR-08 | Staff Dashboard priority cards | Low, Medium, High, Urgent | same | Done |
| CMP-26 | AC-11 | IT Staff, no `userCounts` | Role card not rendered | same | Done |
| CMP-27 | FR-09 | Administrator with `userCounts` | Role card rendered | same | Done |
| CMP-28 | FR-10 | Staff card links | Each links to the filtered Ticket Queue | same | Done |
| CMP-29 | FR-10 | My Tickets opened with `?status=` | Initial filter hydrated | `MyTicketsPage.hydration.test.tsx` | Done |
| CMP-30 | §9 | My Tickets without a query string | Unchanged unfiltered default | same | Done |
| CMP-31 | FR-10 | Ticket Queue with `itPriority`, `ownerId`, `unassigned` | Initial filters hydrated | `StaffTicketQueuePage.hydration.test.tsx` | Done |
| CMP-32 | §8 | Navigation shows a Dashboard entry per role; landing route per role; wrong-role dashboard redirects | Matches the §8 table | `AppShell.nav.test.tsx`, `LoginPage` landing case | Issue #56 |
| CMP-33 | §10 | Axe-style accessibility check on both dashboards and the Actions Taken form | No serious violation | `client/tests/lab-04/a11y.test.tsx` | Issue #57 |

### 2.4 End-to-End (Playwright)

| ID | Requirement / AC | Flow | Expected result | File | Status |
|---|---|---|---|---|---|
| E2E-01 | AC-01, AC-03 | IT Staff records an Action Taken; a second IT Staff edits it | Both visible; performer unchanged, editor shown | `e2e/lab-04/action-taken.spec.ts` | Issue #54 |
| E2E-02 | AC-04, AC-05 | Resolve with no action → rejection message → record action → resolve | Message first, then success | `e2e/lab-04/resolution-gate.spec.ts` | Issue #55 |
| E2E-03 | AC-09 | Requester opens an owned Ticket | Actions visible, no create or edit control | `e2e/lab-04/requester-actions.spec.ts` | Issue #54 |
| E2E-04 | AC-02, FR-10 | Requester signs in, lands on dashboard, clicks a card | Filtered My Tickets | `e2e/lab-04/dashboards.spec.ts` | Issue #56 |
| E2E-05 | AC-10, AC-11, FR-09 | IT Staff and Administrator dashboards | Counts match seed; only Administrator sees user counts | same | Issue #56 |
| E2E-06 | AC-13 | Full Lab 1-3 Playwright suite | Same pass count as before Lab 4 | `e2e/lab-0[1-3]/*` | Issue #57 |
| E2E-07 | §10 | Screenshots at 375, 768, 1280 px of every new or changed screen, console clean | No clipped control, no console error | `e2e/lab-04/visual-states.spec.ts` | Issue #57 |

## 3. Traceability

Every requirement appears in at least one row above.

| Requirement | Tests |
|---|---|
| FR-01 | UNIT-01 to UNIT-10, API-01 to API-05, API-25, CMP-01 to CMP-03 |
| FR-02 | API-06 to API-09, CMP-05 |
| FR-03 | API-15 to API-17, CMP-11, CMP-12, E2E-03 |
| FR-04, FR-05 | API-01, API-02, API-06, UNIT-12 |
| FR-06 | API-18 to API-25, CMP-16 to CMP-18, E2E-02 |
| FR-07 | UNIT-15, API-27, CMP-21 |
| FR-08 | UNIT-16 to UNIT-19, API-29, CMP-24, CMP-25 |
| FR-09 | UNIT-20, API-31, CMP-27, E2E-05 |
| FR-10 | UNIT-13, API-26, CMP-20, CMP-22, CMP-28 to CMP-31, E2E-04 |
| BR-01 to BR-04 | API-04, API-06, UNIT-12 |
| BR-05 | UNIT-04 to UNIT-06, API-07, CMP-04 |
| BR-06 | UNIT-10, API-12 |
| BR-07 | UNIT-07, UNIT-08 |
| BR-08 | API-05, API-09, CMP-06, CMP-15 |
| BR-09, BR-10 | API-18 to API-24 |
| BR-11 | API-15, CMP-08, CMP-12 |
| BR-12, BR-13 | UNIT-14, UNIT-18, API-32 |
| BR-14, D-06 | UNIT-11, API-11 |
| AC-01 to AC-12 | see the AC column above |
| AC-13 | API-34, E2E-06 |

## 4. Exit Criteria

- Every `Done` test passes locally on the commit that ships it, and every `Issue #N` row is written and
  passing before that issue's pull request is marked ready for review.
- The documented final run records the exact pass counts for the server, client, and Playwright suites,
  the configuration used, and the commit hash (Issue #57).
- No Lab 1-3 test is deleted or loosened to make a Lab 4 test pass. The one extended Lab 3 test is
  listed in §1 with its reason.
