# TokTickIT Test Plan (Lab 2)

Corrected 2026-08-21 (PR #14 review). Covers `specification.md`, `ui-spec.md`, and `api-spec.md`
as corrected. Every acceptance criterion below has a row in `traceability-matrix.md` mapping it to
a concrete test file.

**Tooling.** Lab 1 used Vitest (client, `client/tests/lab-01/*.test.tsx`, jsdom + Testing
Library) and Vitest+Supertest (server, `server/tests/lab-01/*.test.ts`). Lab 2 keeps both and
introduces Playwright for E2E. New tests live under `server/tests/lab-02/`, `client/tests/lab-02/`,
`tests/e2e/` (repo root, matching the SDS repository structure).

**Harness fixes needed before writing tests:**
1. `client/vite.config.ts` must include `.ts` unit tests, not only `.tsx`
   (`include: ['tests/**/*.test.{ts,tsx}']`).
2. Server tests run against an isolated `toktickit_test` database (`server/.env.test`), with
   `prisma migrate deploy` + seed in global setup, per-test truncation of ticket-related tables,
   and no file parallelism (`poolOptions.forks.singleFork` or `--no-file-parallelism`) so
   concurrent suites cannot interleave on the shared ticket-number counter row. Never point tests
   at the developer's own database.
3. Coverage tooling (`@vitest/coverage-v8`) must be installed on both `client` and `server`
   `package.json` before the coverage-dependent Definition of Done items below can be measured.

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest (server) | `formatTicketNo()` padding/year boundary; create-ticket request validator (boundaries: summary 4/5/150/151, description 9/10/5000/5001, blank-after-trim, unknown enum, inactive category/related system); list-query parser (pageSize clamp to 50, negative page, unknown sort → error, `q` trim/length/blank-as-omitted); attachment policy (extension/MIME/magic-byte agreement matrix, 5 MB boundary, 5-*active*-file limit counting removed as not counted); `RemoveAttachmentRequest` validator (missing/empty/201-char reason → 422); dev-session validator (unknown/inactive id → 404); `TicketEvent` → `summaryText` mapper; DTO mappers assert `storageKey`/`passwordHash` are absent from every response, active and removed. |
| Unit | Vitest (client) | Filter-and-search state ⇄ URL query serialization; API error-envelope → `ApiError` mapping; date/locale formatting; selected-requester persistence in `sessionStorage` and clearing on "Change Requester." |
| API | Vitest + Supertest | Every endpoint in `api-spec.md` §1, happy path + each documented error. **Mandatory security tests:** every protected endpoint returns 401 without a valid `x-dev-user-id`; requester B gets 403 on requester A's ticket, attachments, and events; `requesterId`/`itPriority`/`status` supplied in a create body are ignored, not honoured; `GET /tickets?requesterId=<other-user-id>` is ignored server-side, not honoured as a scope override (the specific IDOR an agent might "helpfully" wire up); a deactivated/unknown `x-dev-user-id` gets 401, not a silent fallback identity. **Search tests (D-17):** `q` matches ticket-number substring; `q` matches summary substring, case-insensitive; `q` combined with `status` narrows (AND, not OR); no-match `q` returns an empty page, not an error; `q` over 100 chars → 422; blank/whitespace `q` behaves as omitted; a requester's search never returns another requester's tickets. **Attachment tests:** upload of a `.exe` renamed `.png` is rejected 422; the 6th *active* attachment is rejected 409, but uploading after removing one succeeds (removed doesn't count); a 6 MB file is rejected 413; `DELETE` without a `reason` (or empty/whitespace reason) is rejected 422; a removed attachment's download returns 410 and its `storageKey` never appears in any response body, active or removed; download response carries `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and the stored (not client-supplied) mimeType; a non-uploader, including IT_STAFF/ADMINISTRATOR, gets 403 on `DELETE /attachments/:id` for someone else's upload (proves the Lab-3 delete-with-reason path was not accidentally half-wired); `GET /tickets/:id/attachments` includes removed attachments with reason/remover/removedAt visible and `downloadUrl: null`. **Create-with-attachment tests (FR-012):** ticket creation succeeds and is retained even when a subsequent staged-file upload fails validation; a failed upload does not roll back or delete the ticket; multiple staged files upload independently (one failure does not block the others). **Concurrency test:** 10 parallel `POST /tickets` produce 10 distinct ticket numbers with no gaps or duplicates. **Transaction test:** a forced failure after ticket insert leaves no orphan ticket and no orphan event. **Comments regression:** `GET/POST /tickets/:id/comments` do not exist — a request to either 404s at the router level, and no `Comment` table exists in the Lab 2 migration. |
| UI | Vitest + Testing Library | Development Requester Selection: renders seeded list; selecting navigates to My Tickets; empty-active-Requesters state; error + retry. Create Ticket: required-field errors render and are associated with their inputs; input preserved after a server 422; submit disabled while in flight; staged attachments list before submit; post-create per-file upload-failure summary renders without hiding the created ticket. My Tickets: loading → rows/cards; the two empty states; error + retry; filter/search change refetches and resets to page 1; pagination controls; table→card layout at the `md` breakpoint. Ticket Detail: header renders all specified fields; tab switching across exactly three tabs (Attachments, Service Actions, Event Log — **no Public Comments tab**); attachment list shows Remove only on own active uploads; removed attachments render with visible metadata and a disabled download control; confirm-removal dialog blocks submit until a reason is entered and cancels without removing; header shows selected requester and "Change Requester" clears session state. |
| E2E | Playwright | **J1 (primary):** select a dev Requester → create a ticket with one attached PNG → land on Detail showing the ticket number and the attachment → open My Tickets → the ticket is listed → search by its ticket number → still listed → filter by its status/category → still listed → open it → remove the attachment with a reason → it shows as removed (metadata visible, download disabled) and a removal event appears in the Event Log. **J2 (authorization):** as requester B, navigate directly to requester A's `/tickets/:id` → access-denied state, never the ticket's data. **J3 (validation/responsive):** submit an empty Create Ticket form → field errors visible; render My Tickets at 375 px → card layout, no horizontal page scroll. **J4 (requester switching, D-18):** create a ticket as requester A → use "Change Requester" to switch to requester B → My Tickets shows requester B's tickets only, requester A's ticket is not present → switch back to requester A → the original ticket reappears. **J5 (ownership/empty/failure):** as a fresh requester with zero tickets, My Tickets shows the "no tickets yet" empty state (not the "no matches" variant); applying a filter that matches nothing shows the "no matches" empty state with a working "Clear filters" action; a simulated create-attachment failure (oversized file staged) still lands on Detail with the ticket present and a visible failure summary. |
| Migration | Prisma | Migrate from the Lab 1 baseline on a clean DB, then seed; assert the Lab 1 four categories survive with `code`/`isActive` backfilled; assert seeded `RelatedSystem` rows and seeded active `User`/Requester rows exist for the dev selector; assert no `Comment` table exists. |

**Definition of Done for Lab 2:** every FR/BR in `specification.md` §3–4 has ≥1 automated test;
every mandatory security/search/attachment/creation test above passes; server and client coverage
≥80%; Lab 1's existing tests still pass unmodified; `traceability-matrix.md` records the
requirement → feature → test-file mapping for every item; passing terminal output captured for
the submission.

**W3 interim measurement (Issues 5–8 only, recorded 2026-08-18, pre-dates this correction):**
`server` — 47/47 tests passing, `npm run test:coverage` reports 68.6% statements / 79.16% branch
/ 71.42% functions overall; every W3 source file itself is 85–100% covered
(`ticketNumber.ts`, `createTicketRequest.ts`, `errorEnvelope.ts` at 100%; `tickets.ts` 88.4%;
`currentUser.ts` 93.5%) — the overall percentage is pulled down by `seed.ts`/`verify-seed*.ts`/
`server.ts`, boot/ops scripts with no tests by design, not W3 feature code. `client` — 3/3
existing tests passing (no new client code in W3). This measurement predates the D-15/D-17/D-18/
D-19 corrections above and will change once search, the dev selector, soft-removal-with-reason,
and Zen Green UI code land; it is retained here only as a historical checkpoint. The ≥80% overall
target is the full Lab 2 bar and is measured again at Lab 2 completion, not against this interim
snapshot.
