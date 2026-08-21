# TokTickIT SDS — Decision Register Addendum (Lab 2)

Continues the Decision Register in `references/TokTickIT-System-Level-SDS-v1.0.md`. D-13...D-20
were originally signed off 2026-08-18. Following the first PR #14 review pass, D-15, D-17, D-18,
and D-19 were corrected on 2026-08-21 (see the "Corrected" status marker on each). Following a
second PR #14 review pass the same day, D-19's exact tokens were updated and D-21, D-22, D-23
were added. D-13, D-14, D-16, D-20 are unchanged. Status: CONFIRMED, same weight as D-01...D-12.

## D-13 — Requester status authority is corrected to match the Labsheet (supersedes part of D-02)

**Decision.** SDS D-02's clause "any authorized user may cancel or reopen" is withdrawn.
Replacement text:

> Only IT Staff or Administrator may change a ticket's formal status (including Cancelled and
> reopening). A Requester may: confirm or reject a resolution, and request reopening. A
> requester's confirmation, rejection, or reopen request records a flag plus a TicketEvent and
> never changes formal status by itself.

**Why.** Labsheet role table is the professor's ground truth: Requester's list is create / view
own / set Requested Priority / confirm or reject a resolution / request reopening. "Change ticket
status" appears only under "IT Staff and Administrator can both". D-02's blanket cancel/reopen
right is not derivable from any source document and directly contradicts the graded one.

**Status:** CONFIRMED.

## D-14 — Reopen-request and resolution confirm/reject are modeled but deferred out of Lab 2

**Decision.** Model as TicketEvent types RESOLUTION_CONFIRMED / RESOLUTION_REJECTED /
REOPEN_REQUESTED plus a nullable `requesterResolutionConfirmedAt` column on Ticket. No Lab 2
endpoint, no Lab 2 UI control — implemented in Lab 3 alongside IT Staff status changes.

**Why.** These actions are only reachable from Resolved/Closed/Cancelled, and nothing in Lab 2
can reach those statuses. The Ticket status enum ships complete (all seven values) but the only
reachable status in Lab 2 is `NEW` — no transition service, no status-change endpoint in Lab 2.

**Status:** CONFIRMED.

## D-15 — Corrected: the Comment entity and Feature-E are REMOVED from Lab 2 scope

**Corrected 2026-08-21 (was: "Add the Comment entity — Feature-E is in scope").** PR #14 review
confirmed directly against the official Lab 2 labsheet: **Public Comments are explicitly excluded
from Lab 2, together with Internal Notes and Actions Taken.** These are named as later-lab
additions, alongside role-specific IT Staff controls and workflow.

**Decision.** Feature-E (Ticket Comments) and its `Comment` entity, endpoints
(`GET/POST /api/v1/tickets/:id/comments`), UI tab, and tests are removed from the Lab 2 spec set
entirely — not deferred-with-scaffolding, removed. FR-024/FR-025/BR-018 (comment behavior) move
to a later-lab feature inventory entry and are out of scope for every Lab 2 deliverable
(`specification.md`, `ui-spec.md`, `api-spec.md`, `tests.md`). Ticket Detail in Lab 2 therefore
ships three tabs — Attachments, Service Actions (read-only placeholder, empty in Lab 2), Event
Log — not four; there is no Public Comments tab.

**Why this reverses the original W3 sign-off.** The original D-15 read the mockup's default-open
"Public Comments" tab and the Requester's "respond to IT Staff" ability as evidence comments were
in scope, while flagging the lecture caption ("Later labs will add role-specific IT Staff
controls, **communication**, workflow, and Actions Taken") as a countervailing risk to
re-confirm before Issue 10. That re-confirmation happened at PR #14 review: the labsheet is
unambiguous that comments, internal notes, and actions taken are excluded from Lab 2 as a group.
The mockup screen is illustrative of the eventual full ticket detail view, not a Lab 2 scope
grant.

**Status:** CORRECTED — Feature-E removed from Lab 2. No comment code, schema, or test exists in
this spec set. Historical rationale for the original (reversed) call is kept in
`references/TokTickIT-Lab2-Implementation-Plan-v0.1.md` for traceability only.

## D-16 — RelatedSystem becomes reference data

**Decision.** Add a `RelatedSystem` reference table (`id, code, name, isActive`), seeded, with
`Ticket.relatedSystemId` optional. Rendered as a select on Create Ticket.

**Why.** Labsheet lists Related System in the Ticket header; the Administrator manages
"Categories and Related Systems" — implying a managed table, not free text.

**Status:** CONFIRMED.

## D-17 — Corrected: My Tickets search IS required for Lab 2

**Corrected 2026-08-21 (was: "Free-text search is out of Lab 2's required scope").** PR #14
review confirmed the official Lab 2 labsheet requires search in My Tickets in addition to
filtering, sorting, and pagination — it is part of the product increment and the API list-query
contract for this lab, not deferred to Lab 3.

**Decision.** My Tickets (`GET /api/v1/tickets`) accepts a `q` query parameter that performs a
case-insensitive substring search across `ticketNo` and `summary` for the requester's own
tickets, combined with the existing `status`/`categoryId` filters (AND semantics — search
narrows the filtered set, it does not replace it), `sort`, and pagination. FR-016 is rewritten to
include search; FR-016b (the old "search deferred to Lab 3" requirement) is withdrawn — there is
no longer a separate Lab-3-only search requirement, because search ships in Lab 2.

**Query syntax.** `q` is plain substring text, 1..100 characters after trim; matching is
case-insensitive and does not support wildcards, boolean operators, or regex — an agent must not
build a `LIKE '%...%'` from unescaped user input directly into raw SQL (Prisma parameterized
`contains` with `mode: 'insensitive'` is the intended implementation). An empty or
whitespace-only `q` is treated as "no search" (equivalent to omitting the parameter), not a 422 —
this matches how the status/category filters behave when omitted. A `q` longer than 100
characters is rejected with 422 `VALIDATION_ERROR`.

**Validation.** `q` is trimmed server-side before use; leading/trailing whitespace never
participates in the match. No minimum length is enforced (a 1-character search is valid, if
slow — pagination bounds the result set regardless).

**Tests required (Lab 2).** Search matches ticket number substring; search matches summary
substring (case-insensitive); search combined with a status filter narrows correctly (AND, not
OR); a search with no matches returns an empty page, not an error; a `q` over 100 characters
returns 422; a requester's search never returns another requester's tickets (still scoped to
`req.user.id` — search does not bypass the ownership scope from D-13/the Authorization Model);
an empty/whitespace `q` behaves identically to omitting `q`.

**Status:** CORRECTED — search is in Lab 2 scope. See `specification.md` FR-016 and
`api-spec.md` endpoint `GET /api/v1/tickets`.

## D-18 — Corrected: Lab 2 ships a real Development Requester Selection screen, not a header/env seam

**Corrected 2026-08-21 (was: "Lab 2 uses a stubbed server-side identity seam, not real login").**
PR #14 review found the original mechanism (an `x-dev-user-email` header or
`DEV_DEFAULT_USER_EMAIL` env fallback, invisible to the tester) cannot satisfy the labsheet's
requirement for a visible Development Requester Selection screen backed by seeded active
Requesters, with selected-user display, a "Change Requester" action, and requester-scoped data
reload. A header/env-only seam has no UI and cannot produce the submission evidence (screenshots,
E2E assertions) the labsheet asks for.

**Decision.** Lab 2 ships a real, visible **Development Requester Selection** screen:

- On first load (no requester selected in the current browser session — `sessionStorage`, not a
  cookie/JWT), the app renders a full-page requester picker: a list of seeded, active Requester
  users (display name + email), fetched from `GET /api/v1/dev/requesters` (no auth required for
  this endpoint — it exists only to bootstrap the picker itself). Selecting a row calls
  `POST /api/v1/dev/session` with `{ userId }`, which validates the id is an active Requester,
  writes it to `sessionStorage` as the active identity, and the app then proceeds to My Tickets.
- The application header displays the selected requester's display name and a **"Change
  Requester"** control. Activating it clears the stored identity and returns to the picker.
  Switching requesters reloads all requester-scoped data (My Tickets, any open Ticket Detail) —
  no stale data from the previous requester may remain visible after a switch.
- Every subsequent request carries the selected `userId` via the `x-dev-user-id` header
  (server-validated against the active-Requester list on every request, not just at selection
  time — a deactivated or unknown id in the header is rejected with 401, which also forces the
  client back to the picker). This is a plain identity-presence check, not role-based
  authorization (see D-21) — it keeps the actual identity-resolution mechanism
  (`resolveCurrentUser` middleware, `req.user`) unchanged from the original design; only the
  source of the identity value changes, from an invisible header/env default to a visible,
  user-driven selection captured through a real screen.
- The picker and "Change Requester" control are **clearly labelled as development/testing
  scaffolding, not authentication**: the picker screen carries a visible banner — "Development
  Requester Selection — this stands in for sign-in in Lab 2; Lab 3 replaces it with real
  authentication" — and no password, session cookie, or credential concept is introduced. No
  Login screen, First Password Change screen, password verification, `Session` model, or CSRF
  protection ships in Lab 2; those remain Lab 3, unchanged from the original decision.

**Why.** The labsheet requires visible evidence of requester-driven testing (the selector, the
selected-user display, the Change Requester action, and requester-scoped reload) that an
invisible header/env seam structurally cannot produce — there is no screen to screenshot, no
control to click in an E2E test, and no reload behavior to assert on. Rebuilding the seam as a
real screen satisfies the same underlying need (Lab 2 has no login) while meeting the UI and
evidence requirements the labsheet actually asks for.

**Mechanism carried forward unchanged.** `resolveCurrentUser` still loads the active `User` by id
and sets `req.user`; every route/service still consumes `req.user`, never the header directly.
Lab 3 replaces only the identity-source step (header value from the dev picker → session cookie
from real login); the rest of the resolution chain, and the CORS caveat below, are unchanged.

**One caveat carried forward from the original review pass:** `app.ts` currently uses bare
`cors()`, which doesn't set `credentials`. That's fine for the header-based dev-selector value (a
custom header still triggers a preflight that default `cors()` reflects), but Lab 3's
cookie-based session will need `cors({ origin, credentials: true })`.

**Status:** CORRECTED — replaces the invisible header/env-only seam with a visible Development
Requester Selection screen. See `ui-spec.md` "Development Requester Selection" and `api-spec.md`
endpoints `GET /api/v1/dev/requesters` / `POST /api/v1/dev/session`.

## D-19 — Corrected: the UI theme is Zen Green, not KMUTT orange/yellow/blue-grey

**Corrected 2026-08-21 (was: "D-09 stands — KMUTT orange/yellow/blue-grey, no code in W3").**
PR #14 review confirmed the official Lab 2 labsheet makes the Zen Green design tokens and
responsive presentation rules **mandatory for Lab 2**, not merely an illustrative template choice
in one mockup screenshot. The original D-19 read Figure 1's "Illustrative" caption and a separate
generic KMUTT-palette slide (used for the course's unrelated POS teaching example, not for
TokTickIT) as evidence the Zen Green look was disposable. On review, that reading does not hold:
the labsheet presents Zen Green as the design language for the Lab 2 screens themselves, and nothing
in the source material assigns the general KMUTT palette to TokTickIT's UI.

**Decision.** Lab 2's UI implements the Zen Green token set defined in `ui-spec.md` §"Zen Green
Design Tokens" (deep green header/primary-action surfaces, light neutral background, WCAG 2.2 AA
contrast on every token pairing actually used) in place of the KMUTT orange/yellow/blue-grey
tokens. SDS D-09 (System-Level SDS, `references/TokTickIT-System-Level-SDS-v1.0.md`) is superseded
for TokTickIT specifically by this decision; D-09's general course guidance is otherwise
unaffected.

**Exact tokens — updated 2026-08-21, second review pass.** The first pass here defined an
invented token set because no hex values were visible in the source material at the time. The
second review pass supplied the labsheet's actual published values: Primary `#006B3C`, Secondary
`#0B7A46`, Pale `#EAF6EF`, page background `#F5F7F6`. `ui-spec.md` §1 now uses these exact values,
carried into a verification checklist (computed-style/screenshot check) so implementation and
submission evidence are objectively checkable against them.

**Status:** CORRECTED — Zen Green, with the exact published tokens, is the Lab 2 theme. See
`ui-spec.md` §1 for the full token table, component treatment, verification checklist, and
responsive rules.

## D-20 — API versioning and storage staging

**D-20a.** `/api/v1` from now on; Lab 1's `/api/health` and `/api/categories` stay mounted,
unchanged, as aliases — do not rewrite Lab 1 tests.

**D-20b.** Storage adapter interface written against SeaweedFS (D-06), Lab 2 defaults to a
`LocalDiskStorage` implementation.

**D-20c.** New entities use `String @id @default(uuid())`. `Category` keeps its Lab 1 `Int`
autoincrement PK — migrating it would break the Lab 1 migration/seed/tests/submitted evidence for
no benefit. `RelatedSystem` uses `Int` too, for symmetry with Category.

**Status:** CONFIRMED.

## D-21 — New 2026-08-21: Lab 2 has no role-based access control

**Decision.** Lab 2 code never branches on `User.role`. There is no IT Staff or Administrator
code path anywhere in the Lab 2 contract — not server middleware, not an API endpoint, not a UI
control. The only access rule is ownership: a ticket is visible to the Development Requester who
created it, checked identically regardless of role. `User.role` remains a column (SDS baseline
schema, D-01...D-12) but is otherwise inert in Lab 2.

**Why.** The second PR #14 review pass flagged the earlier "implement the IT Staff/Administrator
read-all branch now, since it's cheap" language (feature-d.md, api-spec.md) as unjustified scope:
that branch has no reachable caller and no Lab 2 test can exercise it, since no IT Staff screen
or identity path exists. Lab 2 explicitly excludes real role-based authorization — modeling one
extra "role" of caller that can never actually occur in this lab is speculative code, not
correctness.

**Status:** CONFIRMED. See `specification.md` §2 (rewritten), `api-spec.md` endpoint #8, and
`feature-d-ticket-detail.md` Permissions.

## D-22 — New 2026-08-21: Event Log and Service Actions are removed from Lab 2's Ticket Detail

**Decision.** Ticket Detail in Lab 2 shows read-only ticket fields and the Attachments list only.
There is no Event Log tab/section, no `GET .../events` endpoint, and no Service Actions
tab/section — not even as an empty placeholder. `TicketEvent` rows (`TICKET_CREATED`,
`ATTACHMENT_ADDED`, `ATTACHMENT_REMOVED`) are still written, because BR-015/NFR-004 require that
independently of any UI — only the read/display path is removed from Lab 2.

**Why.** The original D-15 rationale (and the first correction pass) read the eventual full
ticket-detail mockup, which does show an Event Log and later a Service Actions area, as
justification for shipping an empty/placeholder version now so "the tab structure matches the
eventual full view." The second review pass rejected that: the labsheet scopes this increment to
read-only ticket details plus the attachment lifecycle, and a placeholder for a feature that
doesn't exist yet is out-of-scope UI/API surface, not a helpful head start.

**Status:** CONFIRMED. See `specification.md` FR-021 (corrected) and §9 AC-19, `ui-spec.md` §6,
`api-spec.md` (events endpoint removed), `feature-d-ticket-detail.md`.

## D-23 — New 2026-08-21: explicit, testable seed data baseline

**Decision.** The seed script guarantees, deterministically: at least 4 active Development
Requesters and exactly 1 inactive Requester (fixed, predictable identities, not randomly
generated), exactly 4 active Categories (Lab 1 carryover), and at least 6 active Related Systems.
Seeding is idempotent — upserts by natural key (`email` for `User`, `code` for
`Category`/`RelatedSystem`), not blind inserts, so running it twice doesn't duplicate or error.

**Why.** The second review pass asked for a seed baseline explicit and testable enough to assert
against, rather than "some rows exist." The inactive Requester specifically exists to test that
D-18's picker and session endpoints correctly exclude/reject inactive users.

**Status:** CONFIRMED. See `specification.md` §7 and the migration/seed tests in `tests.md`.
