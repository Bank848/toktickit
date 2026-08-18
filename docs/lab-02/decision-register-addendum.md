# TokTickIT SDS — Decision Register Addendum (Lab 2)

Continues the Decision Register in `TokTickIT-v1.0.md`. D-13…D-20 were signed off 2026-08-18
after review by an Opus subagent (3 factual bugs fixed, 1 scope risk flagged — see §8 item 0
of the Lab 2 implementation plan). Status: CONFIRMED, same weight as D-01…D-12.

## D-13 — Requester status authority is corrected to match the Labsheet (supersedes part of D-02)

**Decision.** SDS D-02's clause "any authorized user may cancel or reopen" is withdrawn.
Replacement text:

> Only IT Staff or Administrator may change a ticket's formal status (including Cancelled and
> reopening). A Requester may: respond to IT Staff (public comment), confirm or reject a
> resolution, and request reopening. A requester's confirmation, rejection, or reopen request
> records a flag plus a TicketEvent and never changes formal status by itself.

**Why.** Labsheet §1.1 role table is the professor's ground truth: Requester's list is
create / view own / set Requested Priority / respond to IT Staff / confirm or reject a
resolution / request reopening. "Change ticket status" appears only under "IT Staff and
Administrator can both". D-02's blanket cancel/reopen right is not derivable from any source
document and directly contradicts the graded one.

**Status:** CONFIRMED. Downstream edits to apply to this SDS in Step 2 below.

## D-14 — Reopen-request and resolution confirm/reject are modeled but deferred out of Lab 2

**Decision.** Model as TicketEvent types RESOLUTION_CONFIRMED / RESOLUTION_REJECTED /
REOPEN_REQUESTED plus a nullable `requesterResolutionConfirmedAt` column on Ticket. No Lab 2
endpoint, no Lab 2 UI control — implemented in Lab 3 alongside IT Staff status changes.

**Why.** These actions are only reachable from Resolved/Closed/Cancelled, and nothing in Lab 2
can reach those statuses. The Ticket status enum ships complete (all seven values) but the only
reachable status in Lab 2 is `NEW` — no transition service, no status-change endpoint in Lab 2.

**Status:** CONFIRMED.

## D-15 — Add the Comment entity (Feature-E is in scope)

**Decision.** Add `Comment` as a child of Ticket. Comments are immutable once posted (no edit,
no delete endpoint in Lab 2). "Internal Notes" is a separate, IT-Staff-only entity, out of
scope for Lab 2 and never conflated with Comment — recommend a separate `InternalNote` model in
Lab 3 (poka-yoke: two tables make a visibility leak structurally impossible, one table with a
`visibility` flag does not).

**Why.** Labsheet §1.2 Final Ticket Model says "No. of Child entities: 5" and names four
(Public Comments, Internal Notes, Actions Taken, Attachments) — the fifth is `TicketEvent`,
per the mockup's Event Log tab (state this reasoning explicitly in `data-model.md`, a grader
will look for it). §1.1 grants "add public comments" to all three roles.

**Grading-risk flag (from the Opus review pass — resurfaced at Lab 2 plan §8 item 0, highest
priority open question).** §0 of the source plan quotes the Lab 2 lecture's own caption:
"Later labs will add role-specific IT Staff controls, **communication**, workflow, and Actions
Taken" — public comments are the natural referent of "communication," and the W4 activity line
never names comments. The counter-argument ("respond to IT Staff" is a named Requester ability;
the mockup's default-open tab is Public Comments) keeps this a defensible call, not an error,
but it is the single largest scope addition in this plan beyond what the lecture explicitly
assigns to Lab 2. **This decision stays CONFIRMED for Issues 5–8 (W3) since Comments don't
touch any W3 deliverable** — no comment code ships until Issue 10 (W4). Re-confirm with the TA
before Issue 10 starts.

**Status:** CONFIRMED for W3 scope; re-confirm before W4 Issue 10.

## D-16 — RelatedSystem becomes reference data

**Decision.** Add a `RelatedSystem` reference table (`id, code, name, isActive`), seeded, with
`Ticket.relatedSystemId` optional. Rendered as a select on Create Ticket (W4).

**Why.** Labsheet §1.2 lists Related System in the Ticket header; §1.1 gives the Administrator
"manage Categories and Related Systems" — implying a managed table, not free text.

**Status:** CONFIRMED (student sign-off 2026-08-18: "ตาราง reference data ตามแผน").

## D-17 — Free-text search is out of Lab 2's required scope

**Decision.** My Tickets (W4) filters by status and category only, plus sort and pagination.
FR-016 stays as filtering; search moves to FR-016b, Feature-O, Lab 3+.

**Why.** Neither the Labsheet nor the lecture mentions search for the Requester MVP.

**Status:** CONFIRMED.

## D-18 — Lab 2 uses a stubbed server-side identity seam, not real login

**Decision.** Lab 2 ships the `User` model and a `resolveCurrentUser` middleware producing the
same `req.user` context a real session will later produce. It does NOT ship a Login screen,
First Password Change screen, password verification, the `Session` model, or CSRF — those are
Lab 3.

**Why.** Lab 1 §4's deferral sentence ("Playwright, authentication, ticket creation, and image
upload will be introduced in later labs") lists what Lab 1 itself defers, not what Lab 2 must
contain. The lecture assigns ticket creation, attachments, and E2E to Lab 2 explicitly; it
never assigns authentication to Lab 2.

**Mechanism:** `resolveCurrentUser` reads `x-dev-user-email` header (or
`DEV_DEFAULT_USER_EMAIL` env fallback), loads the active `User` by normalized email, and sets
`req.user`. The dev fallback refuses to load unless `NODE_ENV !== 'production'` or
`ALLOW_DEV_IDENTITY=true` is explicitly set — startup fails fast otherwise. Every route/service
takes `req.user`; nothing reads the header directly, so Lab 3 replaces step 2 of the resolution
chain only.

**One caveat found during the Opus review pass:** `app.ts` currently uses bare `cors()`, which
doesn't set `credentials`. That's fine for the header-based stub (a custom header still
triggers a preflight that default `cors()` reflects), but Lab 3's cookie-based session will
need `cors({ origin, credentials: true })` — so "Lab 3 replaces step 2 only" has one small
exception: CORS config also changes then.

**Status:** CONFIRMED (student sign-off 2026-08-18: "Identity stub, auth = Lab 3 (ตามแผน)").

## D-19 — The UI theme is KMUTT orange/yellow/blue-grey, not Zen Green

**Decision.** D-09 stands (W4 concern — no code in W3). The lecture's "Zen Green theme UI"
phrase and Figure 1's green chrome are the template the mockup generator used; Figure 1's own
caption calls it "Illustrative," and the deck's separate KMUTT Color Theme slide (p.44)
reproduces the official palette (#FA4616 / #FFC72C / #7B8189) independently. Two independent
supports in the professor's own deck, not a stretch.

**Status:** CONFIRMED (student sign-off 2026-08-18: "น่าจะข้อแรก เราจะอิงตามใบแลป").

## D-20 — API versioning and storage staging

**D-20a.** `/api/v1` from now on; Lab 1's `/api/health` and `/api/categories` stay mounted,
unchanged, as aliases — do not rewrite Lab 1 tests.

**D-20b.** Storage adapter interface written against SeaweedFS (D-06), Lab 2 defaults to a
`LocalDiskStorage` implementation (W4 concern, out of scope for Issues 5-8).

**D-20c.** New entities use `String @id @default(uuid())`. `Category` keeps its Lab 1 `Int`
autoincrement PK — migrating it would break the Lab 1 migration/seed/tests/submitted evidence
for no benefit. `RelatedSystem` uses `Int` too, for symmetry with Category.

**Status:** CONFIRMED.
