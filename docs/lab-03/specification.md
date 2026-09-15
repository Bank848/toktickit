# Lab 3 Sprint Engineering Specification

**Status:** Authored 2026-09-08, against `Lab_3_sheet.pdf` (18 pages) and the actual Lab 2
increment already merged to `main`. This document extends `docs/lab-02/specification.md` — every
Lab 2 Functional Requirement, Business Rule, and Acceptance Criterion continues to hold except
where explicitly superseded below (BR-14 of Lab 2, the dev-header identity rule, is superseded by
BR-12 here). Do not re-derive Lab 2 behavior from this document alone; read both.

Companion deliverables: `ui-spec.md`, `api-spec.md`, `tests.md`, plus `reviewer.md` and `ai-use.md`
(produced at submission time, not authored ahead of implementation).

GitHub Issue decomposition for this sprint: #34 (this engineering contract), #35 (data
model/migration/seed), #36 (authentication foundation), #37 (Requester regression), #38 (IT Staff
Ticket Queue), #39 (IT Staff Ticket Detail operations), #40 (Administrator user management), #41
(E2E/visual/reviewer close-out).

## 1. Sprint Goal

Replace the Lab 2 Development Requester selector with real, session-based authentication and
ship the first operational IT Staff and Administrator workflows: a user signs in with an email and
password, changes an initial password before entering the application if required, and sees only
the navigation and actions permitted for their role. Requesters keep every Lab 2 ticket/attachment
capability and gain Public Comments. IT Staff get a shared Ticket Queue, Ticket Detail with
ownership/IT Priority/status control, Public Comments, and Internal Notes. Administrators get a
minimalist User Management screen. Every protected operation is enforced server-side; hiding a
button client-side is never treated as authorization.

## 2. Stakeholder Request Interpretation

The temporary Requester selector proved the Lab 2 ticket flow works, but it is not a security
boundary and it only ever produced Requesters. The system now needs three real, authenticated
roles. Administrators need a simple way to create accounts, assign exactly one role each, edit
basic account details, and issue or reset an initial password, without dragging in departments,
bulk operations, or self-registration. A user who receives an initial password must be forced to
choose their own password before they can do anything else. Requesters keep working exactly as
they did in Lab 2, but their identity now comes from a real login instead of a picker, and they can
now talk to IT Staff through Public Comments. IT Staff need a shared queue to find unclaimed or
owned work, a way to claim or hand off a Ticket, control over IT Priority and the Ticket's
operational status, and a place to write comments the Requester can see and notes the Requester
cannot. A Requester may say a problem looks fixed, but only IT Staff can make that judgment
official by resolving or closing the Ticket. None of this is real unless the server enforces it
independently of whatever the UI happens to show or hide.

## 3. Scope

### Included

- Email/password login, logout, current-user retrieval, and mandatory first-login password change
- Role-based client navigation and, independently, server-side authorization and ownership checks
  for Requester, IT Staff, and Administrator
- Migration of the Lab 2 Development Requester identity to the authenticated `User` model, with
  every existing Lab 2 Ticket, Attachment, and Requester relationship preserved
- Continued Requester functions from Lab 2 (create ticket, My Tickets, Ticket Detail, attachments),
  now driven by the authenticated session instead of `x-dev-user-id`
- Requester Public Comments and the "problem appears resolved" indication
- IT Staff Ticket Queue: search, filter, sort, pagination, across every Requester's tickets
- IT Staff Ticket Detail: claim/reassign ownership, set IT Priority, change status along the
  defined transition matrix, post Public Comments, write Internal Notes, view existing Attachments
- Minimalist Administrator User Management: list, create, edit basic fields, activate/deactivate,
  assign one role, set a new initial password
- Zen Green UI extensions for every new/changed screen, reusing the Lab 2 token set and component
  conventions

### Excluded

- Email invitations, password-reset email, multi-factor authentication, social login, single
  sign-on
- Self-registration or Requester-created accounts
- Actions Taken (the formal service-action log) — deferred to Lab 4, along with the rule that
  blocks Resolved while Actions Taken remain incomplete
- Formal SLA calculation, escalation rules, notification services
- Dashboards and KPI analytics beyond the queue's own result count
- Multi-tenant organizations, departments, or customer administration
- Production-grade deployment or cloud infrastructure changes
- Multiple roles assigned to one user
- User deletion, bulk user operations, user import/export, account-history screens
- Department, organization, profile-photo, or other extended user-profile fields
- Email delivery of initial passwords or reset links
- Account unlocking, administrator approval workflows, advanced identity-management functions
- Mandatory pagination, multi-column sorting, or multiple simultaneous filters on the user list
- Account lockout or rate limiting after repeated failed login attempts
- IT Staff uploading or removing Attachments (Ticket Detail shows existing Attachments read-only
  for IT Staff in Lab 3; upload/remove by staff is a later lab's addition)
- Editing or deleting a posted Public Comment or Internal Note (both are append-only in Lab 3)
- Un-assigning a Ticket back to no owner once it has been claimed

## 4. Functional Requirements

### Authentication and Session

- **FR-01** The system shall authenticate a user via `POST /api/v1/auth/login` with an email and
  password; only an active user whose submitted password matches the stored bcrypt hash succeeds.
- **FR-02** On successful login the system shall create a `Session` row and return its token to the
  client only inside an httpOnly cookie; the raw token is never present in any JSON response body
  or stored anywhere in plaintext.
- **FR-03** The system shall expose `GET /api/v1/me`, returning the current authenticated user's
  id, email, displayName, role, and mustChangePassword, resolved solely from the session cookie.
- **FR-04** The system shall support `POST /api/v1/auth/logout`, which invalidates the current
  session so the same cookie can never authenticate again.
- **FR-05** A user whose `mustChangePassword` is true shall be blocked from every endpoint except
  `auth/logout`, `auth/change-password`, and `me`, until a new password is saved.
- **FR-06** The system shall support `POST /api/v1/auth/change-password`, requiring the current
  password, a new password meeting the password policy (§4.4 below), and a matching confirmation;
  on success `mustChangePassword` is cleared and the existing session remains valid.

### Authorization and Navigation

- **FR-07** The client shall show only the navigation items and actions permitted for the
  authenticated user's role (Requester: My Tickets, Create Ticket; IT Staff: My Queue; Administrator:
  Users).
- **FR-08** The server shall independently enforce every role and ownership restriction on every
  protected endpoint; no endpoint's authorization decision may depend on a client-supplied role,
  user id, or requester id.
- **FR-09** A request for a ticket-scoped resource that is inaccessible because of Requester
  ownership (Lab 2's D-24 pattern) shall return the identical 404 used for a ticket that does not
  exist. A request against an entire role-gated route namespace (Staff-only or Admin-only) from a
  caller of the wrong role shall return 403 instead, since no ticket's existence is at stake there.

### Migration from Development Requester Identity

- **FR-10** The Development Requester Selection screen, its client-side context/state, and its
  `/api/v1/dev/*` backend endpoints shall be removed entirely; a Requester's identity for every
  ticket operation shall come exclusively from the authenticated session.
- **FR-11** Every `User` row created by the Lab 2 seed shall keep its existing id, so every Lab 2
  `Ticket.requesterId` foreign key and every seeded Requester's ticket history remains valid and
  reachable after that Requester gains a password and logs in under Lab 3.

### Requester Regression and Public Comments

- **FR-12** Every Lab 2 Requester capability (create ticket, My Tickets, Ticket Detail, attachment
  upload/download/removal) shall continue to work unchanged in behavior, using the authenticated
  Requester's id in place of the `x-dev-user-id` header.
- **FR-13** A Requester shall be able to post a Public Comment on a ticket they own.
- **FR-14** A Requester shall be able to indicate that a reported problem appears resolved, without
  that action changing the Ticket's status.

### IT Staff Ticket Queue

- **FR-15** The system shall expose a Ticket Queue to IT Staff (`GET /api/v1/staff/tickets`) listing
  every Ticket regardless of Requester, with search, status filter, IT Priority filter, sort, and
  pagination.
- **FR-16** The Ticket Queue shall show, at minimum, Ticket Number, Created Date, Summary,
  Category, Requested Priority, IT Priority, Current Status, and Ticket Owner (or "Unassigned").

### IT Staff Ticket Detail and Operations

- **FR-17** IT Staff shall be able to open any Ticket's Detail view (`GET
  /api/v1/staff/tickets/:id`), regardless of who requested it or who owns it.
- **FR-18** IT Staff shall be able to claim an unowned Ticket for themselves or assign/reassign it
  to another active IT Staff or Administrator user.
- **FR-19** IT Staff shall be able to set or change a Ticket's IT Priority independently of its
  Requested Priority.
- **FR-20** IT Staff shall be able to change a Ticket's status along the transition matrix defined
  in §4.5.
- **FR-21** IT Staff shall be able to post a Public Comment on any Ticket.
- **FR-22** IT Staff shall be able to write an Internal Note on any Ticket.
- **FR-23** IT Staff shall be able to retrieve a Ticket's Internal Notes and Public Comments and its
  existing Attachments (read-only).

### Administrator User Management

- **FR-24** The system shall allow an Administrator to retrieve the user list
  (`GET /api/v1/admin/users`), with search by name or email and an optional role filter.
- **FR-25** The system shall allow an Administrator to create a user with a name, email, exactly one
  role, an activation state, and an initial password.
- **FR-26** The system shall allow an Administrator to edit a user's name, email, role, and
  activation state.
- **FR-27** The system shall allow an Administrator to set a new initial password for an existing
  user, which that user must change at their next login.
- **FR-28** The system shall prevent an Administrator from deactivating their own account, and shall
  prevent any edit that would leave zero active Administrators.

### 4.1 Password Policy

A password (initial, set by an Administrator, or chosen by a user via change-password) must be at
least 8 characters and include at least one uppercase letter, one lowercase letter, one digit, and
one special character (matching the rules shown in the labsheet's §8.1 Change Password mockup).
This policy is enforced server-side on every endpoint that accepts a new password
(`auth/change-password`, `admin/users` create, `admin/users/:id/password`); a client-side checklist
is advisory only.

### 4.2 Ticket Ownership, Priority, and Status Model

- A Ticket may have zero or one primary Ticket Owner, who must be an active `IT_STAFF` or
  `ADMINISTRATOR` user at the moment of assignment.
- Requested Priority is fixed at creation (Lab 2 behavior, unchanged). IT Priority starts equal to
  Requested Priority (Lab 2 behavior, unchanged) and may be changed at any later time by IT Staff,
  until the Ticket reaches `CLOSED` or `CANCELLED`.
- The required Ticket statuses, renamed and extended from Lab 2, are: `NEW`, `OPEN`, `IN_PROGRESS`,
  `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED`.

### 4.3 Public Comments and Internal Notes

- Public Comments are shared communication on a Ticket, visible to its Requester, to IT Staff, and
  to an Administrator (who has no dedicated ticket-viewing screen in Lab 3, but is never
  code-path-excluded from seeing one if a later lab adds that screen).
- Internal Notes are operational notes visible only to IT Staff and Administrator.
- Both are append-only in Lab 3: no edit or delete endpoint exists for either. Empty or
  whitespace-only content is rejected.
- Each entry records its author and creation time from the authenticated session, never from the
  request body.
- A Requester may post a Public Comment only on a Ticket they own. IT Staff may post a Public
  Comment or an Internal Note on any Ticket, since the Ticket Queue is shared.

### 4.4 Ticket Status Transition Matrix

| From | Allowed To | Who | Trigger |
|---|---|---|---|
| `NEW` | `OPEN` | IT Staff | Automatic side effect of the Ticket's first ownership assignment (claim or assign) — never a direct status write while unowned |
| `NEW` | `CANCELLED` | IT Staff | Direct status change; no owner required |
| `OPEN` | `IN_PROGRESS` | IT Staff | Direct status change |
| `OPEN` | `WAITING_FOR_REQUESTER` | IT Staff | Direct status change |
| `OPEN` | `CANCELLED` | IT Staff | Direct status change |
| `IN_PROGRESS` | `WAITING_FOR_REQUESTER` | IT Staff | Direct status change |
| `IN_PROGRESS` | `RESOLVED` | IT Staff | Direct status change |
| `WAITING_FOR_REQUESTER` | `IN_PROGRESS` | IT Staff | Direct status change (staff resumes work) |
| `WAITING_FOR_REQUESTER` | `RESOLVED` | IT Staff | Direct status change |
| `WAITING_FOR_REQUESTER` | `CANCELLED` | IT Staff | Direct status change |
| `RESOLVED` | `CLOSED` | IT Staff | Direct status change (formal close) |
| `RESOLVED` | `REOPENED` | IT Staff | Direct status change |
| `CLOSED` | `REOPENED` | IT Staff | Direct status change |
| `REOPENED` | `OPEN` | IT Staff | Direct status change (only outbound transition from `REOPENED`) |

Any transition not listed above is rejected with 409. `CANCELLED` has no outbound transition in Lab
3 (terminal). A Requester never triggers any status transition directly; their only lever is FR-14's
non-status-changing "problem appears resolved" indication. No transition is available to an
Administrator in Lab 3 — ticket workflow stays IT Staff's responsibility per the role table in §4.6.

### 4.5 Business Rules

- **BR-01** Only an active user with valid credentials may authenticate.
- **BR-02** A user marked as requiring a password change cannot enter the normal application until
  a new valid password is saved.
- **BR-03** The authenticated user identity, not a requesterId supplied by the client, determines
  ownership of Requester operations.
- **BR-04** Public Comments are visible to the Requester, IT Staff, and Administrator. Internal
  Notes are visible only to IT Staff and Administrator.
- **BR-05** A Requester may indicate that the problem appears resolved, but cannot formally set the
  Ticket to Resolved or Closed.
- **BR-06** An unknown email, or a known email with the wrong password, both return the identical
  generic 401 "Invalid email or password"; Lab 3 does not lock out an account after repeated failed
  attempts.
- **BR-07** A correct email/password pair for a deactivated account returns a distinct 403 "This
  account has been deactivated" response, not the generic invalid-credentials message, so a
  legitimate former user understands why sign-in failed, without exposing any further account
  detail.
- **BR-08** Passwords are never stored or transmitted in plaintext; the server stores only a bcrypt
  hash (cost factor 10) of each password. The raw session token exists only in the httpOnly cookie;
  the database stores only its SHA-256 hash in `Session.tokenHash`.
- **BR-09** Logging out immediately and permanently invalidates the session used to log out (its
  `Session` row is deleted); the same cookie value can never authenticate again.
- **BR-10** A session whose `expiresAt` has passed, or whose `revokedAt` is set, is treated
  identically to no session at all (401), never a silent fallback identity.
- **BR-11** An inactive user can never authenticate, and `User.isActive` is re-checked live on every
  request that resolves a session, not only cached at login time — deactivating a user while they
  are logged in ends their access on their very next request.
- **BR-12** The current-user identity for every protected endpoint comes from the session cookie
  only; the API never accepts a client-supplied user id, requester id, or role as an override. This
  supersedes Lab 2's BR-14 (the dev-header validation rule), which no longer applies now that the
  dev header and its endpoints are removed.
- **BR-13** Email addresses are unique across all users regardless of role, compared
  case-insensitively (stored and matched in lowercase); creating or editing a user with an email
  already in use by a different user is rejected with 409.
- **BR-14** Each Ticket may have at most one primary Ticket Owner, who must be an active `IT_STAFF`
  or `ADMINISTRATOR` user at the time of assignment. A Ticket may initially be unassigned.
- **BR-15** A Ticket cannot be moved out of `NEW` by a direct status-change request; `NEW` becomes
  `OPEN` only as the side effect of its first ownership assignment.
- **BR-16** Once a Ticket has an owner, ownership may be reassigned but never cleared back to
  unassigned.
- **BR-17** Requested Priority never changes after creation. IT Priority may be changed at any time
  by IT Staff until the Ticket reaches `CLOSED` or `CANCELLED`.
- **BR-18** A Ticket's status may change only along the transition matrix in §4.4; any other
  transition is rejected with 409 and the Ticket's status is left unchanged.
- **BR-19** `CLOSED` and `CANCELLED` are terminal for direct edits: no further status change, IT
  Priority change, or ownership change is accepted, except that `CLOSED` accepts a transition to
  `REOPENED`.
- **BR-20** `CANCELLED` has no reopen path in Lab 3; only `RESOLVED` or `CLOSED` may transition to
  `REOPENED`, and `REOPENED`'s only outbound transition is to `OPEN`.
- **BR-21** Public Comments and Internal Notes are append-only: no edit or delete endpoint exists
  for either in Lab 3, and empty or whitespace-only content is rejected regardless of ticket status
  (posting a comment or note is never blocked by `CLOSED`/`CANCELLED`, unlike status/priority/
  ownership changes).
- **BR-22** A Requester may post a Public Comment only on a ticket they own; IT Staff may post a
  Public Comment or an Internal Note on any ticket.
- **BR-23** A Requester calling any Internal Note endpoint, or any Staff-only or Admin-only route,
  is rejected with 403 without the response revealing the resource's existence or content.
- **BR-24** An Administrator may assign exactly one role to a user; simultaneous multiple roles are
  not supported in Lab 3.
- **BR-25** An account created by an Administrator, or one whose password an Administrator resets,
  always starts (or is reset to) `mustChangePassword = true`; there is no Administrator path that
  sets a password without forcing a change at the next login.
- **BR-26** Setting a new initial password for a user immediately revokes every existing `Session`
  row for that user, so a session opened under the old password cannot continue to be used.
- **BR-27** An Administrator cannot deactivate their own account.
- **BR-28** The system always keeps at least one active Administrator; an edit that would deactivate
  or reassign away from `ADMINISTRATOR` the last remaining active Administrator is rejected.
- **BR-29** Deactivation is the only account-disable mechanism in Lab 3; no `User` row is ever
  hard-deleted by any Lab 3 endpoint.
- **BR-30** A migrated Lab 2 Requester keeps their existing `id`; every Ticket, Attachment, and
  `TicketEvent` row that referenced that id continues to reference the same row after Lab 3 ships.

### 4.6 Required Roles and Authorization Matrix

| Role | Minimum permitted behavior |
|---|---|
| Requester | Use authenticated identity; create Tickets; view and manage only owned Tickets and permitted Attachments; post Public Comments; indicate that a problem appears resolved. |
| IT Staff | View the shared Ticket Queue; open any Ticket; claim or reassign ownership; set IT Priority; perform permitted status changes; post Public Comments; write Internal Notes; view existing Attachments. |
| Administrator | Manage user accounts through the minimalist User Management screen: view users, create a user, edit basic account information, assign one permitted role, activate or deactivate an account, set a new initial password. No ticket-route access in Lab 3. |

Administrator and IT Staff responsibilities stay conceptually separate: IT Staff manage Tickets,
Administrators manage user accounts. The Lab 3 authorization matrix does not grant Administrator
any ticket-workflow route.

## 5. UI Specification Summary

Full detail lives in `ui-spec.md`. Summary: every new/changed screen extends the Zen Green token
set and shared component conventions from `docs/lab-02/ui-spec.md` §1–§2 without introducing a
second visual system. Seven screens ship or change: Login (`ui-spec.md` §3), Change Password (§4),
the authenticated App Shell with role-aware navigation and a Logout control (§5), Requester Ticket
Detail extended with Public Comments (§6), IT Staff Ticket Queue (§7), IT Staff Ticket Detail (§8),
and Administrator User Management (§9) — each with defined loading, empty, validation, submitting,
success, forbidden, not-found, and failure states, reusing the Lab 2 button hierarchy, badge
treatment, and read-only/editable field styling. All screens meet the Lab 2 responsive rules
(desktop ≥ 992 px, tablet 768–991 px, mobile < 768 px) and WCAG 2.2 AA accessibility rules — see
`ui-spec.md` §7 (both carried over unchanged from `docs/lab-02/ui-spec.md` §7–§8, same
verification method).

## 6. Data Changes

Full field-level DDL intent lives in the migration notes below; this section states the delta from
the Lab 2 schema (`server/prisma/schema.prisma`).

| Entity | Lab 3 delta from the Lab 2 schema |
|---|---|
| `User` | Add `mustChangePassword Boolean @default(false)`. Add relation `sessions Session[]`. `passwordHash` stays `String?` at the schema level (no backfill requirement is imposed on the column type); a `null` hash is treated as "can never authenticate," equivalent in effect to an unset password, not a schema error. `role`/`isActive` types unchanged. |
| `Session` | New model: `id String @id @default(uuid())`, `userId String`, `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`, `tokenHash String @unique`, `createdAt DateTime @default(now())`, `expiresAt DateTime`, `revokedAt DateTime?`. Index `@@index([userId])`. |
| `InternalNote` | New model, structurally identical to `Comment`: `id String @id @default(uuid())`, `ticketId String`, `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)`, `authorId String`, `author User @relation(fields: [authorId], references: [id], onDelete: Restrict)`, `body String @db.VarChar(2000)`, `createdAt DateTime @default(now())`. Index `@@index([ticketId, createdAt])`. |
| `Comment` | No schema change. Referred to as "Public Comment" throughout Lab 3 documentation and UI; the model and table name stay `Comment`. |
| `Ticket` | Add relation `internalNotes InternalNote[]`. `ownerId` is now reachable (previously always null in Lab 2); it may reference an active `IT_STAFF` or `ADMINISTRATOR` user. No new scalar column. |
| `TicketStatus` (enum) | Rename `ASSIGNED` → `OPEN` and `PENDING_REQUESTER` → `WAITING_FOR_REQUESTER`; add new value `REOPENED`. Final 8 values, in this order: `NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CLOSED, REOPENED, CANCELLED`. |
| `TicketEventType` | Unchanged (`TICKET_CREATED, COMMENT_ADDED, ATTACHMENT_ADDED, ATTACHMENT_REMOVED`). Lab 3 does not add audit-event writes for IT Priority, status, ownership, or Internal Note changes — see Assumption A-15. |

### 6.1 Migration from Lab 2

Lab 2's seeded `User` rows already are the real `User` table (Lab 2 never used a separate
"Development Requester" table — the dev selector picked among real `User` rows with
`role = REQUESTER`). Lab 3 migration therefore has no row-identity migration to perform; it is
strictly additive:

1. Run `npx prisma migrate dev --name lab3_auth_and_workflow --create-only` to generate the
   skeleton migration from the schema delta above.
2. Hand-edit the generated SQL to rename the two `TicketStatus` enum values and add the third,
   using Postgres's enum-value rename, **not** a data migration against the `Ticket` table:
   ```sql
   ALTER TYPE "TicketStatus" RENAME VALUE 'ASSIGNED' TO 'OPEN';
   ALTER TYPE "TicketStatus" RENAME VALUE 'PENDING_REQUESTER' TO 'WAITING_FOR_REQUESTER';
   ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
   ```
   Because these are label renames on the enum type itself, every existing `Ticket.status` value is
   reinterpreted automatically under its new spelling; no `UPDATE "Ticket" SET status = ...`
   statement is needed or should be written. `ADD VALUE` must not be used in the same transaction
   as a row insert that references the new value (Postgres restriction) — the migration only adds
   the label here, it does not insert data using it.
3. Let Prisma's diff generate the rest of the migration normally: `User.mustChangePassword`
   (`NOT NULL DEFAULT false`, so every existing row gets `false` with no manual backfill), the new
   `Session` table, and the new `InternalNote` table.
4. Run the migration, then `prisma generate`.
5. Extend `server/prisma/seed.ts` (upserted by the same natural keys as Lab 2 — `email` for `User`)
   to set a bcrypt password hash on every existing seeded Requester row, and to add the new IT
   Staff and Administrator seed rows described in §6.2. No existing seeded row's `id` or ticket
   relationships change.

### 6.2 Required Seed Data (extends Lab 2's seed baseline)

- Every existing Lab 2 seed User (Requesters) keeps its `id` and gains a bcrypt hash for a fixed,
  documented local-dev password; `mustChangePassword = false` for these so local Requester testing
  is not blocked by the new gate.
- At least 3 active `IT_STAFF` users and 1 inactive `IT_STAFF` user.
- At least 1 active `ADMINISTRATOR` user.
- One additional seeded user (any role) with `mustChangePassword = true`, specifically to exercise
  the mandatory-first-login flow in manual and E2E testing without needing to create one through
  the UI first.
- Seeded credentials are for local development only, documented in `server/README` or
  `server/.env.example`-adjacent notes, never real personal passwords or production secrets.
- The seed script remains idempotent (upsert by `email`), consistent with Lab 2.

## 7. API Contract

Full detail lives in `api-spec.md`. Summary of the required capabilities: login, logout, current
identity, mandatory password change; authenticated continuation of every Lab 2 Requester Ticket/
Attachment endpoint; Requester Public Comments and the "problem appears resolved" indication; IT
Staff Ticket Queue retrieval with search/filter/sort/pagination; retrieve one Ticket for IT Staff;
claim/assign/reassign ownership; update IT Priority and permitted status; create/retrieve Public
Comments and Internal Notes for IT Staff; retrieve the user list as Administrator with search/role
filter; create a user with one permitted role; update a user's name/email/role/activation state;
set a new initial password. All routes are under `/api/v1`, JSON except upload/download, camelCase,
ISO-8601 UTC timestamps, DTOs only. The `/api/v1/dev/*` endpoints from Lab 2 are removed entirely.
Standard statuses: 200 retrieval/update, 201 create, 401 no/invalid/expired session, 403 wrong role
for an entire route namespace or attempting an attachment/comment action outside permitted scope,
404 a Requester-owned resource that's missing or not the caller's (D-24, unchanged from Lab 2), 409
conflict (invalid status transition, duplicate email, last-Administrator protection, attachment
limit — Lab 2 behavior unchanged there), 422 validation failure.

## 8. Acceptance Criteria

- **AC-01** Given an active user with valid credentials, when the user logs in, then the backend
  establishes authenticated access and returns the permitted user identity and role.
- **AC-02** Given a user who must change the initial password, when login succeeds, then normal
  application screens remain unavailable until a valid new password is saved.
- **AC-03** Given an authenticated Requester, when the client supplies another requesterId, then
  the backend still applies the authenticated identity and does not return another Requester's
  data.
- **AC-04** Given a Requester account, when an Internal Note endpoint is requested, then the
  operation is rejected without exposing note content.
- **AC-05** Given an unknown email or a known email with the wrong password, when login is
  attempted, then the response is the identical generic 401 "Invalid email or password" for both
  cases.
- **AC-06** Given a deactivated user's correct email and password, when login is attempted, then
  the response is a distinct 403 "account deactivated" message, not the generic invalid-credentials
  message.
- **AC-07** Given an authenticated user, when logout is called, then the session is invalidated and
  the same cookie no longer authenticates any subsequent request.
- **AC-08** Given a session whose `Session` row has expired or been revoked, when any protected
  endpoint is called, then the response is 401 and the client returns to Login.
- **AC-09** Given a user with `mustChangePassword` true, when change-password is submitted with a
  correct current password and a policy-valid new password, then `mustChangePassword` becomes false
  and the existing session remains valid without requiring re-login.
- **AC-10** Given a change-password submission with an incorrect current password, when submitted,
  then the request is rejected and `mustChangePassword` remains true.
- **AC-11** Given a Requester, IT Staff, or Administrator session, when the app loads, then only the
  navigation items permitted for that role are shown, and the server still rejects a direct request
  to another role's route even if the client route were reached.
- **AC-12** Given tickets created under Lab 2 with existing owners/requesters, when Lab 3 ships,
  then every such ticket's requester/attachment/status data is unchanged and each requester can log
  in and see exactly the tickets they could see before.
- **AC-13** Given a Requester's own ticket, when the Requester posts a Public Comment, then the
  comment is saved with the authenticated author and appears in the ticket's Public Comments in
  order.
- **AC-14** Given a Requester's own ticket, when the Requester marks the problem as appearing
  resolved, then a flagged Public Comment is recorded and the ticket's status does not change.
- **AC-15** Given IT Staff viewing the Ticket Queue, when the queue loads with no filters, then
  tickets from every requester are listed, not only one requester's tickets.
- **AC-16** Given IT Staff apply a search, status filter, and/or IT Priority filter together, when
  the queue refetches, then results satisfy all filters at once (AND semantics).
- **AC-17** Given an unassigned Ticket in status `NEW`, when IT Staff claims or assigns it an owner,
  then the ticket's status becomes `OPEN` and its `ownerId` is set, in the same operation.
- **AC-18** Given a `NEW`, unowned Ticket, when IT Staff attempts to set its status directly to
  `OPEN` via the status endpoint without first assigning an owner, then the request is rejected
  with 409.
- **AC-19** Given a Ticket whose current status permits a transition per the matrix in §4.4, when
  IT Staff requests that transition, then the status updates; given a transition not permitted by
  the matrix, then the request is rejected with 409 and the status is unchanged.
- **AC-20** Given a Ticket in `CLOSED` or `CANCELLED`, when IT Staff attempts to change its IT
  Priority or ownership, then the request is rejected; `CLOSED` alone still accepts a transition to
  `REOPENED`.
- **AC-21** Given a `RESOLVED` or `CLOSED` Ticket, when IT Staff sets its status to `REOPENED`, then
  the update succeeds; given any other current status, when IT Staff attempts `REOPENED`, then it
  is rejected with 409.
- **AC-22** Given any non-terminal Ticket, when IT Staff sets IT Priority to a different valid
  value, then the change is saved and Requested Priority remains unchanged.
- **AC-23** Given any Ticket in the Queue, when IT Staff posts a Public Comment or an Internal
  Note, then the entry is saved with the authenticated staff member as author, regardless of who
  requested the ticket.
- **AC-24** Given a Ticket's Internal Notes, when a Requester requests them directly, then the
  request is rejected (403) and no note content is present in the response body.
- **AC-25** Given the Administrator User Management screen, when it loads, then it lists users with
  Name, Email, Role, and Status, and supports search by name/email and an optional role filter.
- **AC-26** Given valid new-user data with one role and a policy-valid initial password, when an
  Administrator submits Create User, then the user is saved with `mustChangePassword` true and can
  log in only after changing that password.
- **AC-27** Given an email address already used by another user, when an Administrator creates or
  edits a user with that email, then the request is rejected with 409 and no user record is created
  or changed.
- **AC-28** Given an Administrator's own account, when the Administrator attempts to deactivate it,
  then the request is rejected and the account remains active.
- **AC-29** Given exactly one active Administrator, when an edit would deactivate that account or
  change its role away from Administrator, then the request is rejected and the account is
  unchanged.
- **AC-30** Given an Administrator sets a new initial password for an existing user, when the
  change is saved, then that user's `mustChangePassword` becomes true and every existing session
  for that user is invalidated.
- **AC-31** Given a viewport under 768 px, when the Ticket Queue, Staff Ticket Detail, or User
  Management screens are rendered, then no horizontal page scroll occurs and each renders its
  defined mobile layout.

## 9. Definition of Done

Lab 3 is done when:

- Every FR/BR in §4 and every AC in §8 has at least one automated test, mapped by ID in `tests.md`
  §2, with a real file path.
- The migration in §6.1 applies cleanly against a database already seeded by Lab 2, and every Lab 2
  ticket/attachment/requester relationship is intact afterward (AC-12).
- The seed baseline in §6.2 is met and its idempotency assertion passes.
- Server and client automated test suites pass, including the mandatory authentication/
  authorization/migration-regression/workflow/administration tests listed in `tests.md`, with ≥80%
  coverage on both.
- The Zen Green token verification checklist (`ui-spec.md` §2) passes against rendered output for
  every new/changed screen.
- No document in this set still describes the Development Requester selector, the `x-dev-user-id`
  header, or the pre-Lab-3 `ASSIGNED`/`PENDING_REQUESTER` status names as current behavior.
- Lab 1's and Lab 2's existing tests still pass unmodified (or are updated only where a Lab 3 field
  rename genuinely requires it, e.g. status-badge fixtures).
- README setup and test instructions are current, including how to seed and log in as each role.
- Lab 3's own Kanban (GitHub Project) has every planned Issue (#34–#41) in Done.

**Review and demonstration evidence** (same submission-evidence pattern as Lab 2 §10): a rendered
`reviewer.md` naming the reviewer, linking every PR reviewed, and recording comments given/received
and responses; and, for Login/Change Password, the Ticket Queue, Staff Ticket Detail, and User
Management, readable screenshots demonstrating the initial/loading/validation/submitting/success/
forbidden/failure states called for in `ui-spec.md`.

## 10. Assumptions and Decisions

The labsheet deliberately leaves the authentication mechanism, the status transition matrix, and
several administrative edge cases as open engineering decisions (§6.1, §4.5 of the labsheet). This
section records every meaningful choice made to close those gaps.

- **A-01 Session mechanism.** Opaque, randomly generated session tokens (not JWTs) stored
  server-side in `Session`, hashed with SHA-256 before storage (`tokenHash`), delivered to the
  client only via an httpOnly, `SameSite=Lax` cookie (`Secure` in production only, since local dev
  runs over plain HTTP). This was the architecture agreed before writing this spec: it makes logout
  and administrator-triggered password-reset instantly effective (BR-09, BR-26), which a stateless
  JWT cannot do without an extra revocation list.
- **A-02 Session lifetime.** A session is valid for 12 hours from creation (`expiresAt = createdAt +
  12h`), not renewed on activity in Lab 3. No "remember me" or sliding-expiration feature exists.
- **A-03 CSRF posture.** No dedicated CSRF token is introduced in Lab 3. The cookie is
  `SameSite=Lax` (blocks it on cross-site non-navigation requests) and every state-changing request
  sends `Content-Type: application/json`, which cannot be produced by a simple cross-site HTML form
  without triggering a CORS preflight that the server's explicit-origin CORS configuration would
  reject. This combination is judged adequate for a local coursework deployment; a dedicated CSRF
  token is deferred as out of scope, consistent with the labsheet's exclusion of "advanced
  identity-management functions."
- **A-04 Password hashing.** bcrypt, cost factor 10, via the new `bcrypt`/`@types/bcrypt`
  dependencies named in the architecture. `passwordHash` stays a nullable column at the schema
  level (no migration-time backfill is possible for a value nobody has); a `null` hash is treated
  by the login handler as "this account can never successfully authenticate," which is a safe
  default, not an error state.
- **A-05 Email case sensitivity.** All email addresses are normalized to lowercase before being
  stored or compared (login, create-user, edit-user), so `Jane@Example.com` and
  `jane@example.com` are the same account for uniqueness (BR-13) and login purposes. No schema
  change (`citext`) was needed for this — normalization happens in application code.
- **A-06 Route namespace split by role, not a role branch inside shared routes.** IT Staff
  operations live under a new `/api/v1/staff/tickets/*` namespace, entirely separate from the
  Requester-only `/api/v1/tickets/*` namespace inherited from Lab 2. This keeps the ownership-based
  404-for-Requester rule (D-24, unchanged) and the "any ticket, any Requester" rule for staff from
  ever needing to coexist inside the same handler, and matches the labsheet's explicit instruction
  to keep Administrator and IT Staff responsibilities conceptually separate — extended here to also
  keep Requester and IT Staff routes structurally separate.
- **A-07 Administrator has no ticket-route access in Lab 3.** The role table (§4.6) grants
  Administrator only the User Management capability; no endpoint under `/api/v1/staff/tickets/*` or
  `/api/v1/tickets/*` accepts the `ADMINISTRATOR` role, even though the `Ticket.owner` relation
  permits an Administrator id in principle (BR-14) for future flexibility.
- **A-08 "Problem appears resolved" is a flagged Public Comment, not a schema field.** The
  architecture agreed for Lab 3 does not add a new column for this, and BR-05 only requires that
  the Requester's action never sets a formal status. `POST /api/v1/tickets/:id/comments` accepts an
  optional `problemAppearsResolved: true` flag; when present, the server prepends the fixed,
  server-controlled literal `"[Requester marked: problem appears resolved] "` to the stored comment
  body (never accepted verbatim from the client), so the marker cannot be spoofed and no schema
  change is required.
- **A-09 No "unassign" action.** Once a Ticket has an owner, `PATCH
  /api/v1/staff/tickets/:id/owner` can only reassign it to a different active `IT_STAFF`/
  `ADMINISTRATOR` id, never clear it back to null (BR-16). The labsheet does not ask for an unassign
  path, and allowing one would reopen the "how does status un-advance from OPEN" question with no
  stated requirement to justify it.
- **A-10 IT Staff cannot upload or remove Attachments in Lab 3.** Ticket Detail for IT Staff shows
  the existing Attachments list read-only (download only); the exclusion list names "Actions Taken"
  explicitly and is silent on staff attachment management, so this spec treats it as not required
  yet rather than assuming it is included by omission.
- **A-11 Duplicate-email conflict is 409, not 422.** Lab 2's own contract already distinguishes
  field-format validation (422) from business-rule conflicts like the attachment limit (409); a
  duplicate email is a uniqueness conflict, not a format problem, so it follows the same 409
  convention as `ATTACHMENT_LIMIT_REACHED` for consistency across the whole API surface.
- **A-12 Password reset revokes sessions.** BR-26 (an Administrator setting a new initial password
  immediately revokes every existing session for that user) is not explicitly requested by the
  labsheet, but is treated as a mandatory safety property: leaving a stale session live after an
  administrator-forced password reset would silently defeat the reset.
- **A-13 Status/priority/ownership audit events are out of scope.** `TicketEventType` is not
  extended in Lab 3. The labsheet requires audit continuity only for `TICKET_CREATED`/
  `ATTACHMENT_ADDED`/`ATTACHMENT_REMOVED` (carried over from Lab 2); it does not ask for
  status/priority/ownership/note history to be written as events, and no Lab 3 endpoint reads such
  history back, so adding write-only event rows for these would be unused code with no test that
  could exercise it (mirroring Lab 2's own reasoning for not building an Event Log).
- **A-14 No account lockout.** BR-06 explicitly states Lab 3 does not lock out an account after
  repeated failed logins; this keeps the login handler simple and matches the labsheet's exclusion
  of "advanced identity-management functions."
- **A-15 Migration uses enum-value rename, not row updates.** Recorded in §6.1: renaming
  `TicketStatus` enum labels means every existing `Ticket.status` value is automatically
  reinterpreted, so no `UPDATE` statement against `Ticket` is written or needed for the status
  rename itself. This is the safest possible migration for a renamed status precisely because it
  touches zero data rows.
