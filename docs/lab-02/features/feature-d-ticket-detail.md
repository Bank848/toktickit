# Feature-D — Requester Ticket Detail

**Identity.** FEAT-D, Requester Ticket Detail, v1.1, Lab 2. Revised 2026-08-21 (third pass) to
remove the Service Actions and Event Log tabs entirely, per D-22 and the labsheet's §4.2/§8.5
scope ("read-only ticket details plus the attachment lifecycle only" — no tab chrome at all).
**Traceability.** FR-18, FR-19 (spec §4) · NFR-02, NFR-03, NFR-05 · D-13, D-14, D-15, D-16, D-21, D-22, D-24.
**Behavior.** Actor: the currently selected Development Requester. Header card shows Ticket
Number, Ticket Date, Category, Related System, Requester, Requested Priority, IT Priority,
Current Status, Ticket Owner, Summary, Description, Resolution Summary — matching the labsheet's
field layout. All fields are read-only in Lab 2 (non-editable field styling). The Attachments
section (Feature-F) renders directly below the header block — **no tab chrome, no Service
Actions section, no Event Log section, no Public Comments section**: Lab 2's Ticket Detail is
read-only fields plus the attachment lifecycle only (D-22). Feature-E and the Comment entity
remain removed from Lab 2 scope entirely per D-15.
Deep-link /tickets/:id works on refresh; both an unknown ticket id and one belonging to another
Requester render the same Not Found view.
**Permissions.** The selected Development Requester may read a ticket only if
`ticket.requesterId === req.user.id`, else 404 (corrected 2026-08-22, PR #14 peer review, D-24 —
a 403 here would confirm the ticket exists, which is exactly what this check is meant to hide).
There is no second branch for any other kind of caller — Lab 2 has no role-based access control
(D-21).
**Workflow.** Read-only in Lab 2; no status-changing action is reachable (D-14 — confirm/reject
resolution, request reopen, cancel are deferred to Lab 3).
**Data.** Ticket; Attachment (active + removed). `TicketEvent` rows are written elsewhere
(Feature-B, Feature-F) for audit continuity but are not read by this feature — there is no events
endpoint in Lab 2 (D-22).
**API.** GET /api/v1/tickets/:id (#8 in `api-spec.md`); the Attachments section uses #9.
**UI.** See `ui-spec.md` §6. Breadcrumb "My Tickets > Ticket Details" + "Back to My Tickets"
button. Header card, read-only fields in a Bootstrap grid, 4-up at lg, 2-up at md, 1-up on
mobile. Read-only fields use the Read-only-field token (`#F0F3F1` background), visually distinct
from editable inputs on Create Ticket. Attachments section immediately follows the header card:
loading, empty ("No attachments yet"), error with retry, and — after any mutation — a refetch of
server state rather than optimistic local mutation. Not Found (404) renders as a dedicated
full-page view, not an inline alert — the same view for a missing ticket and an inaccessible one,
since the response body is identical for both.
**NFRs.** WCAG 2.2 AA (NFR-02); localized timestamps stored in UTC (NFR-05); Zen Green theme (NFR-03).
**Dependencies.** Feature-B (ticket must exist), Feature-F, Feature-G (Development Requester
Selection).
**Out of scope.** Public Comments / Internal Notes / Actions Taken (Feature-E, removed per D-15),
Service Actions and Event Log display in any form including an empty placeholder (removed per
D-22), confirm/reject resolution, request reopen, cancel, edit, owner assignment.
