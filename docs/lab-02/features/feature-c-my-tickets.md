# Feature-C — My Tickets

**Identity.** FEAT-C, My Tickets, v1.0, Lab 2.
**Traceability.** FR-007, FR-014…FR-018 · NFR-001, NFR-003 · D-13, D-17, D-18.
**Behavior.** Actor: Requester. Requester sees only their own tickets, all statuses, newest
first; filter by status and category; paginate; click row -> Detail. Empty state distinguishes
"you have no tickets yet" (offers Create Ticket) from "no tickets match these filters" (offers
Clear filters) — these are different user situations and must not share one message.
**Permissions.** Server-side scoping only — a REQUESTER cannot widen the scope by any query
parameter (the server always scopes to req.user.id for a REQUESTER; `?requesterId=` is never
honoured, per §3.3 #5 of the API contract).
**Workflow.** Read-only; no state transitions.
**Data.** Read-only. Indexes `(requesterId, createdAt)`, `(status)`, `(categoryId)`.
**API.** GET /api/v1/tickets (#5), with query params: status (repeatable), categoryId, page
(default 1, min 1), pageSize (default 10, clamped to max 50), sort (whitelist only —
createdAt:desc default, createdAt:asc, updatedAt:desc, ticketNo:asc; unknown sort -> 422).
**UI.** W4 concern, not part of Issues 5-8. Page header "My Tickets" + primary "Create Ticket"
button. Filter bar: Status (multi-select or chips) - Category (select) - Clear filters. Filter
state lives in the URL query string. Desktop (md+): table with columns Ticket No, Summary,
Category, Status, Requested Priority, Last Updated — whole row a real `<a>` link to detail.
Mobile (< md): stacked cards instead of a horizontally-scrolling table. States: loading skeleton
rows, two distinct empty states, error with Retry, pagination footer ("Showing 1-10 of 37"),
hidden when totalPages === 1.
**NFRs.** p95 < 500ms; WCAG 2.2 AA.
**Dependencies.** Feature-B (tickets must exist), identity middleware.
**Out of scope.** Free-text search (D-17, moved to FR-016b/Feature-O/Lab 3+, stretch item on
Issue 14 if time remains), saved views, CSV export, bulk actions, cross-requester views.
