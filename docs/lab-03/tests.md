# Lab 3 Test Plan

Extends `docs/lab-02/tests.md`. Written before implementation (Test DD), driving TDD, per the same
discipline Lab 2 used — this plan is not reconstructed afterward from whatever the coding agent
happened to generate.

## 1. Test Strategy

Every Functional Requirement, Business Rule, and Acceptance Criterion in `specification.md` has at
least one automated test below. Tooling is unchanged from Lab 2: Vitest (client: jsdom + Testing
Library; server: + Supertest) and Playwright for E2E, against the file layout the labsheet's §12
requires:

- `server/tests/lab-03/auth.api.test.ts` — login, logout, `/me`, change-password
- `server/tests/lab-03/authorization.api.test.ts` — session resolution, `mustChangePassword` gate,
  role gate (`requireRole`), Requester-ownership 404 vs role-mismatch 403 distinction
- `server/tests/lab-03/staff-queue.api.test.ts` — `GET /api/v1/staff/tickets`
- `server/tests/lab-03/staff-ticket-detail.api.test.ts` — `GET`/owner/priority/status endpoints
  under `/api/v1/staff/tickets/:id/*`
- `server/tests/lab-03/comments-notes.api.test.ts` — Public Comments (Requester + Staff endpoints)
  and Internal Notes
- `server/tests/lab-03/users-admin.api.test.ts` — `/api/v1/admin/users` list/create/edit/password
- `client/tests/lab-03/Login.test.tsx`
- `client/tests/lab-03/ChangePassword.test.tsx`
- `client/tests/lab-03/StaffTicketQueue.test.tsx`
- `client/tests/lab-03/StaffTicketDetail.test.tsx`
- `client/tests/lab-03/UserManagement.test.tsx`
- `e2e/lab-03/authentication.spec.ts`
- `e2e/lab-03/staff-ticket-flow.spec.ts`
- `e2e/lab-03/user-administration.spec.ts`

Additionally, a migration/regression check runs against a database seeded by the Lab 2 seed script
*before* the Lab 3 migration is applied, then re-checked after (`server/tests/lab-03/
migrationRegression.test.ts`) — this is the concrete evidence for AC-12 and cannot be satisfied by
a fresh-database test alone, since the whole point is proving existing Lab 2 data survives.

**Harness note carried over from Lab 2:** server tests continue to run against the isolated
`toktickit_test` database with migration + seed in global setup; E2E continues to require
`server/.env.e2e` / `client/.env.e2e` pointing at `toktickit_e2e` on the dedicated E2E port. Lab 3
adds no new environment-variable requirement beyond what login/session needs already covered by
`DATABASE_URL` (bcrypt and the session-hashing logic use no external service).

## 2. Planned Tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File |
|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-08 | Password hashing/verification helper | bcrypt hash never equals plaintext; `compare` succeeds only for the original password | `server/tests/lab-03/auth.api.test.ts` (unit-style block) |
| UNIT-02 | Unit | specification.md §4.1 | Password policy validator boundaries (length, missing upper/lower/digit/special) | Each boundary case accepted/rejected correctly | `server/tests/lab-03/auth.api.test.ts` |
| UNIT-03 | Unit | §4.4 transition matrix | Transition-map lookup for every (from, to) pair in the matrix, plus at least 3 disallowed pairs | Allowed pairs return true; disallowed pairs (incl. any target from `CANCELLED`, any target other than `REOPENED`→`OPEN`) return false | `server/tests/lab-03/staff-ticket-detail.api.test.ts` (unit-style block) |
| UNIT-04 | Unit | BR-13, A-05 | Email normalization (lowercasing) applied consistently at login, create-user, and edit-user | Same email in different casing always resolves to the same user / same uniqueness conflict | `server/tests/lab-03/users-admin.api.test.ts` |
| API-01 | API | AC-01 | Login with valid credentials | 200, `ttk_session` cookie set (httpOnly), body has id/email/displayName/role/mustChangePassword | `server/tests/lab-03/auth.api.test.ts` |
| API-02 | API | AC-05 | Login with unknown email / wrong password | Identical 401 `INVALID_CREDENTIALS` body for both cases | `server/tests/lab-03/auth.api.test.ts` |
| API-03 | API | AC-06 | Login with correct credentials for a deactivated user | Distinct 403 `ACCOUNT_DEACTIVATED`, not the generic message | `server/tests/lab-03/auth.api.test.ts` |
| API-04 | API | AC-07 | Logout, then reuse the same cookie | 200 on logout; the same cookie gets 401 on the next protected call | `server/tests/lab-03/auth.api.test.ts` |
| API-05 | API | AC-08 | Call a protected endpoint with an expired or a revoked session row | 401 in both cases | `server/tests/lab-03/authorization.api.test.ts` |
| API-06 | API | AC-02, AC-09, AC-10 | Mandatory change-password flow: blocked-while-required, wrong current password, success | 403 `PASSWORD_CHANGE_REQUIRED` on other endpoints while true; 422 on wrong current password; 200 and `mustChangePassword: false` and same session still valid after a correct change | `server/tests/lab-03/auth.api.test.ts` |
| API-07 | API | BR-11 | Deactivating a user mid-session | Their next request after deactivation gets 401, even though their `Session` row is still unexpired/unrevoked | `server/tests/lab-03/authorization.api.test.ts` |
| API-08 | API | AC-03, BR-03, BR-12 | Requester supplies a foreign `requesterId`/`ownerId`-shaped override on a Lab 2 Requester endpoint | Response still scoped to the authenticated identity; override ignored | `server/tests/lab-03/authorization.api.test.ts` |
| API-09 | API | AC-04, AC-24, BR-23 | Requester calls a Staff-only route (Internal Notes, Ticket Queue, owner/priority/status) | 403 `FORBIDDEN_ROLE` on every one, no ticket/note data in any response body | `server/tests/lab-03/authorization.api.test.ts` |
| API-10 | API | BR-23 | IT Staff calls an Admin-only route; Administrator calls a Staff-only route | 403 `FORBIDDEN_ROLE` on both directions | `server/tests/lab-03/authorization.api.test.ts` |
| API-11 | API | AC-12 | Lab 2 seeded tickets/attachments/requesters, checked before and after the Lab 3 migration | Every id, relationship, and status value maps correctly to its renamed enum label; requesters can log in and see the same tickets | `server/tests/lab-03/migrationRegression.test.ts` |
| API-12 | API | FR-12 | Every Lab 2 Requester endpoint (create/list/detail/attachments) called with a session cookie instead of `x-dev-user-id` | Behavior identical to Lab 2's documented results | `server/tests/lab-03/authorization.api.test.ts` (smoke pass over the Lab 2 endpoints under session auth) |
| API-13 | API | AC-13 | Requester posts a Public Comment on their own ticket | 201, comment saved with authenticated author, appears in `GET .../comments` | `server/tests/lab-03/comments-notes.api.test.ts` |
| API-14 | API | BR-22 | Requester attempts to post a Public Comment on a ticket they do not own | 404, identical to an unknown ticket id (D-24 pattern, not 403) | `server/tests/lab-03/comments-notes.api.test.ts` |
| API-15 | API | AC-14, A-08 | Requester posts with `problemAppearsResolved: true` | Stored body carries the exact fixed server-controlled prefix; ticket status unchanged; a client-submitted body that itself starts with that literal text (without the flag) is stored as plain text, not specially flagged | `server/tests/lab-03/comments-notes.api.test.ts` |
| API-16 | API | BR-20, BR-21 | Post an empty/whitespace-only Comment or Note; attempt to edit or delete an existing one | 422 on empty content; no edit/delete route exists (asserted by a 404/405 on an attempted call, or by route-table introspection) | `server/tests/lab-03/comments-notes.api.test.ts` |
| API-17 | API | AC-15, AC-16 | Ticket Queue with no filters, then with search+status+itPriority+ownerId together | Every requester's tickets listed with no filters; AND semantics across all four filters | `server/tests/lab-03/staff-queue.api.test.ts` |
| API-18 | API | §4.6 | Ticket Queue `ownerId=unassigned` and an invalid `ownerId` value | `unassigned` filters to null-owner tickets; an invalid id value is rejected 422, never silently ignored | `server/tests/lab-03/staff-queue.api.test.ts` |
| API-19 | API | AC-17, BR-15 | IT Staff claims/assigns an unowned `NEW` ticket | Ticket becomes `OPEN` with the new `ownerId`, in one transaction | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-20 | API | AC-18 | Direct `status: OPEN` request on a `NEW`, unowned ticket | 409 `INVALID_STATUS_TRANSITION` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-21 | API | AC-19 | One allowed transition per row of §4.4's matrix, and at least 3 disallowed transitions | Allowed: 200 and status updates. Disallowed: 409, status unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-22 | API | AC-20 | Change IT Priority or ownership on a `CLOSED` and on a `CANCELLED` ticket | Both rejected 409 `TICKET_LOCKED`; `CLOSED`→`REOPENED` still succeeds via the status endpoint | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-23 | API | AC-21, BR-20 | `REOPENED` from `RESOLVED`, from `CLOSED`, and an attempted `REOPENED` from every other status | First two succeed; every other source status is rejected 409 | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-24 | API | AC-22, BR-17 | Set IT Priority on a non-terminal ticket | Saved; Requested Priority unchanged | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-25 | API | BR-16, A-09 | Attempt to set `ownerId` to `null`/empty on an already-owned ticket | Rejected 422 — no unassign path exists | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-26 | API | BR-14 | Assign a ticket to a Requester id, or to an inactive IT Staff id | Both rejected 409 `INVALID_OWNER` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-27 | API | AC-23 | IT Staff posts a Public Comment and an Internal Note on a ticket they do not own/aren't assigned to | Both succeed (shared queue, no ownership restriction for staff) | `server/tests/lab-03/comments-notes.api.test.ts` |
| API-28 | API | A-10 | IT Staff calls `GET .../attachments` under the staff namespace | 200, read-only list; no upload/remove route exists under `/staff/tickets/:id/attachments` | `server/tests/lab-03/staff-ticket-detail.api.test.ts` |
| API-29 | API | AC-25 | Admin user list, unfiltered, then with search and with a role filter | Full list, then correctly narrowed results for each filter and their combination | `server/tests/lab-03/users-admin.api.test.ts` |
| API-30 | API | AC-26, BR-24, BR-25 | Create a user with one role and a policy-valid initial password | 201; `mustChangePassword: true`; login with that password succeeds only after the mandatory change | `server/tests/lab-03/users-admin.api.test.ts` |
| API-31 | API | AC-27, BR-13 | Create/edit a user with an email already used by another user | 409 `EMAIL_ALREADY_EXISTS`, no row created/changed | `server/tests/lab-03/users-admin.api.test.ts` |
| API-32 | API | AC-28, BR-27 | Administrator attempts to deactivate their own account | 409 `SELF_DEACTIVATION_BLOCKED`, account remains active | `server/tests/lab-03/users-admin.api.test.ts` |
| API-33 | API | AC-29, BR-28 | Deactivate, or change the role of, the last remaining active Administrator | 409 `LAST_ADMIN_PROTECTED` in both cases, account/role unchanged | `server/tests/lab-03/users-admin.api.test.ts` |
| API-34 | API | AC-30, BR-26 | Administrator sets a new initial password for a user who has an active session | `mustChangePassword: true`; that user's prior session cookie gets 401 on its next use | `server/tests/lab-03/users-admin.api.test.ts` |
| API-35 | API | BR-29 | Deactivate a user, then attempt any hard-delete-shaped request against them | No delete route exists for `User`; deactivated row still present in `GET /admin/users` | `server/tests/lab-03/users-admin.api.test.ts` |
| UI-01 | UI | AC-01, AC-05, AC-06 | Login form: success, invalid credentials, deactivated account | Correct navigation on success; correct distinct error banner text per failure case; password field cleared on failure | `client/tests/lab-03/Login.test.tsx` |
| UI-02 | UI | AC-02, AC-09, AC-10 | Change Password: mandatory-flow render, wrong current password, success | Screen renders when `mustChangePassword` true; field error on wrong current password; navigates to role home on success | `client/tests/lab-03/ChangePassword.test.tsx` |
| UI-03 | UI | FR-07, AC-11 | Role-specific navigation render for each of the three roles | Only that role's nav items render; Logout always renders | `client/tests/lab-03/ChangePassword.test.tsx` (shell render assertions) |
| UI-04 | UI | AC-15, AC-16 | Ticket Queue filter bar (search/status/itPriority/owner) and Clear filters | Refetch triggers on each control; Clear filters resets and disables itself when nothing is active | `client/tests/lab-03/StaffTicketQueue.test.tsx` |
| UI-05 | UI | §7 | Ticket Queue at a sub-768px viewport | Renders as stacked cards, no horizontal scroll | `client/tests/lab-03/StaffTicketQueue.test.tsx` |
| UI-06 | UI | AC-17, AC-18 | Staff Ticket Detail owner control: claim on an unowned `NEW` ticket, and the disabled status-to-`OPEN` state before claiming | Claim action calls the owner endpoint and updates the visible status badge; status select is disabled with the "assign an owner first" tooltip pre-claim | `client/tests/lab-03/StaffTicketDetail.test.tsx` |
| UI-07 | UI | AC-19 | Staff Ticket Detail status select only offers matrix-valid options for the current status | Options rendered exactly match `specification.md` §4.4's allowed-target list for that status | `client/tests/lab-03/StaffTicketDetail.test.tsx` |
| UI-08 | UI | AC-20 | Staff Ticket Detail IT Priority/status controls on a Closed/Cancelled ticket | Controls disabled with the locked-state tooltip, except status→Reopened remains available on Closed | `client/tests/lab-03/StaffTicketDetail.test.tsx` |
| UI-09 | UI | BR-04, AC-04, AC-24 | Staff Ticket Detail renders both Public Comments and Internal Notes sections with visually distinct surfaces; Requester Ticket Detail renders only Public Comments | Both sections present for staff; no Internal Notes section/DOM node anywhere in the Requester Ticket Detail page | `client/tests/lab-03/StaffTicketDetail.test.tsx`; `client/tests/lab-02/TicketDetail.test.tsx` (extended) |
| UI-10 | UI | AC-25 | User Management list render, search, and role filter | Correct rows for each filter state | `client/tests/lab-03/UserManagement.test.tsx` |
| UI-11 | UI | AC-26, AC-27 | Create User form: success and duplicate-email rejection | Success closes the panel and refetches the list; duplicate email shows the field-level error and keeps the panel open with entered values | `client/tests/lab-03/UserManagement.test.tsx` |
| UI-12 | UI | AC-28, AC-29 | Deactivate action disabled for the signed-in Administrator's own row and for the last active Administrator | Button rendered with `aria-disabled` and the correct tooltip text in each case | `client/tests/lab-03/UserManagement.test.tsx` |
| UI-13 | UI | AC-30 | Set New Password dialog | Submitting shows the "must change at next login" success alert and does not touch the main edit form's other fields | `client/tests/lab-03/UserManagement.test.tsx` |
| E2E-01 | E2E | AC-01, AC-02, AC-09 | Full authentication journey: log in as a seeded `mustChangePassword: true` user, get redirected to Change Password, complete it, land on the role's home route, log out, confirm the login screen reappears and the old session no longer works | Every step succeeds in order | `e2e/lab-03/authentication.spec.ts` |
| E2E-02 | E2E | AC-12 | Log in as a Lab-2-seeded Requester after the Lab 3 migration | The same tickets/attachments from before Lab 3 are still visible and unchanged | `e2e/lab-03/authentication.spec.ts` |
| E2E-03 | E2E | AC-13, AC-14, AC-17, AC-19, AC-21, AC-23 | Full staff journey: log in as IT Staff, open the Queue, claim an unowned ticket (status becomes Open), move it to In Progress, set IT Priority, post a Public Comment and an Internal Note, move it to Resolved, reopen it, and confirm the Requester (logged in separately) sees the Public Comment and the "problem appears resolved" flag on their own comment but never sees the Internal Note | Every step succeeds; Internal Note content never appears anywhere in the Requester's session | `e2e/lab-03/staff-ticket-flow.spec.ts` |
| E2E-04 | E2E | AC-25, AC-26, AC-27, AC-28, AC-29, AC-30 | Full admin journey: log in as Administrator, create a user, attempt a duplicate-email create (rejected), edit the created user, reset their password, attempt self-deactivation (rejected), attempt to deactivate the last Administrator using a second seeded admin account made inactive first (rejected), and finally deactivate the newly created user | Every step succeeds/fails exactly as specified, at desktop and mobile viewports | `e2e/lab-03/user-administration.spec.ts` |

## 3. Acceptance-Criterion Traceability

Every criterion in `specification.md` §8 maps to at least one planned test above.

| Requirement / Feature | AC(s) | Test(s) |
|---|---|---|
| Login (FR-01–FR-02) | AC-01, AC-05, AC-06 | API-01, API-02, API-03, UI-01, E2E-01 |
| Current identity, logout (FR-03–FR-04) | AC-07, AC-08 | API-04, API-05, E2E-01 |
| Mandatory password change (FR-05–FR-06) | AC-02, AC-09, AC-10 | API-06, UI-02, E2E-01 |
| Navigation/authorization (FR-07–FR-09) | AC-03, AC-04, AC-11, AC-24 | API-08, API-09, API-10, UI-03, UI-09 |
| Migration (FR-10–FR-11) | AC-12 | API-11, E2E-02 |
| Requester regression + Public Comments (FR-12–FR-14) | AC-13, AC-14 | API-12, API-13, API-14, API-15, API-16, E2E-03 |
| IT Staff Ticket Queue (FR-15–FR-16) | AC-15, AC-16 | API-17, API-18, UI-04, UI-05 |
| IT Staff ownership/priority/status (FR-17–FR-20, §4.4) | AC-17, AC-18, AC-19, AC-20, AC-21, AC-22 | API-19 to API-26, UNIT-03, UI-06, UI-07, UI-08, E2E-03 |
| IT Staff comments/notes/attachments (FR-21–FR-23) | AC-23, AC-24 | API-27, API-28, UI-09, E2E-03 |
| Administrator user management (FR-24–FR-28) | AC-25 to AC-30 | API-29 to API-34, UI-10 to UI-13, E2E-04 |
| Safety rules (BR-27–BR-29) | AC-28, AC-29 | API-32, API-33, API-35, UI-12, E2E-04 |
| Responsive (§10) | AC-31 | UI-05, E2E-03, E2E-04 (mobile projects) |
| Zen Green tokens (`ui-spec.md` §1–§2) | — (visual, not a numbered AC) | manual checklist, §4 below |
| Seed baseline (`specification.md` §6.2) | AC-12 | migration/seed check, folded into API-11 setup |

## 4. Responsive and Visual Checklist

Manual + Playwright-screenshot verification, at desktop (≥ 992 px), tablet (768–991 px), and mobile
(< 768 px) viewports, for Login, Change Password, the Ticket Queue, Staff Ticket Detail, and User
Management:

- No clipped labels, overlapping messages, hidden buttons, or unreadable content at any size.
- No horizontal page scrolling at any breakpoint.
- Ticket Queue and User Management both switch table → stacked-card layout at the 768 px boundary,
  same as My Tickets in Lab 2.
- Zen Green token verification (same values as Lab 2's checklist): header/primary buttons
  `#006B3C`; secondary actions/focus ring `#0B7A46`; hover/selected/info-banner `#EAF6EF`; page
  background `#F5F7F6`.
- The new `REOPENED` badge renders the amber warning surface with its own icon, distinct from
  `IN_PROGRESS` by icon and label, never by color alone.
- Internal Notes render on a visually distinct surface from Public Comments at every viewport, with
  the "visible only to IT Staff and Administrators" label always present and legible.
- Screenshot paths follow `artifacts/lab-03/screenshots/{authentication,staff-queue,
  staff-ticket-detail,user-management}/`.

## 5. Test Commands

```bash
# server (requires server/.env.test — see server/.env.example for the connection-string shape)
cd server && npm test
cd server && npm run test:coverage

# client
cd client && npm test

# e2e (requires server/.env.e2e and client/.env.e2e)
npm run test:e2e
```

## 6. Known Limitations or Deferred Tests

- No dedicated test exercises CSRF resistance directly (A-03's SameSite+JSON-content-type
  reasoning is an architectural argument, not something a same-origin Supertest/Playwright suite
  can easily simulate as a genuine cross-site attacker) — noted here rather than silently omitted.
- Session-expiry tests (API-05) fabricate an already-expired `Session` row directly via Prisma
  rather than waiting 12 real hours; this is a deliberate test-speed trade-off, not a gap in what
  is asserted.
- Rate limiting / account lockout has no test because it is explicitly out of scope (BR-06,
  Assumption A-14) — its absence is intentional, not an oversight.
- Load/performance testing is out of scope for Lab 3, unchanged from Lab 2's position.
- Cross-browser E2E remains Chromium-only, unchanged from Lab 2.
