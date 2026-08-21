# TokTickIT — Lab 2 Specification (Requester Ticketing MVP with UI Foundations)

**Status:** Corrected 2026-08-21, second pass, against the official Lab 2 labsheet and lecture
deck, per PR #14 review (commits 5bdbdda and this one). This is the required, self-contained
Lab 2 contract deliverable. It consolidates the approved System-Level SDS
(`references/TokTickIT-System-Level-SDS-v1.0.md`, D-01...D-12), the SRS draft
(`references/TokTickIT-SRS-and-Feature-Inventory-draft-v0.1.md`), and the Lab 2 Decision Register
Addendum (`decision-register-addendum.md`, D-13...D-20) into one document scoped to what Lab 2
actually implements. Where any reference document conflicts with this file, this file wins for
Lab 2.

Companion deliverables: `ui-spec.md` (screens, Zen Green tokens, responsive/accessibility rules),
`api-spec.md` (endpoints, DTOs), `tests.md` (test plan and Definition of Done),
`traceability-matrix.md` (every acceptance criterion mapped to a test).

## 1. Scope

Lab 2 implements the **Requester-facing** slice of TokTickIT:

- Create Ticket (with create-time attachment upload)
- My Tickets (list, filter, search, sort, paginate)
- Ticket Detail (read-only fields plus the Attachments list — no Event Log, no Service Actions
  display; see the second-pass correction in §3 and §9)
- Attachments (upload, download, soft removal with reason)
- Development Requester Selection (development/testing scaffolding, not authentication or RBAC)

**Explicitly out of scope for Lab 2** (later labs, per the labsheet's own "later labs will add"
list, and per the second review pass):

- Public Comments / Internal Notes / Actions Taken (Feature-E and the `Comment` entity — D-15,
  removed entirely, not deferred-with-scaffolding)
- Event Log display and its read endpoint (corrected 2026-08-21 — see §3, §9); Service Actions
  display in any form, including an empty placeholder (corrected 2026-08-21)
- Role-based access control of any kind: no IT Staff/Administrator branches, no role enum checks
  server-side, no "authenticated"/session semantics beyond the plain requester-ownership check
  the Development Requester Selection enables (corrected 2026-08-21 — see §2)
- Ticket ownership/assignment, IT Priority changes, Resolve/Close, Service Action
  creation/lifecycle, cancel/reopen execution
- Real authentication: Login screen, First Password Change, password verification, `Session`
  model, CSRF protection (D-18)
- Notifications (in-app indicator)
- Category/Related System administration screens (the reference tables themselves are seeded and
  read by Create Ticket in Lab 2; the admin management UI is later)

## 2. Roles in Lab 2 (corrected 2026-08-21 — RBAC removed)

**Lab 2 has no role-based access control.** The `User` model and role enum (Requester, IT Staff,
Administrator) exist as SDS baseline data columns because they are part of the approved schema
(D-01...D-12), but Lab 2 code never branches on role, never implements an IT Staff or
Administrator code path, and never treats any endpoint as "authenticated" in the session sense.

The only access rule in Lab 2 is ownership: a ticket is visible only to the Development Requester
who created it (the currently selected requester from `POST /dev/session` — see D-18). This is
enforced the same way for every request regardless of a user's `role` column value; Lab 2 simply
never has more than one kind of caller. Implementing an unused IT Staff/Administrator branch
"because it's cheap" was flagged in the second review pass as scope creep — code with no
reachable caller and no Lab 2 test that can exercise it — so it is removed. That branch is
reintroduced only in the lab that actually ships an IT Staff screen.

## 3. Functional Requirements (Lab 2 scope, corrected)

### Development Requester Selection (Feature-A, Lab 2 slice)

- **FR-001** (Lab 2 form) The system shall require a Development Requester Selection before any
  ticket function is accessible: the app shows a list of seeded active Requesters and blocks
  navigation to My Tickets/Create Ticket/Ticket Detail until one is selected. *(Replaces "sign in
  with email and password," which is Lab 3.)*
- **FR-001b** (new, D-18) The application header shall display the selected Requester's name and
  a "Change Requester" control; activating it clears the selection and returns to the picker.
- **FR-001c** (new, D-18) Switching the selected Requester shall reload all requester-scoped data
  (My Tickets, any open Ticket Detail) so no data belonging to the previously selected Requester
  remains visible.
- **FR-006** (corrected 2026-08-21) The system shall scope every ticket-related operation to the
  currently selected Development Requester by simple ownership check
  (`ticket.requesterId === selectedRequesterId`). No role-based branch exists in Lab 2.
- **FR-007** A Requester shall be able to view only tickets they requested.

### Ticket Creation (Feature-B)

- **FR-008** The system shall allow a Requester to create a new ticket by supplying a title
  (summary), description, Category, and Requested Priority.
- **FR-008b** (D-16) A Requester may optionally associate a ticket with a Related System from an
  administrator-managed, seeded list at creation time.
- **FR-009** The system shall generate a unique, human-readable ticket number
  `TKT-YYYY-NNNNN`, transactionally, at creation time (D-10).
- **FR-010** A newly created ticket shall start in status `NEW` with no Ticket Owner assigned.
- **FR-011** IT Priority shall initially copy the Requester's Requested Priority at creation, set
  server-side; it is never accepted from the request body.
- **FR-012** (corrected — create-time attachment upload IS required in Lab 2) The system shall
  allow a Requester to select one or more files during Create Ticket and have them uploaded
  immediately after the ticket is created, using a create-then-upload sequence: the ticket is
  created first (its own transaction, per FR-013), then each staged file is uploaded against the
  new ticket's id via the same attachment upload path used from Ticket Detail (Feature-F). If an
  upload fails (validation rejection or a transient error), the ticket is **not** rolled back or
  deleted — the Requester lands on Ticket Detail for the successfully created ticket, sees which
  file(s) failed and why, and may retry the upload from Attachments. A ticket is never lost
  because a later attachment upload failed.
- **FR-013** Ticket creation shall write a `TICKET_CREATED` TicketEvent recording the requester,
  timestamp, and initial field values, in the same transaction as the ticket insert. This event
  is written for audit continuity (BR-015/NFR-004) but is not read back or displayed in Lab 2
  (see FR-021 below).

### My Tickets — Ticket List (Feature-C)

- **FR-014** The system shall allow a Requester to view a list ("My Tickets") of every ticket
  they requested, regardless of status.
- **FR-015** Each row in My Tickets shall show at minimum: ticket number, summary, category,
  status, and last-updated date.
- **FR-016** (corrected, D-17 reversed) The system shall allow a Requester to filter My Tickets
  by status and by category, **and to search their own tickets by free text** (matching ticket
  number and summary, case-insensitive substring), combined with the active filters. Search is
  Lab 2 scope, not deferred.
- **FR-017** The system shall paginate My Tickets when the result set exceeds a fixed page size.
- **FR-018** Selecting a row in My Tickets shall open that ticket's Ticket Detail view.

### Ticket Detail (Feature-D)

- **FR-019** The system shall display, on Ticket Detail: ticket number, date, category,
  requester, owner (if assigned — always empty in Lab 2), Requested Priority, IT Priority,
  current status, description, and resolution summary (always empty in Lab 2).
- **FR-020** The system shall display the ticket's Attachments (Feature-F) on Ticket Detail,
  including removed attachments with metadata visible (see Feature-F).
- **FR-021** (corrected 2026-08-21 — Event Log removed from Lab 2 scope) Ticket Detail does
  **not** display TicketEvent history in Lab 2. `TICKET_CREATED`, `ATTACHMENT_ADDED`, and
  `ATTACHMENT_REMOVED` events are still written to the database (BR-015/NFR-004 require it
  independently of any UI), but there is no `GET .../events` endpoint and no Event Log UI in
  Lab 2 — the labsheet scopes this increment to read-only ticket details plus the attachment
  lifecycle only. An Event Log becomes a Lab 2 deliverable retroactively only if a future
  correction says so; until then, treat any events endpoint or Event Log UI as out of scope.

*(FR-021b, a Service Actions placeholder tab, is withdrawn 2026-08-21 — Service Actions display
in any form, including an empty state, is out of scope for Lab 2 per the second review pass; no
ServiceAction model or UI ships. FR-022/FR-023, requester resolution confirmation/reject/
reopen-request UI, remain out of scope for Lab 2 per D-14 — the ticket never leaves `NEW` in
Lab 2, so these controls have nothing to act on.)*

### Attachments (Feature-F)

- **FR-026** The system shall allow a Requester to upload an attachment to a ticket, from Create
  Ticket (FR-012) or from Ticket Detail.
- **FR-027** The system shall accept only JPG, PNG, WEBP, and PDF files, each up to 5 MB, with no
  more than 5 active (non-removed) attachments per ticket.
- **FR-028** (corrected — soft removal with required reason) The uploader shall be able to remove
  their own attachment while the ticket is not Closed. Removal is a **soft removal**: it requires
  a confirmation dialog and a required reason (1..200 characters); the attachment's metadata
  (filename, uploader, size, upload date, removal reason, remover, removal date) **remains
  visible** in the Attachments list, clearly marked as removed; the file's content becomes
  permanently inaccessible (preview/download blocked, HTTP 410). The binary is deleted from
  storage; the metadata row is never hard-deleted.
- **FR-030** Every attachment removal shall create an `ATTACHMENT_REMOVED` TicketEvent recording
  filename, uploader, remover, reason, and timestamp (written for audit continuity, not
  displayed — see FR-021).
- **FR-031** The system shall serve attachment downloads only through an authorized endpoint
  (ownership-scoped, per §2) that streams from local disk storage (D-20b) behind a
  storage-adapter interface written against SeaweedFS (D-06).

## 4. Business Rules (Lab 2 scope, corrected)

- **BR-001** Ticket status is one of: New, Assigned, In Progress, Pending Requester, Resolved,
  Closed, Cancelled. Only `New` is reachable in Lab 2.
- **BR-002** Priority (Requested and IT) is one of: Low, Medium, High, Urgent.
- **BR-006 / BR-007** (D-13) Cancel/reopen execution is not part of Lab 2 at all — no Lab 2 UI or
  endpoint executes these, regardless of role; Lab 2 has no reachable status besides `New`.
- **BR-009** Requested Priority belongs to the Requester and is set at creation; IT Priority is
  system-copied from it at creation and is not editable in Lab 2.
- **BR-011b** (D-16) A Related System may be deactivated but never hard-deleted while referenced
  by any ticket.
- **BR-012** Attachments are limited to JPG, PNG, WEBP, PDF; maximum 5 MB per file; maximum 5
  *active* attachments per ticket (removed attachments do not count against the limit, so a
  Requester can remove-and-replace).
- **BR-013** (corrected — RBAC language removed 2026-08-21) The uploader of an attachment may
  remove it only while the ticket is not Closed (unreachable in Lab 2, so effectively always
  permitted in Lab 2), and only with a required reason. Any other Development Requester gets 403
  attempting to remove someone else's attachment — Lab 2 has no elevated-role removal path at
  all, so this is a flat "uploader only" rule, not a role exception.
- **BR-014** Ticket numbers are unique, generated transactionally, `TKT-YYYY-NNNNN`, annual
  sequence reset.
- **BR-015** Ticket creation and attachment removal each write a TicketEvent in the same database
  transaction as the underlying change (written for audit continuity; not read back in Lab 2,
  per FR-021).
- **BR-016** Tickets and TicketEvents are never hard-deleted.
- **BR-017** A stale ticket update (optimistic `version`) is rejected with HTTP 409. (No Lab 2
  endpoint currently updates an existing ticket's mutable fields, so this rule has no Lab 2 test
  surface yet beyond the field being present on the DTO; it is exercised starting Lab 3.)
- **BR-019** (new, D-17) My Tickets search (`q`) is scoped to the requesting user's own tickets
  exactly like the status/category filters — it can never surface another requester's ticket,
  and combines with active filters using AND semantics.
- **BR-020** (new, D-18, RBAC language removed 2026-08-21) The Development Requester Selection is
  validated server-side on every request (not only at selection time): a request carrying an
  inactive or unknown requester id is rejected 401 and the client returns to the picker. This is
  a plain identity-presence check, not role-based authorization — Lab 2 has exactly one kind of
  caller (a selected Development Requester) and no privilege levels.

## 5. Non-Functional Requirements (Lab 2 scope)

- **NFR-001 Performance:** p95 API response under 500 ms for normal CRUD at 50 concurrent users;
  uploads excluded.
- **NFR-002 Security (corrected — RBAC language removed 2026-08-21):** Ownership checks are
  enforced server-side on every protected endpoint; hiding a UI control is never sufficient. The
  Development Requester Selection (D-18) is explicitly not a security boundary and must be
  documented as such everywhere it appears. Lab 2 has no role-based authorization to secure.
- **NFR-003 Accessibility:** WCAG 2.2 Level AA for every Requester-facing screen, including the
  Development Requester Selection screen.
- **NFR-004 Auditability:** Every material Lab 2 change (ticket creation, attachment
  addition/removal) is traceable via an append-only TicketEvent, written even though Lab 2 has
  no UI to read those events back (see FR-021).
- **NFR-007 Localization:** Dates/times stored in UTC, displayed in the user's locale.
- **NFR-008 Branding (corrected, D-19, exact tokens added 2026-08-21):** The UI uses the
  published **Zen Green** tokens defined in `ui-spec.md` §1 (`#006B3C` / `#0B7A46` / `#EAF6EF` /
  `#F5F7F6`), not the general-course KMUTT palette (SDS D-09, superseded for TokTickIT by D-19).
- **NFR-009 Responsive (new, D-19):** Every Lab 2 screen renders usably at the Bootstrap `xs`
  breakpoint (< 576 px) through `lg` and above, with no horizontal page scroll at any breakpoint
  — see `ui-spec.md` "Responsive rules."

## 6. Data Model (Lab 2 scope)

Entities shipped in Lab 2 (full field lists in the SDS reference copy, deltas below):

| Entity | Lab 2 delta from the SDS baseline |
|---|---|
| `User` | Seeded; no password verification path used (D-18); role column present (SDS baseline) but never branched on in Lab 2 code (§2). |
| `Ticket` | All SDS fields; only `status = NEW` is reachable; `ownerId` always null. |
| `Category` | Seeded, Lab 1 carryover, `Int` PK (D-20c); exactly 4 rows (§7). |
| `RelatedSystem` | New, seeded, `Int` PK (D-16, D-20c): `id, code, name, isActive`; at least 6 rows (§7). |
| `Attachment` | All SDS fields plus `deletedReason` (string, required when `deletedAt` is set) — needed for the required-reason soft removal in FR-028. |
| `TicketEvent` | `TICKET_CREATED`, `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED` are the only event types Lab 2 writes; written for audit continuity, no Lab 2 read path (§3, FR-021). |
| `Comment` | **Not shipped in Lab 2** (D-15). |
| `ServiceAction`, `Notification`, `Session` | Not shipped in Lab 2 (later labs). |

## 7. Seed Data Baseline (new, 2026-08-21)

Explicit and testable, so `npm run seed` output is objectively checkable rather than "some rows
exist":

- **Development Requesters:** at least 4 stable **active** Requester users, plus exactly 1 stable
  **inactive** Requester user, all with fixed, predictable seed emails/display names (not
  randomly generated per run) so tests and screenshots can reference them by name. The inactive
  Requester exists specifically to prove `GET /api/v1/dev/requesters` and the picker UI exclude
  inactive users (BR-020/D-18) — it must never appear in the picker and must be rejected by
  `POST /api/v1/dev/session`.
- **Categories:** exactly the 4 Categories carried over from Lab 1 (`code`/`isActive` backfilled,
  per the existing migration test), all active.
- **Related Systems:** at least 6 seeded rows, all active, covering a realistic spread (not all
  identical placeholder names) so the Create Ticket select and My Tickets filtering have more
  than a trivial single option to exercise in tests.
- **Idempotency:** running the seed script twice against the same database produces the same
  rows (no duplicate active Requesters/Categories/Related Systems, no unique-constraint errors on
  a second run) — the seed script upserts by a stable natural key (email for `User`, `code` for
  `Category`/`RelatedSystem`), it does not blindly insert.

## 8. Feature Inventory (Lab 2 column, corrected)

| ID | Feature | Lab 2? |
|---|---|---|
| Feature-A | Development Requester Selection (Lab 2 slice of Authentication/Access Control) | **Yes** |
| Feature-B | Ticket Creation (incl. create-time attachment upload) | **Yes** |
| Feature-C | My Tickets (list, filter, search, sort, paginate) | **Yes** |
| Feature-D | Ticket Detail (read-only fields + Attachments only — no Event Log, no Service Actions) | **Yes** |
| Feature-E | Ticket Comments | **No — removed from Lab 2 (D-15)** |
| Feature-F | Attachments (upload, download, soft removal with reason) | **Yes** |
| Feature-G..R | Ownership, workflow, priority, service actions, notifications, admin, real auth, dashboards, event log display | Later labs |

## 9. Acceptance Criteria (new, 2026-08-21)

Every criterion below has a stable ID and a test mapping in `traceability-matrix.md`.

- **AC-01** — Given no Development Requester is selected, when the app loads, then the
  Development Requester Selection screen is shown before any ticket screen is reachable.
- **AC-02** — Given the selection screen, when a seeded active Requester is selected, then the
  app navigates to My Tickets scoped to that requester.
- **AC-03** — Given the inactive seeded Requester (§7), when the picker loads, then that
  Requester does not appear in the list, and a direct `POST /dev/session` with their id returns
  404.
- **AC-04** — Given a requester is selected, when "Change Requester" is activated, then the
  stored selection clears and any cached requester-scoped data (My Tickets, an open Ticket
  Detail) is discarded before the picker renders.
- **AC-05** — Given valid Create Ticket fields, when submitted, then a ticket is created with
  status `NEW`, `ownerId` null, `itPriority === requestedPriority`, and a unique
  `TKT-YYYY-NNNNN` number.
- **AC-06** — Given Create Ticket fields plus one or more staged attachments, when submitted and
  one staged attachment fails to upload, then the ticket still exists and Detail shows a per-file
  failure summary naming the failed file and reason.
- **AC-07** — Given required Create Ticket fields left blank, when submitted, then field-level
  errors render associated with their inputs and all previously entered values (including staged
  attachments) are preserved.
- **AC-08** — Given tickets exist for more than one requester, when My Tickets loads for a
  selected requester, then only that requester's tickets are listed, newest first.
- **AC-09** — Given a status filter, a category filter, and/or search text are applied together,
  when the list refetches, then results satisfy all of them at once (AND, not OR) and remain
  scoped to the selected requester.
- **AC-10** — Given zero tickets exist for the selected requester, when My Tickets loads with no
  filters or search active, then the "you haven't created any tickets yet" empty state is shown.
- **AC-11** — Given a filter or search that matches nothing, when applied, then the "no tickets
  match" empty state with a working "Clear filters" action is shown (distinct from AC-10).
- **AC-12** — Given a ticket the selected requester does not own, when its Detail URL is opened
  directly, then a 403/access-denied state is shown and no ticket data is present in the
  response or the rendered page.
- **AC-13** — Given an active attachment, when the uploader removes it with a non-empty reason,
  then the attachment stays listed with `status: REMOVED`, its reason/remover/removal date
  visible, `downloadUrl: null`, and the content endpoint returns 410 for it.
- **AC-14** — Given a removal request with a missing or blank reason, when submitted, then the
  API rejects it 422 and the attachment remains active and unchanged.
- **AC-15** — Given a ticket already has 5 active attachments, when a 6th is uploaded, then it is
  rejected 409; after one active attachment is removed, a new upload succeeds.
- **AC-16** — Given a file that is not JPG/PNG/WEBP/PDF, or exceeds 5 MB, when uploaded, then it
  is rejected (422 type mismatch, or 413 size) and never written to storage.
- **AC-17** — Given My Tickets or Ticket Detail rendered at a viewport under 576 px, when
  displayed, then no horizontal page scroll occurs, and My Tickets renders as stacked cards
  rather than a table.
- **AC-18** — Given a request whose `x-dev-user-id` is missing, unknown, or refers to the
  inactive seeded Requester, when any protected endpoint is called, then the response is 401 and
  the client returns to the Development Requester Selection screen.
- **AC-19** — Given Ticket Detail for any ticket in Lab 2, when rendered, then no Event Log
  section and no Service Actions section/placeholder are present anywhere on the page (regression
  guard for the second-pass correction).

## 10. Assumptions and Decisions (new, 2026-08-21)

Explicit record of where this spec set had to fill a gap the labsheet doesn't pin down exactly,
so a grader or a later contributor can see what was assumed versus what was given:

- **Zen Green tokens** were originally invented (first correction pass) because no hex values
  were visible in the source material available at the time; the second review pass supplied the
  actual published values (`#006B3C` / `#0B7A46` / `#EAF6EF` / `#F5F7F6`), now reflected in
  `ui-spec.md` §1 and NFR-008. Treat this table as the single source of truth going forward.
- **Search query syntax** (FR-016/D-17): the labsheet requires search but does not define its
  exact syntax. This spec fixes it as plain case-insensitive substring matching on ticket number
  and summary, no wildcards/booleans/regex, 1..100 characters. If the labsheet later publishes an
  exact syntax, this decision updates to match it.
- **Seed data counts** (§7): the labsheet does not give exact counts for seeded Requesters,
  Categories, or Related Systems beyond "seeded." This spec fixes concrete, testable minimums
  (4 active + 1 inactive Requester, 4 Categories, 6+ Related Systems) so seeding is objectively
  verifiable rather than "some rows exist."
- **Event Log and Service Actions removal** (§3, §9, AC-19): the first correction pass read the
  eventual full ticket-detail mockup (which does show an Event Log and, in later labs, Service
  Actions) as justification for an empty/placeholder version in Lab 2. The second review pass
  corrected this: Lab 2's own scope is read-only ticket fields plus the attachment lifecycle
  only, nothing else, even as an empty placeholder. TicketEvent rows are still written (BR-015
  already required it independently), only the read/display path is removed.
- **No role-based access control** (§2): Lab 2 implements ownership-only access control. The
  `User.role` column exists as SDS baseline schema but is inert in Lab 2 — no code path branches
  on it. This is a deliberate scope decision, not an oversight: an IT Staff/Administrator branch
  with no reachable caller and no exercising test in Lab 2 is unverifiable code, which the second
  review pass flagged directly.

## 11. Definition of Done (new, 2026-08-21)

Lab 2 is done when:

- Every FR/BR in §3–§4 and every AC in §9 has at least one automated test, mapped by ID in
  `traceability-matrix.md`, with a real file path.
- The seed baseline in §7 is met and its idempotency assertion passes.
- Server and client automated test suites pass, including the mandatory security/search/
  attachment/creation tests listed in `tests.md`, with ≥80% coverage on both.
- The Zen Green token verification checklist (`ui-spec.md` §1) passes against rendered output.
- No document in this set still describes the pre-correction KMUTT-palette / invisible-header-
  auth / deferred-search / included-comments / Event-Log-and-Service-Actions-in-Lab-2 / RBAC-
  branching version — this is re-checked explicitly at the end of every correction pass.
- Lab 1's existing tests still pass unmodified.

## 12. Definition of Ready

This specification, together with `ui-spec.md`, `api-spec.md`, `tests.md`, and
`traceability-matrix.md`, is ready for implementation once every AC in §9 maps to a real test
path in `traceability-matrix.md` and the Definition of Done checklist in §11 is achievable
without inventing further business rules.
