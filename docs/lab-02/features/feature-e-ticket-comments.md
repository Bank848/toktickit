# Feature-E — Ticket Comments

**Identity.** FEAT-E, Ticket Comments, v1.0, Lab 2.
**Traceability.** FR-024, FR-025, BR-018 · D-15.

**Grading-risk flag carried forward from D-15 (see `docs/lab-02/decision-register-addendum.md`,
also §8 item 0 of the Lab 2 implementation plan — highest priority open question, flagged by
the Opus review pass).** The lecture's own caption assigns "communication" to later labs
("Later labs will add role-specific IT Staff controls, communication, workflow, and Actions
Taken"), and the W4 activity line never names comments. The counter-argument — "respond to IT
Staff" is a named Requester ability in Labsheet §1.1, and the mockup's default-open tab is
Public Comments — keeps this a defensible call, not an error, but it is the single largest scope
addition in this plan beyond what the lecture explicitly assigns to Lab 2. This feature stays
CONFIRMED for W3 (Issues 5-8) since no comment code ships until Issue 10 (W4). **Re-confirm with
the TA before Issue 10 starts** — Issue 10 is kept severable from Issues 9 and 11 specifically
so this can be dropped or reduced to a read-only tab late without disturbing the rest of the
plan.

**Behavior.** Actor: any user who can read the ticket (Requester, IT Staff, Administrator).
Author posts a comment (1..2000 chars, trimmed, rejected if blank after trim); it appears at the
appropriate end of the thread without a full page reload; each entry shows author display name,
a role badge (Requester / IT Support), body, and localized timestamp. Comments are immutable —
no edit or delete endpoint exists in Lab 2, and the mockup's per-comment "..." menu is therefore
not implemented.
**Permissions.** Any user who can read the ticket may comment. authorId is always req.user.id
(BR-018: never post on another's behalf).
**Workflow.** No status impact; posting a comment does not change ticket status.
**Data.** Comment + COMMENT_ADDED event, one transaction.
**API.** GET /api/v1/tickets/:id/comments (#7, paged, oldest->newest), POST
/api/v1/tickets/:id/comments (#8).
**UI.** W4 concern, not part of Issues 5-8. Composer at top of the Public Comments tab (textarea
+ "Post Comment", disabled while empty or posting), then the thread: avatar initials, author
name, role badge, timestamp, body. Empty state "No comments yet."
**NFRs.** WCAG 2.2 AA; plain-text rendering only (React escapes by default, raw HTML prohibited
by the SDS).
**Dependencies.** Feature-D (Ticket Detail hosts the tab), identity middleware.
**Out of scope.** Internal notes, mentions, rich text/markdown, edit/delete, comment attachments.
