# Feature-C — My Tickets

**Identity.** FEAT-C, My Tickets, v1.0, Lab 2.
**Traceability.** FR-007, FR-014…FR-018 · BR-019 · NFR-001, NFR-003 · D-13, D-17, D-18.
**Behavior.** Actor: Requester. Requester sees only their own tickets, all statuses, newest
first; filter by status and category, **search by free text across ticket number and summary
(D-17, corrected — search is in Lab 2 scope, not deferred)**, combined with AND semantics;
paginate; click row -> Detail. Empty state distinguishes "you have no tickets yet" (offers Create
Ticket) from "no tickets/no matches for your filters or search" (offers Clear filters) — these
are different user situations and must not share one message.
**Permissions.** Server-side scoping only — the selected requester cannot widen the scope by any
query parameter (the server always scopes to req.user.id; `?requesterId=` is never honoured, per
`api-spec.md` §3). Lab 2 has no role-based branch to widen this with (D-21).
**Workflow.** Read-only; no state transitions.
**Data.** Read-only. Indexes `(requesterId, createdAt)`, `(status)`, `(categoryId)`, and a
`(requesterId, ticketNo)`/`(requesterId, summary)` search-friendly index pair for `q`.
**API.** GET /api/v1/tickets (#7 in `api-spec.md`), with query params: status (repeatable),
categoryId, `q` (free text, 1..100 chars, case-insensitive substring on ticketNo/summary), page
(default 1, min 1), pageSize (default 10, clamped to max 50), sort (whitelist only —
createdAt:desc default, createdAt:asc, updatedAt:desc, ticketNo:asc; unknown sort -> 422).
**UI.** See `ui-spec.md` §5. Page header "My Tickets" + primary "Create Ticket" button. Filter
bar: Search (text input) - Status (multi-select) - Category (select) - Clear filters, all
combined with AND semantics, debounced ~300ms on search. Filter/search state lives in the URL
query string. Desktop (md+): table with columns Ticket No, Summary, Category, Status, Last
Updated — whole row a real `<a>` link to detail. Mobile (< md): stacked cards instead of a
horizontally-scrolling table. States: loading skeleton rows, two distinct empty states, error
with Retry, pagination footer ("Showing 1-10 of 37"), hidden when totalPages === 1.
**NFRs.** p95 < 500ms; WCAG 2.2 AA; Zen Green theme tokens (NFR-008); responsive with no
horizontal scroll (NFR-009).
**Dependencies.** Feature-B (tickets must exist), Feature-A (Development Requester Selection).
**Out of scope.** Saved views, CSV export, bulk actions, cross-requester views.
