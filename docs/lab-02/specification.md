# Lab 2 Sprint Engineering Specification

**Status:** Reconciled 2026-08-21, third pass, against the actual official Lab 2 labsheet
(`Lab_02_labsheet.pdf`, supplied after the first two correction passes were already underway —
see `ai-use.md` for how that gap happened). Restructured to the labsheet's required
`specification.md` section set (§8.10/Appendix A). Substance from the first two correction passes
(Zen Green tokens, RBAC removal, Event Log/Service Actions removal, search reversal, the
Development Requester Selection screen) carries forward; only the organization and a few leftover
inconsistencies change in this pass.

Companion deliverables: `ui-spec.md`, `api-spec.md`, `tests.md`, `reviewer.md`, `ai-use.md`.

## 1. Sprint Goal

Ship the Requester-facing slice of TokTickIT: a Requester can create a ticket with supporting
attachments, find it again in My Tickets (search, filter, sort, paginate), open its read-only
Ticket Detail, and manage its attachments (add, download, soft-remove with a reason) — all scoped
to a Development Requester identity selected through a temporary testing screen, ahead of real
authentication in Lab 3.

## 2. Stakeholder Request Interpretation

The IT department wants a real, working intake channel for support requests before anything else
is built. A Requester needs to be able to describe a problem, tag it with a category and related
system, say how urgent it is from their side, attach evidence, and get a ticket number back. After
that, they need to be able to find that ticket again — by searching or filtering their own list —
open it, see its current state, and manage the files attached to it, without ever being able to
see another Requester's tickets. Because login does not exist yet, the sprint stands up a
throwaway "pick who you are" screen so this can all be tested as different users; it is explicitly
not real security and must never be described as such. Everything in this sprint also has to
establish the visual and interaction conventions (the Zen Green look, and how forms/lists/badges/
loading/empty/error states behave) that later sprints reuse rather than reinvent.

## 3. Scope

### Included

- Development Requester Selection screen (testing-only identity, not authentication)
- Create Ticket, including create-time attachment upload
- My Tickets: list, search, filter, sort, paginate
- Requester Ticket Detail: read-only ticket fields plus the Attachments section
- Attachments: upload, download, soft removal with a required reason
- The Zen Green visual system and its reusable component/state conventions

### Excluded

- Real authentication (login, logout, passwords, hashing, sessions, tokens) and any
  role-based authorization — the Development Requester selector is a testing mechanism only
- IT Staff workflow: dashboard, queue, claiming/reassigning tickets, changing IT Priority
- Ticket collaboration and work tracking: Public Comments, Internal Notes, Actions Taken
- Ticket lifecycle beyond the initial `New` status: resolution confirmation, resolving, closing,
  reopening, cancelling
- Administrator management of users, Requesters, roles, or reference data
- An Event Log or Service Actions display of any kind, including an empty placeholder — Ticket
  Detail in Lab 2 is read-only fields plus Attachments only

## 4. Functional Requirements

### Development Requester Selection

- **FR-01** The system shall require a Development Requester Selection before any ticket function
  is accessible: the app shows a list of seeded active Requesters and blocks navigation to My
  Tickets/Create Ticket/Ticket Detail until one is selected. This replaces "sign in with email and
  password," which is Lab 3.
- **FR-02** The application header shall display the selected Requester's name and a "Change
  Requester" control; activating it clears the selection and returns to the picker.
- **FR-03** Switching the selected Requester shall reload all requester-scoped data (My Tickets,
  any open Ticket Detail) so no data belonging to the previously selected Requester remains
  visible.
- **FR-04** The system shall scope every ticket-related operation to the currently selected
  Development Requester by ownership check (`ticket.requesterId === selectedRequesterId`). There
  is no role-based branch in Lab 2.
- **FR-05** A Requester shall be able to view only tickets they requested.

### Ticket Creation

- **FR-06** The system shall allow a Requester to create a new ticket by supplying a summary,
  description, Category, and Requested Priority.
- **FR-07** A Requester may optionally associate a ticket with a Related System from a seeded
  list at creation time.
- **FR-08** The system shall generate a unique, human-readable Ticket Number (`TKT-YYYY-NNNNN`)
  transactionally, at creation time.
- **FR-09** A newly created ticket shall start with Current Status `New` and no Ticket Owner
  assigned.
- **FR-10** IT Priority shall be set server-side equal to the Requester's Requested Priority at
  creation; it is never accepted from the request body.
- **FR-11** The system shall allow a Requester to select one or more files during Create Ticket
  and have them uploaded immediately after the ticket is created (create-then-upload): the ticket
  is created first, in its own transaction, then each staged file is uploaded against the new
  ticket's id via the same attachment upload path used from Ticket Detail. If a staged upload
  fails, the ticket is not rolled back or deleted — the Requester lands on Ticket Detail for the
  successfully created ticket, sees which file(s) failed and why, and may retry from Attachments.
- **FR-12** Ticket creation shall write a `TICKET_CREATED` audit event, in the same transaction as
  the ticket insert. This event exists for audit continuity (BR-15) but is not read back or
  displayed anywhere in Lab 2.

**Create Ticket field-level validation:**

| Field | Rule | On violation |
|---|---|---|
| Summary | Required, 5..150 characters, trimmed | 422, field-level message |
| Description | Required, 10..5000 characters, trimmed | 422, field-level message |
| Category | Required, must reference an ACTIVE category | 422, field-level message |
| Related System | Optional; if present, must reference an ACTIVE related system | 422, field-level message |
| Requested Priority | Required, one of Low/Medium/High/Urgent | 422, field-level message |
| Ticket Number, Ticket Date, Requester | Read-only, system-generated — never rendered as editable inputs and never accepted from the request body | n/a |

### My Tickets

- **FR-13** The system shall allow a Requester to view a list ("My Tickets") of every ticket they
  requested, regardless of status.
- **FR-14** Each row in My Tickets shall show at minimum: Ticket Number, Summary, Category,
  Current Status, and Last Updated date.
- **FR-15** The system shall allow a Requester to filter My Tickets by status and by category, and
  to search their own tickets by free text (matching Ticket Number and Summary, case-insensitive
  substring), combined with the active filters using AND semantics.
- **FR-16** The system shall sort My Tickets by a whitelisted set of fields and paginate the
  result when it exceeds a fixed page size.
- **FR-17** Selecting a row in My Tickets shall open that ticket's Ticket Detail view.

### Requester Ticket Detail

- **FR-18** The system shall display, on Ticket Detail: Ticket Number, Ticket Date, Category,
  Related System, Requester, Requested Priority, IT Priority, Current Status, Ticket Owner
  (always unassigned in Lab 2), Summary, Description, and Resolution Summary (always empty in
  Lab 2), all read-only.
- **FR-19** The system shall display the ticket's Attachments — active and removed — directly on
  Ticket Detail, with no other section (no Event Log, no Service Actions, no Comments).

### Attachments

- **FR-20** The system shall allow a Requester to upload an attachment to a ticket, from Create
  Ticket (FR-11) or from Ticket Detail.
- **FR-21** The system shall accept only JPG, PNG, WEBP, and PDF files, each up to 5 MB, with no
  more than five active (non-removed) attachments per ticket.
- **FR-22** The uploader shall be able to soft-remove their own attachment: removal requires a
  confirmation dialog and a required reason (1..200 characters); the attachment's metadata
  (filename, uploader, size, upload date, removal reason, remover, removal date) remains visible
  in the Attachments list, clearly marked as removed; the file content becomes permanently
  inaccessible (preview/download blocked, HTTP 410). The binary is deleted from storage; the
  metadata row is never hard-deleted.
- **FR-23** Every attachment removal shall create an `ATTACHMENT_REMOVED` audit event recording
  filename, uploader, remover, reason, and timestamp.
- **FR-24** The system shall serve attachment downloads only through an ownership-scoped,
  authenticated endpoint.

## 5. Business Rules

- **BR-01** The official Ticket Number is generated by the backend and must be unique.
- **BR-02** A new Ticket begins with Current Status `New`.
- **BR-03** Lab 2 uses a Development Requester selector instead of login. The selected identity is
  for testing only and is not authentication.
- **BR-04** Current Status is one of: New, Assigned, In Progress, Pending Requester, Resolved,
  Closed, Cancelled. Only `New` is reachable in Lab 2; no Lab 2 code transitions a ticket out of
  it.
- **BR-05** Requested Priority and IT Priority are each one of: Low, Medium, High, Urgent.
- **BR-06** Requested Priority belongs to the Requester and is set at creation; IT Priority is
  system-copied from it at creation and is not editable in Lab 2.
- **BR-07** A Related System may be deactivated but never hard-deleted while referenced by any
  ticket.
- **BR-08** Attachments are limited to JPG, PNG, WEBP, PDF; maximum 5 MB per file; maximum five
  *active* attachments per ticket — removed attachments do not count against the limit, so a
  Requester can remove-and-replace.
- **BR-09** Only the uploader may remove their own attachment, and only with a required, non-blank
  reason (1..200 characters). Any other Development Requester gets 403 attempting to remove
  someone else's attachment. There is no elevated-role removal path in Lab 2.
- **BR-10** Ticket Numbers are unique, generated transactionally, `TKT-YYYY-NNNNN`, with an annual
  sequence reset.
- **BR-11** Ticket creation and attachment removal each write an audit event in the same database
  transaction as the underlying change.
- **BR-12** Tickets and their audit events are never hard-deleted.
- **BR-13** My Tickets search (`q`) is scoped to the requesting user's own tickets exactly like the
  status/category filters — it can never surface another requester's ticket, and combines with
  active filters using AND semantics. Search text is 1..100 characters after trim,
  case-insensitive substring matching, no wildcards/booleans/regex; an empty or whitespace-only
  value behaves as "no search," not a validation error.
- **BR-14** The Development Requester selection is validated server-side on every request, not
  only at selection time: a request carrying an inactive or unknown requester id is rejected and
  the client returns to the picker. This is an identity-presence check, not role-based
  authorization — Lab 2 has exactly one kind of caller.
- **BR-15** Ticket creation and attachment addition/removal each write an audit event even though
  Lab 2 has no UI or endpoint to read that history back.

## 6. UI Specification Summary

Full detail lives in `ui-spec.md`. Summary: the app uses the Zen Green token set (`ui-spec.md`
§1) across a shared header/nav, form, table/card, badge, and confirmation-dialog treatment. Four
screens ship: Development Requester Selection (`ui-spec.md` §3), Create Ticket (§4), My Tickets
(§5), and Requester Ticket Detail (§6) — each with defined loading, empty, validation, submitting,
success, and failure states, plus a full button hierarchy (primary/secondary/tertiary/destructive/
disabled/busy) and explicit attachment states (active/uploading/invalid/removed/unavailable). All
four screens meet the responsive rules in `ui-spec.md` §7 (desktop ≥ 992 px multi-column, tablet
768–991 px two-column, mobile < 768 px stacked with no horizontal scroll) and the accessibility
rules in §8.

### Non-Functional Requirements

- **NFR-01 Performance.** List and detail reads target p95 < 500 ms under seeded data volumes;
  file uploads are excluded from this target (large-file I/O dominates, not application logic).
- **NFR-02 Accessibility.** WCAG 2.2 AA: labelled form controls, visible focus indicators,
  keyboard-operable controls, accessible names on icon-only buttons.
- **NFR-03 Theming.** Every screen uses the Zen Green token set (`ui-spec.md` §1) exclusively — no
  hardcoded colors outside the token definitions.
- **NFR-04 Responsiveness.** Desktop ≥ 992 px, tablet 768–991 px, and mobile < 768 px each render
  with no horizontal page scroll and no clipped/overlapping content, per `ui-spec.md` §7.
- **NFR-05 Timestamp handling.** All timestamps are stored and transmitted in UTC (ISO-8601) and
  localized only at render time.
- **NFR-06 Identity-mechanism boundary.** The Development Requester Selection screen and its
  `x-dev-user-id` header are explicitly not an authentication mechanism; Lab 3 replaces them with
  real session-based login without changing any other endpoint's contract.
- **NFR-07 Auditability.** Ticket creation, attachment addition, and attachment removal each write
  an audit event in the same transaction as the underlying change, even though Lab 2 has no
  endpoint to read that history back.
- **NFR-08 Upload safety.** Attachment uploads are validated in layers per OWASP file-upload
  guidance: extension, declared MIME type, and magic-byte content sniff must all agree before a
  file is written to storage.

## 7. Data Changes

Entities needed for Lab 2 (full field lists in `references/TokTickIT-System-Level-SDS-v1.0.md`;
deltas below):

| Entity | Lab 2 delta from the SDS baseline |
|---|---|
| `User` (Development Requester) | Seeded; no password path used; `role` column present as SDS baseline schema but never branched on in Lab 2 code. |
| `Ticket` | All SDS fields; only `status = NEW` is reachable in Lab 2; `ownerId` always null. |
| `Category` | Seeded, Lab 1 carryover, `Int` PK; exactly 4 rows. |
| `RelatedSystem` | New, seeded, `Int` PK: `id, code, name, isActive`; at least 6 rows. |
| `Attachment` | All SDS fields plus `deletedReason` (string, required whenever `deletedAt` is set) for the required-reason soft removal. |
| `TicketEvent` | `TICKET_CREATED`, `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED` are the only event types Lab 2 writes; written for audit continuity, no Lab 2 read path. |
| `Comment`, `ServiceAction`, `Notification`, `Session` | Not shipped in Lab 2. |

**Seed data baseline** (§9 below has the assumption record for why these are exact numbers): at
least 4 stable active Development Requesters plus exactly 1 stable inactive Requester (fixed,
predictable seed identities); exactly the 4 required Categories, all active; at least 6 Related
Systems, all active, covering a realistic spread. The seed script is idempotent — it upserts by a
stable natural key (`email` for `User`, `code` for `Category`/`RelatedSystem`), not blind inserts,
so running it twice produces the same rows. The inactive Requester must never appear in the
Development Requester selector and must be rejected by the session-selection endpoint.

Key relationships: one Requester may own many Tickets; one Ticket belongs to one Requester; one
Ticket may have many Attachments; one Category may be used by many Tickets; one Related System may
be used by many Tickets. Indexes: `(requesterId, createdAt)` and `(requesterId, ticketNo)`/
`(requesterId, summary)` for search, `(status)`, `(categoryId)` for My Tickets filtering; soft
removal is represented by nullable `deletedAt`/`deletedById`/`deletedReason` on `Attachment`, never
a row delete.

**Migration approach.** The Lab 2 delta (new `RelatedSystem` table, new `deletedReason` column on
`Attachment`, the Lab-2-only `TicketEvent` types) ships as an additive Prisma migration on top of
the Lab 1 schema — no destructive column drops or renames. `role` on `User` and the
Comment/ServiceAction/Notification/Session tables from the SDS baseline stay present but unused,
so Lab 3 can turn them on without another migration that touches Lab 2's tables.

## 8. API Contract

Full detail lives in `api-spec.md`. Summary of the required capabilities: retrieve active
Categories, retrieve active Related Systems, retrieve active Development Requesters, select a
Development Requester (session), create a Ticket, retrieve the selected Requester's Tickets
(search/filter/sort/paginate), retrieve one owned Ticket, upload an Attachment, retrieve Attachment
metadata, download an active Attachment, and soft-remove an Attachment. All routes are under
`/api/v1`, JSON except upload/download, camelCase, ISO-8601 UTC timestamps, DTOs only. Standard
statuses: 200 retrieval, 201 create, 401 no/invalid identity, 403 ownership failure, 404 missing
resource, 409 conflict (attachment limit, stale version), 410 removed-attachment content, 413 file
too large, 422 validation failure.

## 9. Acceptance Criteria

- **AC-01** Given no Development Requester is selected, when the app loads, then the Development
  Requester Selection screen is shown before any ticket screen is reachable.
- **AC-02** Given the selection screen, when a seeded active Requester is selected, then the app
  navigates to My Tickets scoped to that requester.
- **AC-03** Given the inactive seeded Requester, when the picker loads, then that Requester does
  not appear in the list, and directly selecting their id is rejected.
- **AC-04** Given a requester is selected, when "Change Requester" is activated, then the stored
  selection clears and any cached requester-scoped data is discarded before the picker renders.
- **AC-05** Given valid Create Ticket data, when the Requester submits the form, then one Ticket
  is saved with status `New`, `ownerId` null, `itPriority === requestedPriority`, and the official
  Ticket Number is displayed.
- **AC-06** Given Create Ticket fields plus one or more staged attachments, when submitted and one
  staged attachment fails to upload, then the ticket still exists and Detail shows a per-file
  failure summary naming the failed file and reason.
- **AC-07** Given required Create Ticket fields left blank, when the Requester submits the form,
  then field-level error messages render next to their inputs and all previously entered values,
  including staged attachments, are preserved.
- **AC-08** Given tickets exist for more than one requester, when My Tickets loads for a selected
  requester, then only that requester's tickets are listed.
- **AC-09** Given a status filter, a category filter, and/or search text applied together, when
  the list refetches, then results satisfy all of them at once and remain scoped to the selected
  requester.
- **AC-10** Given zero tickets exist for the selected requester, when My Tickets loads with no
  filters or search active, then the "you haven't created any tickets yet" empty state is shown.
- **AC-11** Given a filter or search that matches nothing, when applied, then the "no tickets
  match" empty state with a working "Clear filters" action is shown, distinct from AC-10.
- **AC-12** Given Requester B is selected, when a Ticket belonging to Requester A is requested
  directly by its Detail URL, then the Ticket data is not returned and an access-denied state is
  shown.
- **AC-13** Given an active attachment, when the uploader removes it with a non-empty reason, then
  the attachment stays listed with removed status, its reason/remover/removal date visible, and
  its content endpoint returns 410.
- **AC-14** Given a removal request with a missing or blank reason, when submitted, then the API
  rejects it and the attachment remains active and unchanged.
- **AC-15** Given a ticket already has 5 active attachments, when a 6th is uploaded, then it is
  rejected; after one active attachment is removed, a new upload succeeds.
- **AC-16** Given a file that is not JPG/PNG/WEBP/PDF, or exceeds 5 MB, when uploaded, then it is
  rejected and never written to storage.
- **AC-17** Given My Tickets or Ticket Detail rendered at a viewport under 768 px, when displayed,
  then no horizontal page scroll occurs, and My Tickets renders as stacked cards rather than a
  table.
- **AC-18** Given a request whose identity is missing, unknown, or refers to the inactive seeded
  Requester, when any protected endpoint is called, then the response is rejected and the client
  returns to the Development Requester Selection screen.
- **AC-19** Given Ticket Detail for any ticket in Lab 2, when rendered, then no Event Log section
  and no Service Actions section or placeholder are present anywhere on the page.

## 10. Definition of Done

Lab 2 is done when:

- Every FR/BR in §4–§5 and every AC in §9 has at least one automated test, mapped by ID in
  `tests.md` §3, with a real file path.
- The seed baseline in §7 is met and its idempotency assertion passes.
- Server and client automated test suites pass, including the mandatory security/search/
  attachment/creation tests listed in `tests.md`, with ≥80% coverage on both.
- The Zen Green token verification checklist (`ui-spec.md` §1) passes against rendered output.
- No document in this set describes the pre-correction KMUTT-palette, invisible-header-identity,
  deferred-search, included-comments, or Event-Log/Service-Actions-in-Lab-2 version.
- Lab 1's existing tests still pass unmodified.
- README setup and test instructions are current.
- Lab 2's own Kanban (GitHub Project) has every planned Issue in Done.

**Review and demonstration evidence** (labsheet §8.10 row 10): a rendered `reviewer.md` naming the
reviewer, linking every PR reviewed, and recording comments given/received and responses; and, for
each of Create Ticket, My Tickets, and Ticket Detail, readable screenshots demonstrating the
initial/loading/validation/submitting/success/failure states called for in §8.6 and the `ui-spec.md`
state definitions — both required as submission evidence per §14, not merely as internal QA.

GitHub Issue decomposition for this sprint lives in the repository's GitHub Issues and Project
board, not duplicated in this document — see §10's Kanban-in-Done requirement above. The required
submission PDF (labsheet §13.2/§14) is compiled at submission time from this document set plus the
screenshot/link evidence in the table above; it is not a separate authored document.

## 11. Assumptions and Decisions

Explicit record of where this spec set had to fill a gap the labsheet leaves as a fixed handout
value to operationalize rather than an open question — the Zen Green tokens and seed counts below
are the labsheet's own numbers, restated here so they are testable, not assumptions this spec
invents:

- **Zen Green tokens.** The labsheet's §7 table (page 8) gives the exact published values used
  throughout: Primary `#006B3C`, Secondary `#0B7A46`, Pale `#EAF6EF`, page background `#F5F7F6`,
  plus the Surface/Text/Editable/Read-only/Error/Warning/Success rows. `ui-spec.md` §1 mirrors that
  table.
- **Search query syntax.** The labsheet requires search (§1, §4.3) but does not define its exact
  syntax. This spec fixes it as plain case-insensitive substring matching on Ticket Number and
  Summary, no wildcards/booleans/regex, 1..100 characters (BR-13).
- **Seed data counts.** The labsheet's §5.3 (page 6–7) says "at least four active Development
  Requesters," "at least one inactive Development Requester," "the four required Categories," and
  "at least six realistic Related Systems." This spec keeps those as the literal minimums so
  seeding is objectively verifiable rather than "some rows exist" — they are the labsheet's own
  numbers, not an invented style-guide addition.
- **Event Log and Service Actions removal.** An earlier draft of this spec set read the eventual
  full ticket-detail mockup (Figure 1, which does show an Event Log and, in later labs, Service
  Actions and Public Comments) as license for an empty/placeholder version in Lab 2. The labsheet's
  own text is explicit that this increment is "read-only ticket details plus the attachment
  lifecycle" (§4.2, §8.5) — TicketEvent rows are still written (BR-11/BR-15 require it
  independently), only the read/display path is out of scope.
- **No role-based access control.** Lab 2 implements ownership-only access control. The `User.role`
  column exists as SDS baseline schema but is inert in Lab 2 — no code path branches on it, per
  the labsheet's §4.2 exclusion of "authentication and real role-based authorization."
