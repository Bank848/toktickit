# Feature-D — Ticket Detail

**Identity.** FEAT-D, Ticket Detail, v1.0, Lab 2.
**Traceability.** FR-019, FR-020, FR-021, FR-021b · NFR-003, NFR-004, NFR-007 · D-13, D-14,
D-15, D-16.
**Behavior.** Actor: any user authorized to view the ticket. Header card shows Ticket No,
Ticket Date, Category, Related System, Requester, Requested Priority, IT Priority, Current
Status, Ticket Owner, Summary, Description, Resolution Summary — matching the labsheet's field
layout. All fields are read-only in Lab 2 (non-editable field styling). **Tabs: Attachments
(Feature-F, default open), Service Actions (empty placeholder — no ServiceAction model ships in
Lab 2), Event Log — three tabs. There is no Public Comments tab: Feature-E and the Comment
entity are removed from Lab 2 scope entirely per D-15's 2026-08-21 correction** (the official
labsheet explicitly excludes Public Comments, Internal Notes, and Actions Taken from Lab 2,
grouped with the later-lab role-specific IT Staff controls and workflow).
Deep-link /tickets/:id works on refresh; unauthorized -> Access Denied view; unknown id -> Not
Found view.
**Permissions.** A REQUESTER may read a ticket only if ticket.requesterId === req.user.id, else
403 (not 404). IT_STAFF/ADMINISTRATOR may read all — the role branch is implemented now even
though no IT Staff screen exists, because the rule is cheap and the test proves FR-007.
**Workflow.** Read-only in Lab 2; no status-changing action is reachable (D-14 — confirm/reject
resolution, request reopen, cancel are deferred to Lab 3).
**Data.** Ticket, TicketEvent (events endpoint); Attachments tab reads Attachment (active +
removed).
**API.** GET /api/v1/tickets/:id (#8 in `api-spec.md`), GET /api/v1/tickets/:id/events (#13);
Attachments tab uses #9.
**UI.** See `ui-spec.md` §6. Breadcrumb "My Tickets > Ticket Details" + "Back to My Tickets"
button. Header card, read-only fields in a Bootstrap grid, 4-up at lg, 2-up at md, 1-up on
mobile. Read-only fields use a muted-surface, non-editable style, visually distinct from
editable inputs on Create Ticket. Tabs (Bootstrap nav-tabs, keyboard-navigable): Attachments
(default open, count badge), Service Actions (always empty in Lab 2 — a labelled empty state,
not a hidden or omitted tab, so the tab structure matches the eventual full ticket view), Event
Log (reverse-chronological summaryText + actor + timestamp, read-only). States per tab: loading,
empty, error with retry, and — after any mutation — a refetch of server state rather than
optimistic local mutation. Access Denied (403) and Not Found (404) render as dedicated full-page
views, not inline alerts.
**NFRs.** WCAG 2.2 AA; localized timestamps stored in UTC (NFR-007); Zen Green theme (NFR-008).
**Dependencies.** Feature-B (ticket must exist), Feature-F, Feature-A (Development Requester
Selection).
**Out of scope.** Public Comments / Internal Notes / Actions Taken (Feature-E, removed from
Lab 2 per D-15), Service Action creation/lifecycle (tab is read-only/empty), confirm/reject
resolution, request reopen, cancel, edit, owner assignment.
