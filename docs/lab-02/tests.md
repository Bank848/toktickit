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
tests), continuing Lab 1's setup. Playwright for the single end-to-end journey.

**Status note (2026-09-02):** the file list and the `componentRules.ts` helper originally planned
here described the intended shape before implementation. The actual repository landed on a
finer-grained split (one file per concern rather than one file per screen on the server side) and
never implemented the shared component-rules helper. The list below is the real, current file set,
confirmed against the repository — not the pre-implementation plan.

- `server/tests/lab-02/apiV1.test.ts` — `/api/v1` foundation, Development Requester Selection API
- `server/tests/lab-02/attachmentStorage.test.ts` — local disk storage adapter (unit)
- `server/tests/lab-02/attachmentValidation.test.ts` — attachment type/MIME/magic-byte policy (unit)
- `server/tests/lab-02/attachments.api.test.ts` — attachment upload/download/removal API
- `server/tests/lab-02/createTicketRequest.validator.test.ts` — create-ticket request validator (unit)
- `server/tests/lab-02/currentUser.test.ts` — identity resolution and dev-identity boot guard
- `server/tests/lab-02/errorEnvelope.test.ts` — error envelope middleware
- `server/tests/lab-02/listTicketsQuery.test.ts` — My Tickets query parser (unit)
- `server/tests/lab-02/migration.test.ts` — Lab 2 schema migration
- `server/tests/lab-02/referenceData.test.ts` — categories/related-systems reference endpoints
- `server/tests/lab-02/ticketCreation.test.ts` — `POST /api/v1/tickets`
- `server/tests/lab-02/ticketDetail.api.test.ts` — `GET /api/v1/tickets/:id`
- `server/tests/lab-02/ticketNumber.test.ts` — Ticket Number formatting and generation (unit)
- `server/tests/lab-02/ticketsList.api.test.ts` — `GET /api/v1/tickets`
- `client/tests/lab-02/AttachmentSection.test.tsx` — attachment list, upload, removal UI
- `client/tests/lab-02/CreateTicket.test.tsx` — Create Ticket page
- `client/tests/lab-02/MyTickets.test.tsx` — My Tickets page
- `client/tests/lab-02/RemovalConfirmDialog.test.tsx` — removal-confirmation dialog and focus trap
- `client/tests/lab-02/RequesterContext.test.tsx` — Development Requester context/session storage
- `client/tests/lab-02/SelectRequesterPage.test.tsx` — Development Requester Selection page
- `client/tests/lab-02/TicketDetail.test.tsx` — Requester Ticket Detail page
- `client/tests/lab-02/routeGuard.test.tsx` — requester-selection route guard
- `e2e/lab-02/requester-ticket-flow.spec.ts` — full responsive requester journey

**Harness fixes needed before writing tests (all applied):**

1. `client/vite.config.ts` includes `.ts` unit tests, not only `.tsx`.
2. Server tests run against an isolated `toktickit_test` database, with migration + seed in global
   setup. Requires a local `server/.env.test` (gitignored, not committed) pointing at that
   database — see `server/.env.example` for the connection-string shape.
3. Coverage tooling (`@vitest/coverage-v8`) is installed on both `client` and `server`.
4. The E2E suite additionally requires `server/.env.e2e` and `client/.env.e2e` (both gitignored;
   `.example` copies are committed) pointing the E2E server and client at a dedicated
   `toktickit_e2e` database and matching port. **Real bug found and fixed in this pass:**
   `client/.env.e2e` did not exist and there was no `client/.env.e2e.example` documenting it, so
   the E2E client silently fell back to its default `VITE_API_BASE_URL` (port 4000) while the E2E
   server actually listens on port 4001 — every E2E run failed at the very first screen (the
   Development Requester dropdown never populated) until `client/.env.e2e` was added.

## 2. Planned Tests

| Test ID | Type | Requirement/AC | What It Tests | Expected Result | Automated Test File | Final |
|---|---|---|---|---|---|---|
| UNIT-01 | Unit | BR-01, BR-10 | Ticket Number generator padding/year boundary | Correct `TKT-YYYY-NNNNN` format, annual reset | `server/tests/lab-02/ticketNumber.test.ts` | Pass |
| UNIT-02 | Unit | FR-06, BR-05 | Create-ticket request validator boundaries (summary/description length, blank-after-trim, unknown enum, inactive category/related system) | 422 with field errors for each boundary case | `server/tests/lab-02/createTicketRequest.validator.test.ts` | Pass |
| UNIT-03 | Unit | FR-15, FR-16, BR-13 | List-query parser (pageSize clamp, negative page, unknown sort, `q` trim/length/blank-as-omitted) | Parser normalizes or rejects each case per BR-13 | `server/tests/lab-02/listTicketsQuery.test.ts` | Pass |
| UNIT-04 | Unit | FR-21, BR-08 | Attachment policy matrix (extension/MIME/magic-byte agreement, 5-active-file limit not counting removed) | Each boundary accepted/rejected correctly | `server/tests/lab-02/attachmentValidation.test.ts` (type/MIME/magic bytes); `server/tests/lab-02/attachments.api.test.ts` (413 size boundary, 5-file limit at the API layer) | Pass |
| UNIT-05 | Unit | FR-22, BR-09 | Removal-request reason validation | 422 for a missing/empty reason | `server/tests/lab-02/attachments.api.test.ts` | Pass — narrower than planned; see §7 |
| API-01 | API | AC-05 | Create valid ticket | 201; one saved Ticket; status New; itPriority = requestedPriority; unique number returned | `server/tests/lab-02/ticketCreation.test.ts` | Pass |
| API-02 | API | AC-06, AC-07 | Create with invalid field | 422 with field errors and preserved input | `server/tests/lab-02/ticketCreation.test.ts` | Pass — see §7 for the failing-attachment half |
| API-03 | API | AC-05 (concurrency) | 10 parallel `POST /tickets` | 10 distinct Ticket Numbers, no gaps or duplicates | `server/tests/lab-02/ticketCreation.test.ts` | Pass |
| API-04 | API | AC-08, AC-09 | List, filter, search My Tickets | Only the selected requester's tickets; AND semantics across filters and `q` | `server/tests/lab-02/ticketsList.api.test.ts` | Pass |
| API-05 | API | AC-10, AC-11 | Empty My Tickets / no-match My Tickets | Distinct empty-state payload shape for each case (zero total vs. zero after filtering) | `server/tests/lab-02/ticketsList.api.test.ts` | Pass |
| API-06 | API | AC-18 | Protected endpoint with missing/unknown/inactive requester identity | 401, and `?requesterId=` on the list endpoint is ignored, never honoured as a scope override | `server/tests/lab-02/currentUser.test.ts` (401 cases); `server/tests/lab-02/ticketsList.api.test.ts` (requesterId override ignored) | Pass |
| API-07 | API | FR-18, FR-19 | Retrieve owned Ticket Detail | 200 with all specified fields plus attachments (active and removed) | `server/tests/lab-02/ticketDetail.api.test.ts` | Pass |
| API-08 | API | AC-12 | Retrieve another requester's Ticket Detail | 404, no ticket data present in the response, byte-identical to the response for an unknown ticket id | `server/tests/lab-02/ticketDetail.api.test.ts` | Pass |
| API-09 | API | AC-19 | Ticket Detail response and route surface | No events/service-actions/comments field or endpoint exists anywhere in the response or router | — | Not implemented as a dedicated test; see §7 |
| API-10 | API | AC-16 | Upload wrong type / oversized file | 422 type mismatch or 413 size; nothing written to storage | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-11 | API | AC-15 | 6th active attachment upload, then upload after one removal | 409 on the 6th; success after a removal frees a slot | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-12 | API | AC-13, AC-14 | Remove attachment with reason / with missing reason | 200 removed-state DTO with reason/remover/date visible and 410 on content; 422 when reason missing | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| API-13 | API | FR-24 | Download headers and removed-attachment access | `Content-Disposition`/`nosniff`/stored mimeType present; `storageKey` never in any response body | `server/tests/lab-02/attachments.api.test.ts` | Pass |
| UI-01 | UI | AC-01, AC-02, AC-03 | Development Requester Selection renders/selects/excludes inactive | Picker blocks navigation until selection; inactive requester absent | `client/tests/lab-02/SelectRequesterPage.test.tsx`; `client/tests/lab-02/routeGuard.test.tsx` | Pass |
| UI-02 | UI | AC-07 | Submit Create Ticket without Summary | Field message renders next to the input; API not called | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-03 | UI | AC-06 | Post-create per-file upload failure | Failure summary renders without hiding the created ticket | `client/tests/lab-02/CreateTicket.test.tsx` | Pass |
| UI-04 | UI | AC-09, AC-10, AC-11 | My Tickets filters/search/pagination and both empty states | Refetch resets to page 1; correct empty state per scenario | `client/tests/lab-02/MyTickets.test.tsx` | Pass |
| UI-05 | UI | AC-17 | My Tickets at a sub-768px viewport | Renders as stacked cards, no horizontal scroll | — | Not a dedicated component test; covered by E2E-01's mobile project instead |
| UI-06 | UI | FR-18, AC-19 | Ticket Detail header render | All specified fields present; no Event Log/Service Actions/Comments section anywhere in the DOM | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| UI-07 | UI | AC-12 | Ticket Detail for a non-owned ticket | Not Found state rendered (same view as an unknown id), no field data present | `client/tests/lab-02/TicketDetail.test.tsx` | Pass |
| UI-08 | UI | AC-13 | Attachment removal dialog | Submit disabled until a non-empty reason is entered; confirmed removal shows removed metadata, disabled download | `client/tests/lab-02/AttachmentSection.test.tsx`; `client/tests/lab-02/RemovalConfirmDialog.test.tsx` | Pass |
| UI-09 | UI | AC-15, AC-16 | Attachment list at the 5-active limit / with an invalid staged file | Upload control disabled at 5; invalid file rejected client-side with a visible message | `client/tests/lab-02/AttachmentSection.test.tsx` | Pass |
| UI-10 | UI | FR-02, FR-03, AC-04 | Header identity display and "Change Requester" reload | Header shows selected Requester's name; activating Change Requester clears the stored selection and discards cached requester-scoped data before the picker renders | `client/tests/lab-02/RequesterContext.test.tsx`; `client/tests/lab-02/TicketDetail.test.tsx` (cache-discard regression cases) | Pass |
| UI-11 | UI | `ui-spec.md` §2, §4, §8 (component rules) | Create Ticket component rules (asterisk/`aria-describedby`, read-only tokens, button hierarchy) | — | — | Not implemented — the planned shared `componentRules.ts` helper was never built; see §7 |
| UI-12 | UI | `ui-spec.md` §2, §6, §8 (component rules) | Ticket Detail component rules, same helper | — | — | Not implemented; see §7 |
| UI-13 | UI | `ui-spec.md` §2, §6, §8 (component rules) | Attachment removal dialog and upload control component rules, same helper | — | — | Not implemented; see §7 |
| UI-14 | UI | `ui-spec.md` §2, §5, §8 (component rules) | My Tickets filter-bar component rules, same helper | — | — | Not implemented; see §7 |
| E2E-01 | E2E | AC-01, AC-02, AC-05, AC-09, AC-13, AC-17 | Complete responsive requester journey: select requester, create ticket with one valid attachment, find it via search in My Tickets, open Detail, remove the attachment with a reason, verify at a mobile viewport | Every step succeeds; confirmation shows the official Ticket Number; removed attachment shows blocked content | `e2e/lab-02/requester-ticket-flow.spec.ts` | Pass (desktop, tablet, mobile) |
| API-14 | API | FR-12, BR-11 | `TICKET_CREATED` audit event on ticket creation | Event row exists with correct ticketId, type, and timestamp inside the same transaction as the ticket insert | `server/tests/lab-02/ticketCreation.test.ts` | Pass |
| API-15 | API | FR-23, BR-15 | `ATTACHMENT_REMOVED` audit event on soft removal | Event row exists recording the removal | `server/tests/lab-02/attachments.api.test.ts` | Pass — asserted as part of the removal happy-path test, not a standalone case |
| UNIT-06 | Unit | BR-07 | Related System deactivation path | Deactivating sets `isActive = false`; no code path hard-deletes a Related System referenced by any ticket | `server/tests/lab-02/referenceData.test.ts` | Pass |
| UNIT-07 | Unit | BR-12 | Ticket/TicketEvent hard-delete guard | No route or service function performs a hard delete on `Ticket` or `TicketEvent` — asserted by absence (no such handler reachable) | — | Not implemented as a dedicated test; true by code-review, not by an automated assertion — see §7 |

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
| Component rules (`ui-spec.md` §2, §8) — asterisk/`aria-describedby`, read-only vs editable, button hierarchy | — (component contract, not a numbered AC) | UI-11 (Create Ticket), UI-12 (Ticket Detail), UI-13 (Attachments), UI-14 (My Tickets) — none of the four were implemented, see §7 |
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
# server (requires server/.env.test — see server/.env.example for the connection-string shape)
cd server && npm test
cd server && npm run test:coverage

# client
cd client && npm test

# e2e (requires server/.env.e2e and client/.env.e2e — see the .env.e2e.example files in each)
npm run test:e2e
```

## 6. Final Results

**Final measurement on `main` at `ef4f08c` (2026-09-02, this reconciliation pass — supersedes every
measurement below it):**

- `server` — `npm test`: **17/17 test files, 109/109 tests passing**. `npm run test:coverage`:
  79.55% statements / 87.81% branch / 84.61% functions / 79.55% lines overall; every Lab 2 source
  file itself is 84.6–100% covered (`ticketNumber.ts`, `errorEnvelope.ts`,
  `attachmentStorage.ts` at 100%; `tickets.ts` 93.56%; `attachments.ts` 92%; `currentUser.ts`
  93.33%) — the overall percentage is pulled down by `seed.ts`/`server.ts`/`prisma/*-seed*.ts`,
  boot and ops scripts with no tests by design, same pattern as the W3 measurement below.
- `client` — `npm test`: **10/10 test files, 47/47 tests passing**.
- `e2e` — `npm run test:e2e`: **3/3 passing** (desktop, tablet, mobile projects) against
  `e2e/lab-02/requester-ticket-flow.spec.ts`, covering the full journey described in E2E-01.
- Two real environment bugs were found and fixed to get this measurement, not worked around:
  `server`/`client` had drifted from `package.json` (`multer`, `file-type`, `@playwright/test`,
  `dotenv` were declared but not installed — `npm install` had never been re-run after they were
  added), and `client/.env.e2e` never existed, so the E2E client silently pointed at the wrong
  API port until this pass added it. See `ai-use.md` for the diagnosis.
- Coverage percentages above are for `server` only — `client/package.json` has no `test:coverage`
  script, so client coverage is not measured in this Lab.

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

**Lab 2 W4 measurement (Issues #19–#24, requester-facing UI, recorded 2026-09-02):**

- `client` — `npx vitest run` in `client/`: **47/47 tests passing** across 10 files.
- E2E — `npx playwright test` against `e2e/lab-02/requester-ticket-flow.spec.ts`: **3/3 passing**
  (desktop, tablet, mobile projects), covering select requester → create ticket with an initial
  attachment → find it in My Tickets → open detail → upload a second attachment → remove it with
  a reason → switch requester → confirm the new requester sees neither the ticket nor the removed
  attachment's reason, and that direct navigation to another requester's ticket returns the
  generic "Ticket not found." message (not a 403-style message, per D-24).
- 24 real screenshots captured to `artifacts/lab-02/screenshots/{select-requester,create-ticket,
  my-tickets,ticket-detail}/`, one set per viewport per flow step.
- `server` vitest suite was not re-run for this Issue — no server code changed in W4-6, and the
  local `toktickit_test` Postgres database this machine's `tests/globalSetup.ts` expects is not
  currently provisioned (a pre-existing local-environment gap, not a W4 regression).

## 7. Known Limitations or Deferred Tests

- Load/perf testing beyond the p95 smoke assertion is out of scope for Lab 2.
- Cross-browser E2E (Playwright currently targets Chromium only) is not required by the labsheet
  for Lab 2 and is deferred.
- Visual regression is manual-checklist only (§4); no pixel-diff tooling is introduced in Lab 2.
- **UI-11 to UI-14 were never implemented.** §1 originally planned a shared
  `client/tests/lab-02/componentRules.ts` helper asserting the `ui-spec.md` component contract
  (required-field asterisk, `aria-describedby` wiring, read-only vs. editable token classes,
  button-hierarchy classes) once and reusing it across all four screens. That helper does not
  exist in the repository, and no equivalent assertions exist elsewhere. The component rules
  themselves are followed in the implementation (visible in the E2E screenshots and manual
  checklist, §4/§9), but they are not covered by an automated test. This is the single largest
  real gap in this test plan.
- **UNIT-05 is narrower than planned.** Only the missing/empty-reason boundary is tested (inside
  `attachments.api.test.ts`, at the API layer); there is no dedicated removal-request validator
  unit test and no 201-character upper-boundary case.
- **API-02's "ticket retained despite a failed attachment" half is not a server test.** Ticket
  creation and attachment upload are separate endpoints by design, so a failed upload cannot roll
  back the ticket at the server layer — this is verified at the UI/E2E layer instead (UI-03,
  E2E-01), not duplicated as a server API test.
- **API-09 and UNIT-07 are true by absence, not by an automated assertion.** No route or Prisma
  model for events/service-actions/comments exists (confirmed by reading `src/routes/v1/`), and no
  code path performs a hard delete on `Ticket`/`TicketEvent` (confirmed by reading
  `src/routes/v1/attachments.ts` and `tickets.ts`) — but neither fact is asserted by a test that
  would fail if a future change reintroduced them.
- **UI-05's mobile-viewport rendering is covered only by E2E-01's mobile project**, not by a
  dedicated `MyTickets.test.tsx` viewport test.
