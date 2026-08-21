# Requirements -> Feature -> Test Traceability (Lab 2, corrected)

Corrected 2026-08-21 (PR #14 review). Every acceptance criterion in `specification.md` is mapped
below to at least one planned test with a real path (per `tests.md`). This replaces the earlier
partial matrix, which deferred the full mapping to later Issues — the labsheet requires the
complete matrix before implementation, not deferred.

## Development Requester Selection (D-18)

| Requirement | Feature | Test(s) |
|---|---|---|
| FR-001, FR-001b, FR-001c | Feature-A | `client/tests/lab-02/devRequesterSelection.test.tsx`, `tests/e2e/requesterSwitching.spec.ts` (J4) |
| D-18 endpoint contract (`GET /dev/requesters`, `POST /dev/session`) | Feature-A | `server/tests/lab-02/devSession.test.ts` |
| BR-020 (per-request server-side validation, deactivated/unknown id → 401) | Feature-A | `server/tests/lab-02/devSession.test.ts`, `server/tests/lab-02/security.test.ts` |
| NFR-002 (dev selector is not a security boundary — documented, not enforced as auth) | Feature-A | `docs/lab-02/ui-spec.md` §3 banner text review (documentation check, not a runtime test) |

## Ticket Creation (Feature-B)

| Requirement | Feature | Test(s) |
|---|---|---|
| FR-008, FR-008b, FR-009, FR-010, FR-011, FR-013 | Feature-B | `server/tests/lab-02/ticketCreation.test.ts` |
| FR-012 (create-time attachment upload, compensation on failure) | Feature-B | `server/tests/lab-02/ticketCreationAttachments.test.ts`, `client/tests/lab-02/createTicket.test.tsx`, `tests/e2e/primaryJourney.spec.ts` (J1) |
| BR-001, BR-002, BR-009 | Feature-B | `server/tests/lab-02/ticketCreation.test.ts` |
| BR-014, BR-015 (ticket number uniqueness, transactional event) | Feature-B | `server/tests/lab-02/ticketNumber.test.ts` |
| Create Ticket field validation (boundaries, required, preserved input) | Feature-B | `server/tests/lab-02/createTicketRequest.test.ts`, `client/tests/lab-02/createTicket.test.tsx` |
| Create Ticket empty-categories state | Feature-B | `client/tests/lab-02/createTicket.test.tsx` |
| Concurrency (10 parallel creates, no gaps/dupes) | Feature-B | `server/tests/lab-02/ticketNumber.test.ts` |
| Transaction integrity (forced failure leaves no orphan) | Feature-B | `server/tests/lab-02/ticketCreation.test.ts` |

## My Tickets (Feature-C)

| Requirement | Feature | Test(s) |
|---|---|---|
| FR-014, FR-015, FR-017, FR-018 | Feature-C | `server/tests/lab-02/tickets.list.test.ts`, `client/tests/lab-02/myTickets.test.tsx` |
| FR-016 filter (status, category) | Feature-C | `server/tests/lab-02/tickets.list.test.ts` |
| FR-016 search / D-17 / BR-019 (q matches ticketNo & summary, AND with filters, scoped to owner, length/blank rules) | Feature-C | `server/tests/lab-02/tickets.search.test.ts`, `tests/e2e/primaryJourney.spec.ts` (J1) |
| List-query parsing (pageSize clamp, unknown sort, negative page) | Feature-C | `server/tests/lab-02/listQuery.test.ts` |
| Ownership scope (`requesterId` query param ignored, IDOR) | Feature-C | `server/tests/lab-02/security.test.ts` |
| Empty states: no tickets vs. no matches | Feature-C | `client/tests/lab-02/myTickets.test.tsx`, `tests/e2e/ownershipAndEmptyStates.spec.ts` (J5) |
| Responsive: table → card at `md` breakpoint | Feature-C | `client/tests/lab-02/myTickets.responsive.test.tsx`, `tests/e2e/validationAndResponsive.spec.ts` (J3) |

## Ticket Detail (Feature-D)

| Requirement | Feature | Test(s) |
|---|---|---|
| FR-019 (header fields) | Feature-D | `server/tests/lab-02/ticketDetail.test.ts`, `client/tests/lab-02/ticketDetail.test.tsx` |
| FR-020 (Attachments tab, including removed) | Feature-D, Feature-F | `client/tests/lab-02/ticketDetail.attachments.test.tsx` |
| FR-021 (Event Log, read-only) | Feature-D | `server/tests/lab-02/events.test.ts`, `client/tests/lab-02/ticketDetail.test.tsx` |
| FR-021b (Service Actions tab, empty placeholder) | Feature-D | `client/tests/lab-02/ticketDetail.test.tsx` |
| Exactly three tabs, no Comments tab (D-15 regression) | Feature-D | `client/tests/lab-02/ticketDetail.test.tsx`, `server/tests/lab-02/commentsRemoved.test.ts` |
| Access control (403 on another requester's ticket) | Feature-D | `server/tests/lab-02/security.test.ts`, `tests/e2e/authorization.spec.ts` (J2) |

## Attachments (Feature-F)

| Requirement | Feature | Test(s) |
|---|---|---|
| FR-026, FR-027 (upload, type/size limits) | Feature-F | `server/tests/lab-02/attachments.upload.test.ts` |
| FR-028 (soft removal, required reason, metadata stays visible) | Feature-F | `server/tests/lab-02/attachments.removal.test.ts`, `client/tests/lab-02/ticketDetail.attachments.test.tsx` |
| FR-030 (ATTACHMENT_REMOVED event) | Feature-F | `server/tests/lab-02/attachments.removal.test.ts` |
| FR-031 (authenticated download only, storage adapter) | Feature-F | `server/tests/lab-02/attachments.download.test.ts` |
| BR-012 (type/size/5-active limit, removed doesn't count) | Feature-F | `server/tests/lab-02/attachments.upload.test.ts` |
| BR-013 (uploader-only removal, non-Closed ticket, reason required) | Feature-F | `server/tests/lab-02/attachments.removal.test.ts`, `server/tests/lab-02/security.test.ts` |
| Download security (Content-Disposition, nosniff, stored mimeType, 410 on removed, storageKey never exposed) | Feature-F | `server/tests/lab-02/attachments.download.test.ts` |
| UI: upload constraints text, count indicator, disabled at 5, removed-row rendering, confirm-with-reason dialog | Feature-F | `client/tests/lab-02/ticketDetail.attachments.test.tsx` |

## Cross-cutting

| Requirement | Feature | Test(s) |
|---|---|---|
| NFR-001 (p95 < 500ms, uploads excluded) | All | `server/tests/lab-02/perf.smoke.test.ts` |
| NFR-002 (server-side authorization on every protected endpoint) | All | `server/tests/lab-02/security.test.ts` |
| NFR-003 (WCAG 2.2 AA) | All UI | `client/tests/lab-02/a11y.test.tsx`, manual Playwright axe check in `tests/e2e/validationAndResponsive.spec.ts` |
| NFR-004 (auditability — every material change produces a TicketEvent) | Feature-B, Feature-F | `server/tests/lab-02/events.test.ts` |
| NFR-008 (Zen Green theme, D-19) | All UI | Visual/token review against `docs/lab-02/ui-spec.md` §1 (documentation check); `client/tests/lab-02/theme.test.tsx` asserts token usage in shared components |
| NFR-009 (responsive, no horizontal scroll, D-19) | Feature-C primarily | `tests/e2e/validationAndResponsive.spec.ts` (J3) |
| BR-016, BR-017 (no hard delete, optimistic version present) | Data model | `server/tests/lab-02/migration.test.ts` |
| D-16 (RelatedSystem reference data) | Feature-B | `server/tests/lab-02/migration.test.ts`, `server/tests/lab-02/relatedSystems.test.ts` |
| D-20a (`/api/v1` + Lab 1 aliases unchanged) | API foundation | `server/tests/lab-01/*.test.ts` (regression) |
| D-15 regression (Comment entity/endpoints absent) | Data model, API | `server/tests/lab-02/migration.test.ts`, `server/tests/lab-02/commentsRemoved.test.ts` |

## E2E journey index

| ID | Journey | File |
|---|---|---|
| J1 | Primary: select requester → create ticket + attachment → find via My Tickets (search + filter) → remove attachment with reason → event appears | `tests/e2e/primaryJourney.spec.ts` |
| J2 | Authorization: requester B cannot open requester A's ticket | `tests/e2e/authorization.spec.ts` |
| J3 | Validation + responsive: empty-form errors, 375px card layout, no horizontal scroll | `tests/e2e/validationAndResponsive.spec.ts` |
| J4 | Requester switching: My Tickets scoped to the active dev requester, reloads on switch | `tests/e2e/requesterSwitching.spec.ts` |
| J5 | Ownership/empty/failure states: zero-ticket empty state, no-match empty state, create-with-failed-attachment | `tests/e2e/ownershipAndEmptyStates.spec.ts` |
