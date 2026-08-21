# TokTickIT — Lab 2 Specification (Requester Ticketing MVP with UI Foundations)

**Status:** Corrected 2026-08-21 against the official Lab 2 labsheet and lecture deck, per PR #14
review. This is the required, self-contained Lab 2 contract deliverable. It consolidates the
approved System-Level SDS (`references/TokTickIT-System-Level-SDS-v1.0.md`, D-01...D-12), the SRS
draft (`references/TokTickIT-SRS-and-Feature-Inventory-draft-v0.1.md`), and the Lab 2 Decision
Register Addendum (`decision-register-addendum.md`, D-13...D-20) into one document scoped to what
Lab 2 actually implements. Where any reference document conflicts with this file, this file wins
for Lab 2.

Companion deliverables: `ui-spec.md` (screens, Zen Green tokens, responsive/accessibility rules),
`api-spec.md` (endpoints, DTOs), `tests.md` (test plan and Definition of Done),
`traceability-matrix.md` (every acceptance criterion mapped to a test).

## 1. Scope

Lab 2 implements the **Requester-facing** slice of TokTickIT:

- Create Ticket (with create-time attachment upload)
- My Tickets (list, filter, search, sort, paginate)
- Ticket Detail (fields, Attachments tab, read-only Event Log, read-only empty Service Actions
  placeholder)
- Attachments (upload, download, soft removal with reason)
- Development Requester Selection (test-identity scaffolding, not authentication)

**Explicitly out of scope for Lab 2** (later labs, per the labsheet's own "later labs will add"
list):

- Public Comments / Internal Notes / Actions Taken (Feature-E and the `Comment` entity — see
  D-15 correction; removed entirely, not deferred-with-scaffolding)
- Role-specific IT Staff controls: ticket ownership/assignment, IT Priority changes, Resolve/
  Close, Service Action creation/lifecycle, cancel/reopen execution
- Real authentication: Login screen, First Password Change, password verification, `Session`
  model, CSRF protection (D-18)
- Notifications (in-app indicator)
- Category/Related System administration screens (the reference tables themselves are seeded and
  read by Create Ticket in Lab 2; the admin management UI is later)

## 2. Roles in Lab 2

Only the **Requester** role has a UI in Lab 2. The `User` model and role enum (Requester, IT
Staff, Administrator) ship complete per the SDS, and server-side authorization branches for
IT Staff/Administrator are implemented where cheap (e.g., the read-access rule on
`GET /tickets/:id`), but no IT Staff/Administrator screen exists. The active "requester" for
manual and automated testing is chosen via the Development Requester Selection screen (D-18),
never hardcoded and never asserted via a raw header value invisible to the user.

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
- **FR-006** The system shall restrict every protected operation according to role and
  resource-ownership rules (Authorization Model, SDS). A Requester may access only tickets they
  requested; IT Staff/Administrator read-access rules are implemented server-side even though no
  IT Staff screen exists in Lab 2.
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
  file(s) failed and why, and may retry the upload from the Attachments tab. A ticket is never
  lost because a later attachment upload failed.
- **FR-013** Ticket creation shall write a `TICKET_CREATED` TicketEvent recording the requester,
  timestamp, and initial field values, in the same transaction as the ticket insert.

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
- **FR-021** The system shall display the ticket's TicketEvent history (Event Log tab) to any
  user authorized to view the ticket, read-only.
- **FR-021b** (new) Ticket Detail shall show a Service Actions tab that is present but always
  empty in Lab 2 (no Service Action creation exists yet) — a labelled empty state, not a hidden
  or missing tab, so the tab structure matches the eventual full ticket view.

*(FR-022/FR-023, requester resolution confirmation/reject/reopen-request UI, remain out of scope
for Lab 2 per D-14 — the ticket never leaves `NEW` in Lab 2, so these controls have nothing to
act on. Modeled in the data layer per D-14, no Lab 2 endpoint or UI.)*

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
  filename, uploader, remover, reason, and timestamp.
- **FR-031** The system shall serve attachment downloads only through an authenticated,
  authorized endpoint that streams from local disk storage (D-20b) behind a storage-adapter
  interface written against SeaweedFS (D-06).

## 4. Business Rules (Lab 2 scope, corrected)

- **BR-001** Ticket status is one of: New, Assigned, In Progress, Pending Requester, Resolved,
  Closed, Cancelled. Only `New` is reachable in Lab 2.
- **BR-002** Priority (Requested and IT) is one of: Low, Medium, High, Urgent.
- **BR-006 / BR-007** (D-13) Only IT Staff or Administrator may cancel or reopen a ticket. No
  Lab 2 UI or endpoint executes these — Lab 2 has no reachable status besides `New`.
- **BR-009** Requested Priority belongs to the Requester and is set at creation; IT Priority is
  system-copied from it at creation and is not editable in Lab 2 (no IT Staff screen exists).
- **BR-011b** (D-16) A Related System may be deactivated but never hard-deleted while referenced
  by any ticket.
- **BR-012** Attachments are limited to JPG, PNG, WEBP, PDF; maximum 5 MB per file; maximum 5
  *active* attachments per ticket (removed attachments do not count against the limit, so a
  Requester can remove-and-replace).
- **BR-013** (corrected, D-17-adjacent removal rule) The uploader of an attachment may remove it
  only while the ticket is not Closed (unreachable in Lab 2, so effectively always permitted in
  Lab 2), and only with a required reason. IT Staff/Administrator removal-with-reason for another
  user's attachment is Lab 3 — a non-uploader gets 403 in Lab 2, including IT Staff/Administrator.
- **BR-014** Ticket numbers are unique, generated transactionally, `TKT-YYYY-NNNNN`, annual
  sequence reset.
- **BR-015** Ticket creation and attachment removal each write a TicketEvent in the same database
  transaction as the underlying change.
- **BR-016** Tickets and TicketEvents are never hard-deleted.
- **BR-017** A stale ticket update (optimistic `version`) is rejected with HTTP 409. (No Lab 2
  endpoint currently updates an existing ticket's mutable fields, so this rule has no Lab 2 test
  surface yet beyond the field being present on the DTO; it is exercised starting Lab 3.)
- **BR-019** (new, D-17) My Tickets search (`q`) is scoped to the requesting user's own tickets
  exactly like the status/category filters — it can never surface another requester's ticket,
  and combines with active filters using AND semantics.
- **BR-020** (new, D-18) The Development Requester Selection is validated server-side on every
  request (not only at selection time): a request carrying an inactive or unknown requester id
  is rejected 401 and the client returns to the picker. This is test scaffolding, explicitly not
  a security control — Lab 3 replaces it with real session-based authentication.

## 5. Non-Functional Requirements (Lab 2 scope)

- **NFR-001 Performance:** p95 API response under 500 ms for normal CRUD at 50 concurrent users;
  uploads excluded.
- **NFR-002 Security:** Role/ownership checks enforced server-side on every protected endpoint;
  hiding a UI control is never sufficient. The Development Requester Selection (D-18) is
  explicitly not a security boundary and must be documented as such everywhere it appears.
- **NFR-003 Accessibility:** WCAG 2.2 Level AA for every Requester-facing screen, including the
  Development Requester Selection screen.
- **NFR-004 Auditability:** Every material Lab 2 change (ticket creation, attachment
  addition/removal) is traceable via an append-only TicketEvent.
- **NFR-007 Localization:** Dates/times stored in UTC, displayed in the user's locale.
- **NFR-008 Branding (corrected, D-19):** The UI uses the **Zen Green** theme defined in
  `ui-spec.md`, not the general-course KMUTT palette (SDS D-09, superseded for TokTickIT by
  D-19).
- **NFR-009 Responsive (new, D-19):** Every Lab 2 screen renders usably at the Bootstrap `xs`
  breakpoint (< 576 px) through `lg` and above, with no horizontal page scroll at any breakpoint
  — see `ui-spec.md` "Responsive rules."

## 6. Data Model (Lab 2 scope)

Entities shipped in Lab 2 (full field lists in the SDS reference copy, deltas below):

| Entity | Lab 2 delta from the SDS baseline |
|---|---|
| `User` | Seeded; no password verification path used (D-18); role enum ships complete. |
| `Ticket` | All SDS fields; only `status = NEW` is reachable; `ownerId` always null. |
| `Category` | Seeded, Lab 1 carryover, `Int` PK (D-20c). |
| `RelatedSystem` | New, seeded, `Int` PK (D-16, D-20c): `id, code, name, isActive`. |
| `Attachment` | All SDS fields plus `deletedReason` (string, required when `deletedAt` is set) — needed for the required-reason soft removal in FR-028. |
| `TicketEvent` | `TICKET_CREATED`, `ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED` are the only event types Lab 2 writes. |
| `Comment` | **Not shipped in Lab 2** (D-15 correction). |
| `ServiceAction`, `Notification`, `Session` | Not shipped in Lab 2 (later labs). |

## 7. Feature Inventory (Lab 2 column, corrected)

| ID | Feature | Lab 2? |
|---|---|---|
| Feature-A | Development Requester Selection (Lab 2 slice of Authentication/Access Control) | **Yes** |
| Feature-B | Ticket Creation (incl. create-time attachment upload) | **Yes** |
| Feature-C | My Tickets (list, filter, search, sort, paginate) | **Yes** |
| Feature-D | Ticket Detail (fields, Attachments, read-only Event Log, empty Service Actions placeholder) | **Yes** |
| Feature-E | Ticket Comments | **No — removed from Lab 2 (D-15 correction)** |
| Feature-F | Attachments (upload, download, soft removal with reason) | **Yes** |
| Feature-G..R | Ownership, workflow, priority, service actions, notifications, admin, real auth, dashboards | Later labs |

## 8. Definition of Ready

This specification, together with `ui-spec.md`, `api-spec.md`, `tests.md`, and
`traceability-matrix.md`, is considered ready for implementation when every acceptance criterion
in this document maps to at least one planned test with a real file path in
`traceability-matrix.md`, and no document in this set still describes the pre-correction
KMUTT-palette / invisible-header-auth / deferred-search / included-comments version.
