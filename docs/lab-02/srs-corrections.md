# TokTickIT SRS — Lab 2 Corrections

Applied to `TokTickIT-SRS-and-Feature-Inventory-draft-v0.1.md` on 2026-08-18, per Decision
Register Addendum D-13/D-15/D-16/D-17.

## FR-023 (rewritten, per D-13)

Was: "An authorized user may cancel or reopen an accessible ticket."
Now: "A Requester may confirm or reject a proposed resolution, and may request that a
Resolved/Closed ticket be reopened; only IT Staff or Administrator may execute the actual
status change (including Cancelled and reopening)."

## BR-006 / BR-007 (rescoped, per D-13)

BR-006 ("Any authorized user may cancel an accessible ticket") → rescoped to: "Only IT Staff
or Administrator may cancel a ticket."
BR-007 ("Any authorized user may reopen a Resolved/Closed/Cancelled ticket") → rescoped to:
"Only IT Staff or Administrator may execute a reopen; a Requester may only request one
(BR-008b)."

## BR-008b (new, per D-13)

"A Requester may reject a proposed resolution; rejection records a TicketEvent and a
`requesterResolutionConfirmedAt = null` state, and does not itself change ticket status."

## FR-016 (resolved, per D-17) / FR-016b (new)

FR-016 "[NEW]" marker resolved: stays as ticket-list filtering by status and category only.
FR-016b (new, Feature-O, Lab 3+): free-text search across a Requester's own tickets.

## FR-008b (new, per D-16)

"A Requester may optionally associate a ticket with a Related System from an
administrator-managed list at creation time."

## BR-011b (new, per D-16)

"A Related System may be deactivated but never hard-deleted while referenced by any ticket."

## FR-024 / FR-025 (confirmed, per D-15)

Both confirmed as originally drafted — no rewrite needed, only the domain-model gap (missing
`Comment` entity) that these FRs depend on is now closed by D-15.
