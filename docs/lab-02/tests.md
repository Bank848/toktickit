# Lab 2 Test Plan and Results

**Status:** Reconciled 2026-08-21, third pass, against the actual official Lab 2 labsheet.
Restructured to the labsheet's required `tests.md` section set (§16/Appendix B). Absorbs the
former standalone `traceability-matrix.md` into §3 below, per the labsheet's Appendix B template
(there is no separately required traceability-matrix file). Fixes a leftover inconsistency from
the prior pass: earlier drafts of this plan still described Ticket Detail as having three tabs
(Attachments, Service Actions, Event Log) after `specification.md`/`api-spec.md` had already
removed Service Actions and Event Log entirely (D-22) — this pass corrects every test description
below to read-only fields plus Attachments only, with no tab chrome.

## 1. Test Strategy

Every acceptance criterion in `specification.md` §9 has at least one automated test below. Tests
are planned before implementation (Test DD) and used to drive implementation with the tests
written first (TDD) — this plan is not reconstructed afterward from whatever the coding agent
happened to generate.

**Tooling.** Vitest for both client (jsdom + Testing Library) and server (+ Supertest for API
tests), continuing Lab 1's setup. Playwright for the single end-to-end journey. Required file
locations, per the labsheet's §12 minimum repository structure:

- `server/tests/lab-02/create-ticket.api.test.ts`
- `server/tests/lab-02/my-tickets.api.test.ts`
- `server/tests/lab-02/ticket-detail.api.test.ts`
- `server/tests/lab-02/attachments.api.test.ts`
- `client/tests/lab-02/CreateTicket.test.tsx`
- `client/tests/lab-02/MyTickets.test.tsx`
- `client/tests/lab-02/RequesterTicketDetail.test.tsx`
- `client/tests/lab-02/AttachmentSection.test.tsx`
- `e2e/lab-02/requester-ticket-flow.spec.ts`

These are the only required test files; every scenario in §2 below lives in one of them under a
nested `describe` block by scenario group (for example, `create-ticket.api.test.ts` has
`describe('validation')`, `describe('attachment upload')`, `describe('ownership')` inside it),
rather than spawning additional top-level files beyond this minimum set.

**Harness fixes needed before writing tests:**

1. `client/vite.config.ts` must include `.ts` unit tests, not only `.tsx`.
2. Server tests run against an isolated `toktickit_test` database, with migration + seed in global
   setup, per-test truncation of ticket-related tables, and no file parallelism, so concurrent
   suites cannot interleave on the shared Ticket Number counter row. Never point tests at the
   developer's own database.
3. Coverage tooling (`@vitest/coverage-v8`) must be installed on both `client` and `server`
   `package.json` before the coverage-dependent Definition of Done items can be measured.

## 2. Planned Tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01, BR-10 | Ticket Number generator padding/year boundary | Correct `TKT-YYYY-NNNNN` format, annual reset | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| UNIT-02 | Unit | FR-06, BR-05 | Create-ticket request validator boundaries (summary/description length, blank-after-trim, unknown enum, inactive category/related system) | 422 with field errors for each boundary case | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| UNIT-03 | Unit | FR-15, FR-16, BR-13 | List-query parser (pageSize clamp, negative page, unknown sort, `q` trim/length/blank-as-omitted) | Parser normalizes or rejects each case per BR-13 | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| UNIT-04 | Unit | FR-21, BR-08 | Attachment policy matrix (extension/MIME/magic-byte agreement, 5 MB boundary, 5-active-file limit not counting removed) | Each boundary accepted/rejected correctly | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| UNIT-05 | Unit | FR-22, BR-09 | Removal-request validator (missing/empty/201-char reason) | 422 for each invalid reason | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-01 | API | AC-05 | Create valid ticket | 201; one saved Ticket; status New; itPriority = requestedPriority; unique number returned | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-02 | API | AC-06, AC-07 | Create with invalid field / with a failing staged attachment | 422 with field errors and preserved input; ticket retained despite failed attachment | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-03 | API | AC-05 (concurrency) | 10 parallel `POST /tickets` | 10 distinct Ticket Numbers, no gaps or duplicates | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-04 | API | AC-08, AC-09 | List, filter, search My Tickets | Only the selected requester's tickets; AND semantics across filters and `q` | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-05 | API | AC-10, AC-11 | Empty My Tickets / no-match My Tickets | Distinct empty-state payload shape for each case (zero total vs. zero after filtering) | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-06 | API | AC-18 | Protected endpoint with missing/unknown/inactive requester identity | 401, and `?requesterId=` on the list endpoint is ignored, never honoured as a scope override | `server/tests/lab-02/my-tickets.api.test.ts` | Pending |
| API-07 | API | FR-18, FR-19 | Retrieve owned Ticket Detail | 200 with all specified fields plus attachments (active and removed) | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-08 | API | AC-12 | Retrieve another requester's Ticket Detail | 403, no ticket data present in the response | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-09 | API | AC-19 | Ticket Detail response and route surface | No events/service-actions/comments field or endpoint exists anywhere in the response or router | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |
| API-10 | API | AC-16 | Upload wrong type / oversized file | 422 type mismatch or 413 size; nothing written to storage | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-11 | API | AC-15 | 6th active attachment upload, then upload after one removal | 409 on the 6th; success after a removal frees a slot | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-12 | API | AC-13, AC-14 | Remove attachment with reason / with missing reason | 200 removed-state DTO with reason/remover/date visible and 410 on content; 422 when reason missing | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| API-13 | API | FR-24 | Download headers and removed-attachment access | `Content-Disposition`/`nosniff`/stored mimeType present; `storageKey` never in any response body | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| UI-01 | UI | AC-01, AC-02, AC-03 | Development Requester Selection renders/selects/excludes inactive | Picker blocks navigation until selection; inactive requester absent | `client/tests/lab-02/CreateTicket.test.tsx` (shared app-shell fixture) | Pending |
| UI-02 | UI | AC-07 | Submit Create Ticket without Summary | Field message renders next to the input; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-03 | UI | AC-06 | Post-create per-file upload failure | Failure summary renders without hiding the created ticket | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| UI-04 | UI | AC-09, AC-10, AC-11 | My Tickets filters/search/pagination and both empty states | Refetch resets to page 1; correct empty state per scenario | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| UI-05 | UI | AC-17 | My Tickets at a sub-768px viewport | Renders as stacked cards, no horizontal scroll | `client/tests/lab-02/MyTickets.test.tsx` | Pending |
| UI-06 | UI | FR-18, AC-19 | Ticket Detail header render | All specified fields present; no Event Log/Service Actions/Comments section anywhere in the DOM | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pending |
| UI-07 | UI | AC-12 | Ticket Detail for a non-owned ticket | Access-denied state rendered, no field data present | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Pending |
| UI-08 | UI | AC-13 | Attachment removal dialog | Submit disabled until a non-empty reason is entered; confirmed removal shows removed metadata, disabled download | `client/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| UI-09 | UI | AC-15, AC-16 | Attachment list at the 5-active limit / with an invalid staged file | Upload control disabled at 5; invalid file rejected client-side with a visible message | `client/tests/lab-02/AttachmentSection.test.tsx` | Pending |
| UI-10 | UI | FR-02, FR-03, AC-04 | Header identity display and "Change Requester" reload | Header shows selected Requester's name; activating Change Requester clears the stored selection and discards cached requester-scoped data before the picker renders | `client/tests/lab-02/CreateTicket.test.tsx` (shared app-shell fixture) | Pending |
| UI-11 | UI | `ui-spec.md` §2, §8 (component rules) | Required-field asterisks, `aria-describedby` wiring, editable-vs-read-only field styling, button-hierarchy classes | Required fields show the asterisk marker and are wired to their validation message via `aria-describedby`; read-only fields carry the read-only token class distinct from editable inputs; primary/secondary/tertiary/destructive/disabled/busy buttons each render their designated class | `client/tests/lab-02/CreateTicket.test.tsx` | Pending |
| E2E-01 | E2E | AC-01, AC-02, AC-05, AC-09, AC-13, AC-17 | Complete responsive requester journey: select requester, create ticket with one valid attachment, find it via search in My Tickets, open Detail, remove the attachment with a reason, verify at a mobile viewport | Every step succeeds; confirmation shows the official Ticket Number; removed attachment shows blocked content | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pending |
| API-14 | API | FR-12, BR-11 | `TICKET_CREATED` audit event on ticket creation | Event row exists with correct ticketId, type, and timestamp inside the same transaction as the ticket insert | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| API-15 | API | FR-23, BR-15 | `ATTACHMENT_REMOVED` audit event on soft removal | Event row exists recording filename, uploader, remover, reason, timestamp | `server/tests/lab-02/attachments.api.test.ts` | Pending |
| UNIT-06 | Unit | BR-07 | Related System deactivation path | Deactivating sets `isActive = false`; no code path hard-deletes a Related System referenced by any ticket | `server/tests/lab-02/create-ticket.api.test.ts` | Pending |
| UNIT-07 | Unit | BR-12 | Ticket/TicketEvent hard-delete guard | No route or service function performs a hard delete on `Ticket` or `TicketEvent` — asserted by absence (no such handler reachable) | `server/tests/lab-02/ticket-detail.api.test.ts` | Pending |

## 3. Acceptance-Criterion Traceability

Every criterion in `specification.md` §9 maps to at least one planned test above.

| Requirement / Feature | AC(s) | Test(s) |
|---|---|---|
| Development Requester Selection (FR-01–FR-05) | AC-01, AC-02, AC-03, AC-04 | UI-01, UI-10, E2E-01 (AC-01, AC-02 only) |
| BR-03, BR-14 (selector is testing-only, server-validated every request) | AC-18 | API-06 |
| Ticket Creation (FR-06–FR-12) | AC-05, AC-06, AC-07 | UNIT-01, UNIT-02, API-01, API-02, API-03, API-14, UI-02, UI-03, UI-11, E2E-01 (AC-05 only) |
| BR-01, BR-02, BR-04, BR-06, BR-10 | AC-05 | API-01 |
| BR-11 (create/removal audit event, same transaction) | — (folded into FR-12/FR-23 tests) | API-14, API-15 |
| My Tickets (FR-13–FR-17) | AC-08, AC-09, AC-10, AC-11 | UNIT-03, API-04, API-05, UI-04, E2E-01 (AC-09 only) |
| BR-13 (search scope and AND semantics) | AC-09 | API-04, UNIT-03 |
| Ownership scope, IDOR guard | AC-12, AC-18 | API-06, API-08, UI-07 |
| Requester Ticket Detail (FR-18–FR-19) | AC-12, AC-19 | API-07, API-08, API-09, UI-06, UI-07 |
| Attachments (FR-20–FR-24) | AC-13, AC-14, AC-15, AC-16 | UNIT-04, UNIT-05, API-10, API-11, API-12, API-13, API-15, UI-08, UI-09, E2E-01 (AC-13 only) |
| BR-07, BR-08, BR-09, BR-11, BR-12, BR-15 | AC-13, AC-14, AC-15, AC-16 | UNIT-04, UNIT-05, UNIT-06, UNIT-07, API-10, API-11, API-12, API-15 |
| Responsive (§7 breakpoints) | AC-17 | UI-05, E2E-01 (AC-17 only) |
| Zen Green tokens (`ui-spec.md` §1) | — (visual, not a numbered AC) | manual checklist, §4 below |
| Seed baseline (`specification.md` §7) | AC-03, AC-18 | migration/seed check, folded into API-06 setup and UI-01 fixture data |

## 4. Responsive and Visual Checklist

Manual + Playwright-screenshot verification, at desktop (≥ 992 px), tablet (768–991 px), and
mobile (< 768 px) viewports, for Create Ticket, My Tickets, and Ticket Detail:

- No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names at any
  size.
- No horizontal page scrolling at any breakpoint.
- Desktop: multi-column layout, content centered with a sensible maximum width. Tablet: two-column
  layout where practical, Summary/Description receive enough width. Mobile: fields stack
  vertically, buttons remain touch-friendly (≥ 44×44 CSS px).
- Zen Green token verification: app header and primary buttons render `#006B3C`; secondary
  actions, active nav indicator, and the visible focus ring render `#0B7A46`; hover/selected rows
  and info banners render `#EAF6EF`; the page background renders `#F5F7F6`.
- Badge consistency for Requested Priority, IT Priority, and Current Status (text + icon, never
  color alone).
- Filters, pagination, attachment controls, and empty states remain usable at all viewport sizes.
- Screenshot paths follow `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`.

## 5. Test Commands

```bash
# server
cd server && npm test
cd server && npm run test:coverage

# client
cd client && npm test
cd client && npm run test:coverage

# e2e (once implemented)
npx playwright test e2e/lab-02/requester-ticket-flow.spec.ts
```

## 6. Final Results

Not yet run — this is the pre-implementation spec/test-plan phase of Lab 2 (docs-only PR). The
table in §2 is marked "Pending" throughout; final pass/fail status is recorded here once the
corresponding implementation Issues land.

**W3 interim measurement (Issues 5–8 only, recorded 2026-08-18, historical, pre-dates this
docs-reconciliation pass):** `server` — 47/47 tests passing, `npm run test:coverage` reports 68.6%
statements / 79.16% branch / 71.42% functions overall; every W3 source file itself is 85–100%
covered (`ticketNumber.ts`, `createTicketRequest.ts`, `errorEnvelope.ts` at 100%; `tickets.ts`
88.4%; `currentUser.ts` 93.5%) — the overall percentage is pulled down by `seed.ts`/
`verify-seed*.ts`/`server.ts`, boot/ops scripts with no tests by design. `client` — 3/3 existing
tests passing (no new client code in W3). This measurement predates every correction in this
document and will change once search, the dev selector, soft-removal-with-reason, and Zen Green UI
code land; it is retained only as a historical checkpoint, not as evidence toward the ≥80% Lab 2
target, which is measured again at Lab 2 completion.

## 7. Known Limitations or Deferred Tests

- Load/perf testing beyond the p95 smoke assertion is out of scope for Lab 2.
- Cross-browser E2E (Playwright currently targets Chromium only) is not required by the labsheet
  for Lab 2 and is deferred.
- Visual regression is manual-checklist only (§4); no pixel-diff tooling is introduced in Lab 2.
