# Feature-D — Ticket Detail

**Identity.** FEAT-D, Ticket Detail, v1.0, Lab 2.
**Traceability.** FR-018…FR-021 · NFR-003, NFR-004, NFR-007 · D-13, D-14, D-15, D-16.
**Behavior.** Actor: any user authorized to view the ticket. Header card shows Ticket No,
Ticket Date, Category, Related System, Requester, Requested Priority, IT Priority, Current
Status, Ticket Owner, Summary, Description, Resolution Summary — matching Labsheet §1.2 and the
mockup's field layout. All fields are read-only in Lab 2 (non-editable field styling per
Labsheet §1.4). Tabs: Public Comments (Feature-E), Attachments (Feature-F), Event Log.
Deep-link /tickets/:id works on refresh; unauthorized -> Access Denied view; unknown id -> Not
Found view (both are Labsheet §1.3 screens, cheap to add now).
**Permissions.** A REQUESTER may read a ticket only if ticket.requesterId === req.user.id, else
403 (not 404). IT_STAFF/ADMINISTRATOR may read all — the role branch is implemented now even
though no IT Staff screen exists, because the rule is cheap and the test proves FR-007.
**Workflow.** Read-only in Lab 2; no status-changing action is reachable (D-14 — confirm/reject
resolution, request reopen, cancel are deferred to Lab 3).
**Data.** Ticket, TicketEvent (§13 events endpoint); tabs read Comment (§7) and Attachment (§9).
**API.** GET /api/v1/tickets/:id (#6), GET /api/v1/tickets/:id/events (#13); tabs use #7
(comments) and #9 (attachments).
**UI.** W4 concern, not part of Issues 5-8. Breadcrumb "My Tickets > Ticket Details" + "Back to
My Tickets" button. Header card, read-only fields in a Bootstrap grid, 4-up at lg, 2-up at md,
1-up on mobile — same field order as the mockup. Read-only fields use the muted-surface,
non-editable style demanded by Labsheet §1.4, visually distinct from editable inputs on Create
Ticket. Tabs (Bootstrap nav-tabs, keyboard-navigable, each with a count badge): Public Comments,
Attachments, Event Log (reverse-chronological summaryText + actor + timestamp, read-only).
States per tab: loading, empty, error with retry, and — after any mutation — a refetch of
server state rather than optimistic local mutation. Access Denied (403) and Not Found (404)
render as dedicated full-page views, not inline alerts.
**NFRs.** WCAG 2.2 AA; localized timestamps stored in UTC (NFR-007).
**Dependencies.** Feature-B (ticket must exist), Feature-E, Feature-F, identity middleware.
**Out of scope.** Service Actions tab (no ServiceAction model exists in Lab 2 — omit the tab
rather than render a permanently-empty one), confirm/reject resolution, request reopen, cancel,
edit, owner assignment, internal notes.
