# Feature-B — Ticket Creation

**Identity.** FEAT-B, Ticket Creation, v1.0, Lab 2.
**Traceability.** FR-008…FR-013, FR-008b · BR-001, BR-002, BR-009, BR-014, BR-015 ·
NFR-001, NFR-003 · D-03, D-10, D-13, D-16, D-18.
**Behavior.** Actor: the currently selected Development Requester — Lab 2 has no other kind of
caller (D-21). Precondition: a Development Requester is selected (D-18), >=1 active category.
Main flow: open Create Ticket -> fill summary/description/category/priority (+optional related
system) -> optionally stage one or more attachment files -> submit -> server creates the ticket
(validates, allocates ticket number, persists, emits `TICKET_CREATED`, all in one transaction)
-> client then uploads each staged file, in sequence, against the new ticket's id (FR-012,
create-then-upload) -> client navigates to the new Ticket Detail showing the ticket number and
any per-file upload failures. Alternatives: validation failure re-renders with field errors and
**preserves all entered input**, including staged (not-yet-uploaded) attachments; category
deactivated between page load and submit -> 422 with a field error on category; a staged
attachment fails upload after the ticket is created -> the ticket is **not** rolled back, deleted,
or hidden — Detail shows it with a failure summary, and the Requester can retry the upload from
the Attachments tab (see Feature-F). Acceptance: a created ticket has status NEW, ownerId null,
itPriority === requestedPriority, a unique TKT-YYYY-NNNNN, and exactly one TICKET_CREATED event,
regardless of whether any staged attachment upload succeeded.
**Permissions.** Any selected Development Requester creates; requesterId is always
req.user.id (the selected requester) and is never accepted from the body. No role check — Lab 2
has no roles (D-21).
**Workflow.** Entry into NEW only. No transitions defined here.
**Data.** Ticket, TicketCounter, TicketEvent. Transaction boundary = number + insert + event.
**API.** POST /api/v1/tickets (#6 in `api-spec.md`, + GET /categories, GET /related-systems for
form data), then POST /api/v1/tickets/:id/attachments (#10) once per staged file.
**UI.** See `ui-spec.md` §4. Single-column card, fields in order: Summary (text, required, live
char counter to 150) - Category (select, required, active only, placeholder "Select a category")
- Related System (select, optional, "Not applicable" default) - Requested Priority (select,
required, default Medium) - Description (textarea, 6 rows, required, counter to 5000) -
Attachments (multi-file picker, client-side advisory pre-check of type/size, staged list with
per-file remove-before-submit). Actions: Create Ticket (primary, Zen Green) and Cancel (link back
to /tickets). States: loading, empty (no active categories), submitting (double-submit disabled),
field errors (input and staged attachments preserved), global error with retry (network/server
failure on ticket creation itself), success (navigate to detail with success alert carrying the
new ticket number and, if any staged upload failed, a dismissible per-file failure summary).
**NFRs.** p95 < 500ms (create-ticket call; attachment uploads excluded per SDS); WCAG 2.2 AA form
labelling; double-submit disabled while in flight; Zen Green theme (NFR-008).
**Dependencies.** Seeded categories, related systems, Feature-A (Development Requester
Selection), Feature-F (attachment upload path, reused for create-time uploads).
**Out of scope.** Draft saving, ticket editing, IT Priority entry, requester selection beyond the
Development Requester Selection screen (Feature-A).
