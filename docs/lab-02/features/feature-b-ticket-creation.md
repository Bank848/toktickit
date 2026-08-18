# Feature-B — Ticket Creation

**Identity.** FEAT-B, Ticket Creation, v1.0, Lab 2.
**Traceability.** FR-008…FR-013, FR-008b · BR-001, BR-002, BR-009, BR-014, BR-015 ·
NFR-001, NFR-003 · D-03, D-10, D-13, D-16, D-18.
**Behavior.** Actor: Requester (IT Staff/Admin also permitted per Labsheet, but no IT screen
exists in Lab 2). Precondition: identity resolved, >=1 active category. Main flow: open Create
Ticket -> fill summary/description/category/priority (+optional related system) -> submit ->
server validates, allocates ticket number, persists, emits `TICKET_CREATED` -> client navigates
to the new Ticket Detail showing the ticket number. Alternatives: validation failure re-renders
with field errors and **preserves all entered input**; category deactivated between page load
and submit -> 422 with a field error on category. Acceptance: a created ticket has status NEW,
ownerId null, itPriority === requestedPriority, a unique TKT-YYYY-NNNNN, and exactly one
TICKET_CREATED event.
**Permissions.** Any authenticated user creates; requesterId is always req.user.id and is never
accepted from the body.
**Workflow.** Entry into NEW only. No transitions defined here.
**Data.** Ticket, TicketCounter, TicketEvent. Transaction boundary = number + insert + event.
**API.** POST /api/v1/tickets (+ GET /categories, GET /related-systems for form data).
**UI.** W4 concern, not part of Issues 5-8. Single-column card, fields in order: Summary
(text, required, live char counter to 150) - Category (select, required, active only,
placeholder "Select a category") - Related System (select, optional, "Not applicable" default)
- Requested Priority (select, required, default Medium) - Description (textarea, 6 rows,
required, counter to 5000). Actions: Create Ticket (primary, orange) and Cancel (link back to
/tickets). States: loading, empty (no active categories), submitting (double-submit disabled),
field errors (input preserved), global error with retry, success (navigate to detail with
success alert carrying the new ticket number).
**NFRs.** p95 < 500ms; WCAG 2.2 AA form labelling; double-submit disabled while in flight.
**Dependencies.** Seeded categories, related systems, identity middleware.
**Out of scope.** Attaching files at creation (deferred — after-creation only; SRS FR-012 says
attachment "at creation time or afterward" but Lab 2 implements afterward only, since
attach-at-creation needs either a pre-created draft ticket or temp-object staging with orphan
cleanup, real complexity for a cosmetic gain, and the mockup's Attachments tab lives on Ticket
Detail anyway — FR-012 is therefore partially satisfied in Lab 2, noted in the traceability
matrix rather than silently dropped), draft saving, ticket editing, IT Priority entry, requester
selection.
