# TokTickIT Test Plan (Lab 2)

Copied verbatim from §6 of `TokTickIT-Lab2-Implementation-Plan-v0.1.md`.

**Tooling decision.** Lab 1 used Vitest (client, `client/tests/lab-01/*.test.tsx`, jsdom +
Testing Library) and Vitest+Supertest (server, `server/tests/lab-01/*.test.ts`). Lab 2 keeps
both and **introduces Playwright**, because the W4 activity line says "full test suite
(unit/API/UI/E2E)" and Lab 1's deferral of Playwright pointed at exactly this lab. New tests
live under `server/tests/lab-02/`, `client/tests/lab-02/`, `tests/e2e/` (repo root, matching the
SDS repository structure).

**Two harness fixes needed before writing tests** — both are current-repo defects that will
bite immediately:
1. `client/vite.config.ts` has `include: ['tests/**/*.test.tsx']` — pure `.ts` unit tests would
   silently never run. Change to `['tests/**/*.test.{ts,tsx}']`.
2. Lab 1's server tests run against the developer's real database. Lab 2 tests write data. Add
   `server/.env.test` with a separate `DATABASE_URL` (`toktickit_test`), a global setup that
   runs `prisma migrate deploy` + seed against it, per-test truncation of the ticket-related
   tables, and **no file parallelism** (`poolOptions.forks.singleFork` or
   `--no-file-parallelism`) so concurrent suites cannot interleave on the shared counter row.
   Never point tests at the dev database.
3. Coverage tooling is not installed on either `package.json` yet (`@vitest/coverage-v8` absent
   from both client and server). The DoD below requires a recorded ≥80% number — install it in
   Issue 6 (server) and Issue 12 (client), not as an afterthought in Issue 16.

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest (server) | `formatTicketNo()` padding/year boundary; create-ticket request validator (boundaries: summary 4/5/150/151, description 9/10/5000/5001, blank-after-trim, unknown enum, inactive category); list-query parser (pageSize clamp to 50, negative page, unknown sort → error); attachment policy (extension/MIME/magic-byte agreement matrix, 5 MB boundary, 5-file limit); `TicketEvent` → `summaryText` mapper; DTO mappers assert `storageHash`/`passwordHash`/`storageKey` are absent from output. |
| Unit | Vitest (client) | Filter-state ⇄ URL query serialization; API error-envelope → `ApiError` mapping; date/locale formatting. |
| API | Vitest + Supertest | Every endpoint in §3.1, happy path + each documented error. **Mandatory security tests:** all 13 protected endpoints return 401 without identity; requester B gets 403 on requester A's ticket, comments, attachments, events, and download; `requesterId`/`itPriority`/`status` supplied in a create body are ignored, not honoured; **`GET /tickets?requesterId=<other-user-id>` is ignored server-side, not honoured as a scope override** (the specific IDOR §3.3 #5 warns about — an agent later "helpfully" wiring up that filter would pass every other test in this list); upload of a `.exe` renamed `.png` is rejected 422; the 6th attachment is rejected 409; a 6 MB file is rejected 413; a deleted attachment's download returns 410 and its `storageKey` never appears in any response body; **download response carries `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and the stored (not client-supplied) mimeType**; **a non-uploader, including IT_STAFF/ADMINISTRATOR, gets 403 on `DELETE /attachments/:id` for someone else's upload** (proves the Lab-3 delete-with-reason path was not accidentally half-wired). **Concurrency test:** 10 parallel `POST /tickets` produce 10 distinct ticket numbers with no gaps or duplicates. **Transaction test:** a forced failure after ticket insert leaves no orphan ticket and no orphan event. |
| UI | Vitest + Testing Library | Create Ticket: required-field errors render and are associated with their inputs; input preserved after a server 422; submit disabled while in flight. My Tickets: loading → rows; the two empty states; error + retry; filter change refetches; pagination controls. Ticket Detail: header renders all Labsheet fields; tab switching; comment composer posts and clears; attachment list shows Delete only on own uploads; confirm dialog cancels without deleting. |
| E2E | Playwright | **J1 (primary):** create a ticket → land on Detail showing the ticket number → open My Tickets → the ticket is listed → filter by its status/category → still listed → open it → post a comment → it appears → upload a PNG → it appears in Attachments and in the Event Log → delete it → it disappears and a removal event appears. **J2 (authorization):** as requester B, navigate directly to requester A's `/tickets/:id` → Access Denied. **J3 (validation/responsive):** submit an empty Create Ticket form → field errors visible; render My Tickets at 375 px → card layout, no horizontal page scroll. |
| Migration | Prisma | Migrate from the Lab 1 baseline on a clean DB, then seed; assert the Lab 1 four categories survive with `code`/`isActive` backfilled. |

**Definition of Done for Lab 2** (W4 lecture theme): every FR in scope has ≥1 automated test;
every mandatory business-rule test above passes; server and client coverage ≥80%; Lab 1's five
tests still pass; `docs/lab-02/tests.md` records the test-ID → file → requirement mapping in the
same table format Lab 1 used; passing terminal output captured for the submission.
