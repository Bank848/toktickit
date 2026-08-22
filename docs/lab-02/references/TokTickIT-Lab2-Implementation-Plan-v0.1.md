> **Status: SUPERSEDED — kept for historical traceability only.** This is the internal W3
> implementation plan the Lab 2 spec set (`specification.md`, `tests.md`, `ui-spec.md`,
> `api-spec.md`) was originally based on, before it was corrected against the official Lab 2
> labsheet and lecture deck. It is not an authoritative source: where it conflicts with
> `specification.md` or the Decision Register Addendum, `specification.md` wins. It is kept here
> only because the Decision Register Addendum's D-13...D-20 rationale refers back to review
> findings recorded in this document.

I read the Lab 1 labsheet, the full Lab 2 lecture deck (59 slides), the approved v1.0 SDS, the SRS draft, and the actual repo state. Full plan below.

---

# TokTickIT — Lab 2 Implementation Plan (Sprint 2: Requester Ticketing MVP with UI Foundations)

**Status:** Signed off 18 Aug 2026, then Opus-reviewed 18 Aug 2026 (verdict: ready with minor fixes — 3 real bugs, no rework needed). Fixes applied inline: explicit `onDelete: Restrict` on optional FKs (§2.2), `downloadUrl` composition (§3.2/§3.3 #11), `Comment.body` column length (§2.2), an `<Alert>` component for the Labsheet's warning-state requirement (§5.0), coverage tooling and `multer` added to the right issues (§6/§7), three missing security tests (§6), and repo-hygiene notes (§7). D-13…D-17, D-20 stand as originally proposed. D-18 (identity stub, auth deferred to Lab 3), D-19 (KMUTT colors, not Zen Green) and D-16 (RelatedSystem as a reference table) are confirmed as-is. §7's branch plan is amended — see the note at the top of §7. One scope question surfaced by the review (Comments in/out of Lab 2) is now §8 item 0, highest priority.
**Authority order used:** Lab 1 Labsheet (professor) → Lab 2 lecture deck → approved System-Level SDS v1.0 (D-01…D-12) → student-drafted SRS v0.1.
**Repo:** `D:\CPE334\toktickit-real`, working branch `lab2-staging` (cut from `origin/main` @ `9747d4f`, per §7's amended branch-decision note).

---

## 0. What Lab 2 actually is, per the sources

From slide 2 of `Lecture+3+-+Lab+2.pdf` (verbatim activity column):

| Week | Activity |
|---|---|
| W3, 18 Aug | **Lab 2-1. Ticket Creation:** engineering contract, Spec DD, Test DD, DB increment & seed, REST API contract |
| W4, 25 Aug | **Lab 2-2.** Create Ticket / My Tickets / Ticket Detail screens, attachments, Zen Green theme UI, full test suite (unit/API/UI/E2E) |

Slide 11/58 caption: *"Lab 2 implements the Requester-facing Create Ticket, My Tickets, Ticket Detail, and Attachment functions. Later labs will add role-specific IT Staff controls, communication, workflow, and Actions Taken."*

So W3 is **design + database + contract, no screens**; W4 is **screens + attachments + the full test suite**. Note the slide says "Zen Green theme UI" — that conflicts with D-09 (KMUTT palette). See D-19 below.

---

## 1. Resolved decisions

These continue the SDS Decision Register. D-13…D-20 are **confirmed** (signed off 18 Aug 2026, see Status line above) with the same weight D-01…D-12 got, because the SDS conflict rule says a feature spec may extend but not silently contradict the baseline. The SDS document itself (`TokTickIT-v1.0.md`) still needs the downstream edits listed under each decision below applied to it — confirming the decision here does not by itself update the SDS text.

### D-13 — Requester status authority is corrected to match the Labsheet (supersedes part of D-02)

**Decision.** SDS D-02's clause *"any authorized user may cancel or reopen"* is **withdrawn**. Replacement text:

> Only IT Staff or Administrator may change a ticket's formal status (including Cancelled and reopening). A Requester may: respond to IT Staff (public comment), confirm **or reject** a resolution, and **request** reopening. A requester's confirmation, rejection, or reopen request records a flag plus a TicketEvent and never changes formal status by itself.

**Why.** Labsheet §1.1 role table is the professor's ground truth: Requester's list is *create / view own / set Requested Priority / respond to IT Staff / confirm or reject a resolution / request reopening*. "Change ticket status" appears only under "IT Staff and Administrator can both". D-02's blanket cancel/reopen right is not derivable from any source document and directly contradicts the graded one. The SDS also already half-agrees with the Labsheet in its own invariant list ("The Requester may indicate that the problem appears resolved … but this records a confirmation flag/event and does not directly change formal status"), so D-02's cancel/reopen sentence was internally inconsistent to begin with.

**Downstream edits required:** SDS Authorization Matrix rows "Cancel an accessible ticket" and "Reopen an accessible ticket" → Requester = **No**; Ticket Status Baseline table (Resolved/Cancelled rows); the D-02 callout box; Mandatory Ticket Invariants bullets 2 and 4; Mandatory Business-Rule Tests bullets 4 and 5. In the SRS draft: **FR-023 must be rewritten** and **BR-006 / BR-007 must be re-scoped to IT Staff/Administrator**; add BR-008b for reject-resolution.

### D-14 — Reopen-request and resolution confirm/reject are modeled but **deferred out of Lab 2**

**Decision.** Model them as a `TicketEvent` of type `RESOLUTION_CONFIRMED` / `RESOLUTION_REJECTED` / `REOPEN_REQUESTED` plus a nullable `requesterResolutionConfirmedAt` column on Ticket (already in the SDS field list). **No Lab 2 endpoint, no Lab 2 UI control.** Implement in Lab 3 alongside IT Staff status changes.

**Why.** These actions are only reachable from `Resolved` / `Closed` / `Cancelled`, and in Lab 2 nothing can reach those statuses — no IT Staff feature exists to set them. Shipping a "Confirm resolution" button that can never light up is dead UI and untestable-by-E2E. This is a scoping consequence, not a requirements change; the SRS still carries the FRs, they just map to Lab 3.

**Consequence for Lab 2:** the Ticket status enum ships complete (all seven values), but the only reachable status in Lab 2 is `New`. State-transition code is **not** written in Lab 2 — there is no transition service, no status-change endpoint. Lab 3 owns the entire state machine.

### D-15 — Add the `Comment` entity (Feature-E is in scope)

**Decision.** Confirmed — add `Comment` as a child of Ticket. This closes the gap flagged in the SRS draft's §"Ticket Comments".

**Why.** It is not merely inferred from the illustrative mockup. Labsheet §1.2 **Final Ticket Model** says "No. of Child entities: 5" and names four of them (Public Comments, Internal Notes, Actions Taken, Attachments) — the fifth is unnamed in the table, and this plan takes it to be `TicketEvent` given the mockup's Event Log tab; say so explicitly in `docs/lab-02/data-model.md` so a grader sees the reasoning rather than a silent gap. §1.1 grants "add public comments" to all three roles. The mockup's Public Comments tab is corroboration, not the source. The v1.0 SDS domain-model table simply omits it — that is an SDS defect, not a deliberate exclusion.

**Grading-risk flag (from the Opus review pass, higher priority than the other §8 items — resurfaced there too).** §0's own quoted caption assigns "communication" to *later* labs ("Later labs will add role-specific IT Staff controls, **communication**, workflow, and Actions Taken"), and Labsheet §1.2's "Final Ticket Model" is framed as the Lab-4 end state, not necessarily Lab 2's. The W4 activity line names screens, attachments, theme, and tests, and never names comments. The counter-argument is real too — "respond to IT Staff" is a named Requester ability in §1.1, and the mockup's default-open tab is Public Comments — so this stays a defensible call, not an error, but it is the single largest scope addition in this plan beyond what the lecture explicitly assigns to Lab 2 (one entity, two endpoints, a UI tab, a test block: Issue 10 plus part of 15). Keep Issue 10 severable from Issues 9 and 11 so it can be dropped or reduced to a read-only tab without disturbing anything else, and confirm with the TA before Issue 10 starts (W4), not after.

Comments are **immutable** once posted (no edit endpoint, no delete endpoint in Lab 2). "Internal Notes" is a *separate* child entity per the Labsheet and is IT-Staff-only — **out of scope for Lab 2**, and must not be conflated with Comment. Design `Comment` so Internal Notes can later be either a second model or a `visibility` discriminator; recommendation is a **separate `InternalNote` model in Lab 3** so no query can ever accidentally leak an internal note to a Requester through a shared table. (Poka-yoke: a Requester-visible query that must remember `WHERE visibility='PUBLIC'` is a leak waiting to happen; two tables make the leak impossible.)

### D-16 — `RelatedSystem` becomes reference data (new — this gap is in neither the SDS nor the SRS draft)

**Decision.** Add a `RelatedSystem` reference table (`id, code, name, isActive`), seeded, with `Ticket.relatedSystemId` **optional**. Rendered as a select on Create Ticket.

**Why.** Labsheet §1.2 lists `Related System` in the Ticket header, the mockup shows it beside Category, and Labsheet §1.1 gives the Administrator "manage Categories **and Related Systems**". The v1.0 SDS domain model has no such entity and the SRS draft never mentions it — this is a real hole that would have surfaced mid-implementation. Modeling it as a table now (rather than free text) costs one model + one seed block and avoids a data migration when Lab 4's Reference Data Management screen arrives.

Add **FR-008b** (ticket may reference a Related System), **BR-011b** (deactivate, never hard-delete while referenced), and a Feature-M scope note.

### D-17 — Free-text search is **out** of Lab 2's required scope

**Decision.** My Tickets filters by **status** and **category** only, plus sort and pagination. Resolves the SRS draft's FR-016 `[NEW]` marker: keep FR-016 as filtering; move search to **FR-016b, Feature-O, Lab 3+**.

**Why.** Neither the Labsheet nor the lecture mentions search for the Requester MVP; Labsheet §1.3 puts cross-ticket search under Administrator/IT Staff screens. A Requester's own ticket list is inherently small, so search earns little and costs a query-shape decision (ILIKE vs. tsvector) better made once IT Staff need it across all tickets. Listed as an explicitly-labelled stretch item on Issue 14 if time remains.

### D-18 — Lab 2 uses a **stubbed server-side identity seam**, not real login

**Decision.** Lab 2 ships the `User` model and a `resolveCurrentUser` middleware that produces the same `req.user` context a real session will later produce. It does **not** ship: a Login screen, First Password Change screen, password verification, the `Session` model, or CSRF. Those are Lab 3.

**Why — this reconciles the apparent contradiction in the brief.** Lab 1 §4 says *"Playwright, authentication, ticket creation, and image upload will be introduced in later labs."* That sentence lists what Lab **1** defers, not what Lab **2** must contain. The lecture assigns ticket creation, image upload (attachments) and E2E to Lab 2 explicitly; it never assigns authentication to Lab 2, and Lab 2's own title is "Requester Ticketing MVP with UI Foundations". Login/First Password Change are Labsheet §1.3 screens with no Lab 2 mention. So: **Lab 2 = the "ticket creation + image upload + Playwright" third of that deferral list; authentication is the remaining third and lands in Lab 3.**

But a ticket cannot exist without a requester, so Lab 2 needs *identity* without *authentication*. Mechanism:

```
server/src/auth/currentUser.ts
  resolveCurrentUser(req) →
    1. (Lab 3) session cookie lookup            ← not implemented yet
    2. dev fallback: x-dev-user-email header, else DEV_DEFAULT_USER_EMAIL
    3. load active User by normalized email → req.user = { id, email, displayName, role }
    4. unresolvable → 401 with the standard error envelope
```

Two hard guardrails, both enforced at startup:
- The dev fallback **refuses to load** unless `NODE_ENV !== 'production'` **or** `ALLOW_DEV_IDENTITY=true` is explicitly set; startup fails fast with a safe message otherwise.
- Every route handler and domain service takes `req.user` — **nothing** reads the header directly. Lab 3 then replaces step 2 only, and no route, service, or test changes.

This gives the API tests and Playwright a clean way to switch identity (send a different header) to prove the FR-007 ownership rule — which is exactly the "protected endpoints reject unauthorized access even when called outside the UI" test the SDS mandates. Document the stub in `docs/lab-02/` and in the submission's limitations note; a graded security reviewer should see the seam is deliberate, bounded, and production-blocked.

### D-19 — The UI theme is **KMUTT orange/yellow/blue-grey**, not Zen Green

**Decision.** D-09 stands. The lecture slide 2's phrase "Zen Green theme UI" and Figure 1's green chrome are the *template* the professor's mockup generator used; slide 11's own caption calls Figure 1 "**Illustrative**", the deck's KMUTT Color Theme slide reproduces the official palette, and D-09 already approved it. Build in KMUTT colors and say so in the submission so the difference reads as a decision, not an oversight.

**Accessibility trap to respect:** `#FA4616` with white text is ≈3.4:1 — it fails WCAG 2.2 AA for body-size text. Per D-09, primary buttons use orange background with **dark** text (`#1F2937`), and any orange-coloured *text* or link uses the derived `#8A2608`.

### D-20 — API versioning and storage staging

**D-20a — `/api/v1` from now on, Lab 1 routes kept as aliases.** The SDS requires `/api/v1`; the Lab 1 code mounts bare `/api/health` and `/api/categories`, and Lab 1's graded evidence and tests reference those paths. Mount the v1 router at `/api/v1` and keep the two Lab 1 paths as thin aliases so `tests/lab-01/*` keeps passing untouched. Do not rewrite Lab 1 tests — a green Lab 1 suite is regression proof.

**D-20b — Storage adapter with a local-disk implementation for Lab 2.** D-06 (SeaweedFS) is preserved as the deployment target and the interface is written against it, but Lab 2 defaults to a `LocalDiskStorage` implementation selected by `STORAGE_DRIVER=local|seaweed`. Metadata still lives only in Postgres, stored objects are still renamed to generated keys, and storage keys are still never exposed to clients — so no SDS rule is contradicted, only the driver is staged. **This one genuinely needs instructor/peer sign-off**, because a strict reading of D-06 says weed mini runs on the same host. If sign-off is refused, installing `weed mini` and pointing an S3 client at it is a half-day of setup and the adapter interface means zero application-code change.

**D-20c — Identifier strategy.** New entities use `String @id @default(uuid())` per the SDS. `Category` keeps its existing `Int` autoincrement PK from Lab 1 — migrating it would break the Lab 1 migration, seed, tests and submitted evidence for no benefit. `RelatedSystem` uses `Int` too, for symmetry with Category as reference data. Document the deliberate inconsistency.

---

## 2. Data model increment

Current state: one model, `Category { id Int, name String @unique, createdAt }`. Everything below is additive; no destructive migration.

### 2.1 Enums

```prisma
enum UserRole        { REQUESTER  IT_STAFF  ADMINISTRATOR }
enum TicketStatus    { NEW  ASSIGNED  IN_PROGRESS  PENDING_REQUESTER  RESOLVED  CLOSED  CANCELLED }
enum Priority        { LOW  MEDIUM  HIGH  URGENT }
enum TicketEventType { TICKET_CREATED  COMMENT_ADDED  ATTACHMENT_ADDED  ATTACHMENT_REMOVED }
```

`TicketStatus` and `Priority` ship complete per D-02/D-03 even though Lab 2 only ever writes `NEW`. `TicketEventType` ships only the four types Lab 2 can emit — adding enum values later is a trivial additive migration, and shipping unreachable event types invites an agent to write handlers for them.

### 2.2 Models to add

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique                 // stored lowercase/normalized
  displayName  String
  role         UserRole @default(REQUESTER)
  passwordHash String?                          // Lab 3 populates + makes required
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  requestedTickets Ticket[]     @relation("TicketRequester")
  ownedTickets     Ticket[]     @relation("TicketOwner")
  comments         Comment[]
  attachments      Attachment[] @relation("AttachmentUploader")
  deletedAttachments Attachment[] @relation("AttachmentDeleter")
  events           TicketEvent[]
}

model RelatedSystem {
  id       Int     @id @default(autoincrement())
  code     String  @unique
  name     String
  isActive Boolean @default(true)
  tickets  Ticket[]
}

model Ticket {
  id                String        @id @default(uuid())
  ticketNo          String        @unique          // TKT-YYYY-NNNNN
  summary           String                          // Labsheet "Summary"; SDS called it title
  description       String
  status            TicketStatus  @default(NEW)
  requestedPriority Priority
  itPriority        Priority                        // copies requestedPriority at creation (FR-011)
  resolutionSummary String?
  requesterResolutionConfirmedAt DateTime?          // written from Lab 3 (D-14)
  version           Int           @default(0)       // optimistic lock; unused until Lab 3
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  requesterId     String
  requester       User           @relation("TicketRequester", fields: [requesterId], references: [id], onDelete: Restrict)
  ownerId         String?
  owner           User?          @relation("TicketOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  categoryId      Int
  category        Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  relatedSystemId Int?
  relatedSystem   RelatedSystem? @relation(fields: [relatedSystemId], references: [id], onDelete: Restrict)

  comments    Comment[]
  attachments Attachment[]
  events      TicketEvent[]

  @@index([requesterId, createdAt])
  @@index([status])
  @@index([categoryId])
}

model Comment {
  id        String   @id @default(uuid())
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Restrict)
  body      String   @db.VarChar(2000)               // 1..2000 chars; API also rejects blank-after-trim
  createdAt DateTime @default(now())

  @@index([ticketId, createdAt])
}

model Attachment {
  id               String    @id @default(uuid())
  ticketId         String
  ticket           Ticket    @relation(fields: [ticketId], references: [id])
  uploadedById     String
  uploadedBy       User      @relation("AttachmentUploader", fields: [uploadedById], references: [id], onDelete: Restrict)
  originalFilename String
  mimeType         String
  sizeBytes        Int
  storageKey       String    @unique               // never serialized to clients
  createdAt        DateTime  @default(now())
  deletedAt        DateTime?                        // tombstone; row is never removed
  deletedById      String?
  deletedBy        User?     @relation("AttachmentDeleter", fields: [deletedById], references: [id], onDelete: Restrict)
  deletedReason    String?

  @@index([ticketId, deletedAt])
}

model TicketEvent {
  id        String          @id @default(uuid())
  ticketId  String
  ticket    Ticket          @relation(fields: [ticketId], references: [id])
  actorId   String
  actor     User            @relation(fields: [actorId], references: [id])
  eventType TicketEventType
  payload   Json?
  createdAt DateTime        @default(now())

  @@index([ticketId, createdAt])
}

model TicketCounter {
  year      Int      @id
  lastValue Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

Additive change to the existing model, backfilled by the seed:

```prisma
model Category {
  id          Int      @id @default(autoincrement())
  name        String   @unique
  code        String?  @unique      // "ACCESS","HARDWARE","SOFTWARE","NETWORK"
  description String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  tickets     Ticket[]
}
```

**Referential integrity:** every FK uses Prisma's default `onDelete: Restrict` for these relations — no cascades anywhere, per the SDS ("Tickets and Ticket Events are never cascade-deleted").

### 2.3 Ticket number generation (D-10)

`TKT-YYYY-NNNNN`, annual reset, generated **inside** the same `prisma.$transaction` as the ticket insert:

1. `UPDATE "TicketCounter" SET "lastValue" = "lastValue" + 1 WHERE year = $y RETURNING "lastValue"` — a single atomic row update takes the row lock; concurrent creators serialize on it.
2. If zero rows, insert `{year, lastValue: 1}`; on unique-violation, retry step 1 once (handles the two-concurrent-first-tickets-of-the-year race).
3. Format `TKT-${year}-${String(n).padStart(5,'0')}`.
4. `Ticket.ticketNo @unique` is the backstop — if the counter is ever wrong, the insert fails loudly rather than silently duplicating.

Do **not** use `count(*) + 1`; it is not concurrency-safe and is the mistake a coding agent will reach for first. Say so explicitly in the issue.

### 2.4 Seed additions (idempotent, upsert-based like Lab 1's)

- Categories: backfill `code`/`isActive` on the four existing rows.
- RelatedSystems: `CORP_LAPTOP` Corporate Laptop, `EMAIL` Email, `VPN` VPN, `PRINTER` Printer, `ERP` ERP, plus one inactive row (`LEGACY_FS` Legacy File Server, `isActive:false`) so the "inactive is not offered but still displays on historical tickets" rule is testable.
- Users: `requester@toktickit.local` (Nattapong R., REQUESTER), `requester2@toktickit.local` (a second Requester — **required** to test the FR-007 cross-requester 403), `itstaff@toktickit.local` (IT_STAFF), `admin@toktickit.local` (ADMINISTRATOR). `passwordHash` null in Lab 2.
- No seeded tickets in the dev seed. A separate `prisma/seed-demo.ts` (invoked manually) can create ~12 tickets for the requester so pagination and filters are visually demonstrable — keep it out of the migration seed so tests start from a clean slate.

### 2.5 Explicitly deferred, and why

| Deferred | Reason |
|---|---|
| `Session` | No login in Lab 2 (D-18). One additive model in Lab 3. |
| `ServiceAction` | Lecture: "Later labs will add … Actions Taken." No Lab 2 behavior would touch it. |
| `Notification` | SRS FR-032 already marked later-lab; nothing in Lab 2 generates one. |
| `InternalNote` | IT-Staff-only per Labsheet §1.1 (D-15). |
| Full `TicketEventType` vocabulary (status/priority/ownership changes) | No Lab 2 code path can emit them (D-14). |
| `Attachment` virus scanning, thumbnailing | Not in any source document. |

---

## 3. REST API contract (Lab 2)

Conventions per SDS: root `/api/v1`, JSON except upload/download, camelCase, ISO-8601 UTC, DTOs only (never a Prisma model), 201 create / 401 auth / 403 authz / 404 missing / 409 conflict / 422 validation.

**Error envelope** (all non-2xx):
```json
{ "error": { "code": "TICKET_NOT_ACCESSIBLE", "message": "…", "fieldErrors": [], "correlationId": "…" } }
```

**Pagination envelope** (all collections):
```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 10, "total": 37, "totalPages": 4 } }
```

### 3.1 Endpoints

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 1 | `GET /api/v1/me` | Current identity for the header | 200 `UserDto` | 401 |
| 2 | `GET /api/v1/categories` | Active categories for the form | 200 `CategoryDto[]` | 401 |
| 3 | `GET /api/v1/related-systems` | Active related systems | 200 `RelatedSystemDto[]` | 401 |
| 4 | `POST /api/v1/tickets` | Create a ticket | **201** `TicketDetailDto` | 401, 422 |
| 5 | `GET /api/v1/tickets` | My Tickets, filtered + paged | 200 paged `TicketListItemDto` | 401, 422 |
| 6 | `GET /api/v1/tickets/:id` | Ticket Detail | 200 `TicketDetailDto` | 401, 403, 404 |
| 7 | `GET /api/v1/tickets/:id/comments` | Comment thread (paged, oldest→newest) | 200 paged `CommentDto` | 401, 403, 404 |
| 8 | `POST /api/v1/tickets/:id/comments` | Post a public comment | **201** `CommentDto` | 401, 403, 404, 422 |
| 9 | `GET /api/v1/tickets/:id/attachments` | Active attachments | 200 `AttachmentDto[]` | 401, 403, 404 |
| 10 | `POST /api/v1/tickets/:id/attachments` | Upload (multipart, field `file`) | **201** `AttachmentDto` | 401, 403, 404, **409** limit, **413** too large, 422 type |
| 11 | `GET /api/v1/attachments/:id/content` | Authenticated download | 200 stream | 401, 403, 404, **410** if deleted |
| 12 | `DELETE /api/v1/attachments/:id` | Uploader removes own attachment | **204** | 401, 403, 404, 409 (ticket Closed) |
| 13 | `GET /api/v1/tickets/:id/events` | Event Log tab (newest→oldest) | 200 paged `TicketEventDto` | 401, 403, 404 |
| 14 | `GET /api/v1/health` | v1 alias of Lab 1 health | 200 | — |

Lab 1 aliases `GET /api/health` and `GET /api/categories` stay mounted, unchanged, returning exactly what they return today.

### 3.2 Request/response DTOs

```ts
// #4 request
CreateTicketRequest {
  summary: string           // required, 5..150, trimmed
  description: string       // required, 10..5000, trimmed
  categoryId: number        // required, must be an ACTIVE category
  relatedSystemId?: number  // optional, must be ACTIVE if present
  requestedPriority: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'   // required
}

TicketListItemDto {
  id, ticketNo, summary,
  category: { id, name },
  status, requestedPriority, itPriority,
  createdAt, updatedAt,
  commentCount, attachmentCount
}

TicketDetailDto = TicketListItemDto + {
  description,
  relatedSystem: { id, name } | null,
  requester: { id, displayName },
  owner: { id, displayName } | null,
  resolutionSummary: string | null,
  version
}

CommentDto      { id, body, createdAt, author: { id, displayName, role } }
AttachmentDto   { id, originalFilename, mimeType, sizeBytes, createdAt,
                  uploadedBy: { id, displayName },
                  downloadUrl: `${API_BASE_URL}/api/v1/attachments/{id}/content` }   // never storageKey
TicketEventDto  { id, eventType, createdAt, actor: { id, displayName }, summaryText }
UserDto         { id, email, displayName, role }
```

### 3.3 Endpoint notes a coding agent will otherwise get wrong

**#5 `GET /api/v1/tickets`** — query params: `status` (repeatable, validated against the enum), `categoryId`, `page` (default 1, min 1), `pageSize` (default 10, **clamped to max 50**), `sort` (whitelist only: `createdAt:desc` default, `createdAt:asc`, `updatedAt:desc`, `ticketNo:asc`). Unknown `sort` → 422, never a raw string into `orderBy`. **The requester filter is not a query parameter** — the server always scopes to `req.user.id` for a REQUESTER. Do not add `?requesterId=`; that would be an IDOR handed to the client.

**#6 access rule** — a REQUESTER may read a ticket only if `ticket.requesterId === req.user.id`, else **403** (not 404). IT_STAFF/ADMINISTRATOR may read all — implement the role branch now even though no IT Staff screen exists, because the rule is cheap and the test proves FR-007.

**#10 upload validation order** (fail before touching storage): authorize → ticket exists and accessible → active attachment count < 5 (else 409 `ATTACHMENT_LIMIT_REACHED`) → declared size ≤ 5 MB, enforced by the multer limit so an oversized body is rejected during streaming, not after buffering (else 413) → extension ∈ {jpg, jpeg, png, webp, pdf} **and** declared MIME ∈ {image/jpeg, image/png, image/webp, application/pdf} **and** magic-byte sniff of the first bytes agrees with both (else 422 `ATTACHMENT_TYPE_REJECTED`). Only then write to storage under a generated key, then insert metadata + `ATTACHMENT_ADDED` event in one transaction. If the transaction fails, delete the just-written object (compensating cleanup, per SDS).

**#11 download headers** — `Content-Disposition: attachment; filename="<sanitized original>"`, `X-Content-Type-Options: nosniff`, and serve the **stored** mimeType, never a client-supplied one. Never redirect to a storage URL.

**`downloadUrl` composition (fixes a real bug, not a style choice).** `client/src/api.ts` calls an absolute `API_BASE_URL` (`http://localhost:4000` in dev) and `client/vite.config.ts` has no `server.proxy`, so a root-relative `downloadUrl` (`/api/v1/...`) resolves against the Vite dev origin (`:5173`), not the API, and 404s. The DTO must return the full absolute URL built from the same `API_BASE_URL` the client already uses, or the API layer must compose it client-side from an `id` alone — pick one in Issue 6, not during W4 E2E debugging.

**#12** — Lab 2 permits deletion only by the uploader (`attachment.uploadedById === req.user.id`) while `ticket.status !== 'CLOSED'`. The IT-Staff "delete another user's attachment with reason" path is Lab 3; return 403 for it now rather than half-implementing it. Delete = set `deletedAt`/`deletedById`, write `ATTACHMENT_REMOVED` in the same transaction, then delete the binary; if the binary delete fails, log with correlation ID and leave it queued — never restore visibility.

**#4 transaction** — ticket number + ticket insert + `TICKET_CREATED` event, all in one `prisma.$transaction`. `itPriority` is set equal to `requestedPriority` server-side and is **not** accepted from the request body (FR-011 + BR-009).

---

## 4. Feature-level design spec outlines

Five documents, one per feature, each following the SDS Feature Specification Contract's twelve sections. Below is the content skeleton each must carry; sections not restated inherit from the SDS by reference (the contract forbids duplicating shared rules).

### Feature-B — Ticket Creation
- **Identity.** FEAT-B, Ticket Creation, v1.0, Lab 2.
- **Traceability.** FR-008…FR-013, FR-008b · BR-001, BR-002, BR-009, BR-014, BR-015 · NFR-001, NFR-003 · D-03, D-10, D-13, D-16, D-18.
- **Behavior.** Actor: Requester (IT Staff/Admin also permitted per Labsheet, but no IT screen exists in Lab 2). Precondition: identity resolved, ≥1 active category. Main flow: open Create Ticket → fill summary/description/category/priority (+optional related system) → submit → server validates, allocates ticket number, persists, emits `TICKET_CREATED` → client navigates to the new Ticket Detail showing the ticket number. Alternatives: validation failure re-renders with field errors and **preserves all entered input**; category deactivated between page load and submit → 422 with a field error on category. Acceptance: a created ticket has status `NEW`, `ownerId` null, `itPriority === requestedPriority`, a unique `TKT-YYYY-NNNNN`, and exactly one `TICKET_CREATED` event.
- **Permissions.** Any authenticated user creates; `requesterId` is always `req.user.id` and is never accepted from the body.
- **Workflow.** Entry into `NEW` only. No transitions defined here.
- **Data.** Ticket, TicketCounter, TicketEvent (§2). Transaction boundary = number + insert + event.
- **API.** #4 (+ #2, #3 for form data).
- **UI.** §5.1.
- **NFRs.** p95 < 500 ms; WCAG 2.2 AA form labelling; double-submit disabled while in flight.
- **Dependencies.** Seeded categories, related systems, identity middleware.
- **Out of scope.** Attaching files during creation (see below), draft saving, ticket editing, IT Priority entry, requester selection.

> **Scoping call inside Feature-B:** SRS FR-012 says a Requester may attach files "at creation time or afterward". Lab 2 implements **afterward only** — attachments are uploaded from Ticket Detail after the ticket exists. Reason: attach-at-creation needs either a pre-created draft ticket or a temp-object staging area with orphan cleanup, which is real complexity for a cosmetic gain, and the mockup's Attachments tab lives on Ticket Detail anyway. FR-012 is therefore partially satisfied in Lab 2; note this in the traceability matrix rather than silently dropping it.

### Feature-C — My Tickets
- **Traceability.** FR-007, FR-014…FR-018 · NFR-001, NFR-003 · D-13, D-17, D-18.
- **Behavior.** Requester sees only their own tickets, all statuses, newest first; filter by status and category; paginate; click row → Detail. Empty state distinguishes "you have no tickets yet" (offers Create Ticket) from "no tickets match these filters" (offers Clear filters) — these are different user situations and must not share one message.
- **Permissions.** Server-side scoping (§3.3, #5). A REQUESTER cannot widen the scope by any parameter.
- **Data.** Read-only. Indexes `(requesterId, createdAt)`, `(status)`, `(categoryId)`.
- **API.** #5.
- **Out of scope.** Free-text search (D-17), saved views, CSV export, bulk actions, cross-requester views.

### Feature-D — Ticket Detail
- **Traceability.** FR-018…FR-021 · NFR-003, NFR-004, NFR-007 · D-13, D-14, D-15, D-16.
- **Behavior.** Header card shows Ticket No, Ticket Date, Category, Related System, Requester, Requested Priority, IT Priority, Current Status, Ticket Owner, Summary, Description, Resolution Summary — matching Labsheet §1.2 and the mockup's field layout. All fields are **read-only** in Lab 2 (non-editable field styling per Labsheet §1.4). Tabs: **Public Comments** (Feature-E), **Attachments** (Feature-F), **Event Log**. Deep-link `/tickets/:id` works on refresh; unauthorized → Access Denied view; unknown id → Not Found view (both are Labsheet §1.3 screens, cheap to add now).
- **Permissions.** §3.3 #6.
- **API.** #6, #13 (tabs use #7, #9).
- **Out of scope.** **Service Actions tab** (no `ServiceAction` model exists — omit the tab rather than render a permanently-empty one), confirm/reject resolution, request reopen, cancel, edit, owner assignment, internal notes.

### Feature-E — Ticket Comments
- **Traceability.** FR-024, FR-025, BR-018 · D-15.
- **Behavior.** Author posts a comment (1..2000 chars, trimmed, rejected if blank after trim); it appears at the appropriate end of the thread without a full page reload; each entry shows author display name, a role badge (Requester / IT Support), body, and localized timestamp. Comments are immutable — no edit or delete endpoint exists in Lab 2, and the mockup's per-comment "⋮" menu is therefore **not** implemented.
- **Permissions.** Any user who can read the ticket may comment. `authorId` is always `req.user.id` (BR-018: never post on another's behalf).
- **Data.** Comment + `COMMENT_ADDED` event, one transaction.
- **API.** #7, #8.
- **Out of scope.** Internal notes, mentions, rich text/markdown (render as plain text; React escapes by default and raw HTML is prohibited by the SDS), edit/delete, comment attachments.

### Feature-F — Attachments
- **Traceability.** FR-012 (partial), FR-026…FR-031 · BR-012, BR-013, BR-015 · D-06, D-11, D-20b.
- **Behavior.** Upload from Ticket Detail with client-side pre-checks (size, extension) that are advisory only — the server re-validates everything. Progress/disabled state during upload. List shows filename, size, uploader, date, Download, and Delete (only on the viewer's own uploads). Deleting requires a confirmation dialog and removes the file from the list; the removal shows in the Event Log.
- **Permissions.** Upload: anyone who can read the ticket. Delete: uploader only, ticket not Closed (Lab 2). Download: anyone who can read the ticket, via #11 only.
- **Data.** Attachment tombstones (never row-deleted), `ATTACHMENT_ADDED` / `ATTACHMENT_REMOVED` events.
- **API.** #9, #10, #11, #12.
- **NFRs.** Uploads excluded from the p95 target. Layered validation per OWASP file-upload guidance.
- **Out of scope.** Attach-at-creation, IT-Staff removal-with-reason, image thumbnails/inline preview, drag-and-drop multi-file upload, virus scanning, SeaweedFS driver enablement (interface only, D-20b).

---

## 5. Screen-by-screen UI plan

### 5.0 Foundations (built once, before the three screens)

- **Routing.** Add `react-router-dom`. Routes: `/` → redirect to `/tickets`; `/tickets`; `/tickets/new`; `/tickets/:id`; `/403` Access Denied; `*` Not Found. The Lab 1 "Check System" panel moves to `/system` (or a footer link) so its Lab 1 tests keep passing and the graded Lab 1 result stays reachable.
- **Theme tokens** in `client/src/styles/theme.css` as CSS custom properties, overriding Bootstrap's variables:
  `--tk-orange:#FA4616; --tk-yellow:#FFC72C; --tk-bluegrey:#7B8189; --tk-orange-dark:#8A2608; --tk-text:#1F2937; --tk-muted:#5B6573; --tk-bg:#FFFFFF; --tk-success:#2E7D32; --tk-danger:#B3261E;`
  Primary button = orange background + `--tk-text` (dark) text. Links and orange text = `--tk-orange-dark`. Focus ring = yellow, 2px, always visible.
- **AppShell.** Orange header bar: brand "TokTickIT", nav "My Tickets" / "Create Ticket", right-side profile chip showing `GET /me` display name. Collapses to a Bootstrap navbar toggler under `md`.
- **Shared components** (Labsheet §1.4 demands these exist as *defined styles*): `<PageHeader>`, `<StatusBadge>`, `<PriorityBadge>`, `<FieldRow>` (read-only field styling), `<LoadingState>`, `<EmptyState>`, `<ErrorState>` (with Retry), `<ConfirmDialog>` (focus-trapped, returns focus to the invoking control), `<Pagination>`, `<FormField>` (label + control + inline error, wired with `aria-describedby` / `aria-invalid`).
- **Badges never use colour alone** — every status/priority badge carries its text label, and an icon where useful (SDS UI standard + WCAG 1.4.1).
- **`<Alert variant="success"|"warning"|"danger"|"info">`.** Labsheet §1.4 enumerates "loading, empty, success, warning, and error states" as a required checklist item. §5.1's create-success message and §5.3's error states currently reuse ad hoc markup; route them through one variant-driven component so warning (currently unused anywhere) exists and the checklist is demonstrably covered.
- **API layer.** Extend `client/src/api.ts` into `client/src/api/` modules (`client.ts` with base URL, JSON parsing, error-envelope → typed `ApiError`; `tickets.ts`; `comments.ts`; `attachments.ts`; `reference.ts`). Components never call `fetch` directly.

### 5.1 Create Ticket — `/tickets/new`

Single-column card, `col-12 col-lg-8 mx-auto`. Fields in order: Summary (text, required, live char counter to 150) · Category (select, required, active only, placeholder "Select a category") · Related System (select, optional, "Not applicable" default) · Requested Priority (select, required, default Medium) · Description (textarea, 6 rows, required, counter to 5000). Actions: **Create Ticket** (primary, orange) and **Cancel** (link back to `/tickets`).

States: *loading* (skeleton while reference data loads) · *empty* (no active categories → error state, submit disabled, message to contact the administrator) · *submitting* (button spinner + disabled, prevents double-submit) · *field errors* (server `fieldErrors` mapped onto the matching controls; **entered values preserved**) · *global error* (dismissible alert with Retry) · *success* (navigate to `/tickets/:id` with a success alert carrying the new ticket number).

Responsive: fields stack full-width below `md`; two-column pairing (Category | Related System, Priority | —) at `md+`.

### 5.2 My Tickets — `/tickets`

Page header "My Tickets" + primary "Create Ticket" button. Filter bar: Status (multi-select or a segmented control of chips) · Category (select) · Clear filters. Filter state lives in the URL query string so the view is shareable and survives refresh/back.

Desktop (`md+`): table with columns Ticket No · Summary · Category · Status · Requested Priority · Last Updated. Whole row is a link to detail (a real `<a>` wrapping the ticket number so keyboard and middle-click work — not an `onClick` on `<tr>`).
Mobile (`< md`): the table is replaced by stacked cards (ticket number + status badge on the top line, summary, then category/date meta). Do not ship a horizontally-scrolling table on phones.

States: loading skeleton rows · **two distinct empty states** (no tickets at all vs. no match for filters) · error with Retry · pagination footer showing "Showing 1–10 of 37" with prev/next, hidden when `totalPages === 1`.

### 5.3 Ticket Detail — `/tickets/:id`

Breadcrumb `My Tickets > Ticket Details` + "Back to My Tickets" button (mirrors the mockup layout, in KMUTT colours).

Header card, read-only fields in a Bootstrap grid, 4-up at `lg`, 2-up at `md`, 1-up on mobile — same field order as the mockup: Ticket No · Ticket Date · Category · Related System / Requester · Requested Priority · IT Priority · Current Status / Ticket Owner (or "Not yet assigned") · Summary / Description (full width) / Resolution Summary (full width, muted "No resolution summary available yet." when null). Read-only fields use the muted-surface, non-editable style demanded by Labsheet §1.4, visually distinct from editable inputs on Create Ticket.

Tabs (Bootstrap `nav-tabs`, keyboard-navigable, each with a count badge):
1. **Public Comments** — composer at top (textarea + "Post Comment", disabled while empty or posting), then the thread: avatar initials, author name, role badge, timestamp, body. Empty state "No comments yet."
2. **Attachments** — file input + Upload button with the constraints stated in visible text ("JPG, PNG, WEBP or PDF, up to 5 MB, maximum 5 files"), the count shown as "3 of 5 used", upload control disabled at 5. List rows: filename, size, uploader, date, Download, Delete (own only, with confirm dialog). Empty state "No attachments yet."
3. **Event Log** — reverse-chronological list of `summaryText` + actor + localized timestamp. Read-only.

States per tab: loading, empty, error with retry, and — after any mutation — a refetch of server state rather than optimistic local mutation (SDS: "the client does not assume a status change succeeded").

Access Denied (403) and Not Found (404) render as dedicated full-page views, not inline alerts.

---

## 6. Test plan

**Tooling decision.** Lab 1 used Vitest (client, `client/tests/lab-01/*.test.tsx`, jsdom + Testing Library) and Vitest+Supertest (server, `server/tests/lab-01/*.test.ts`). Lab 2 keeps both and **introduces Playwright**, because the W4 activity line says "full test suite (unit/API/UI/E2E)" and Lab 1's deferral of Playwright pointed at exactly this lab. New tests live under `server/tests/lab-02/`, `client/tests/lab-02/`, `tests/e2e/` (repo root, matching the SDS repository structure).

**Two harness fixes needed before writing tests** — both are current-repo defects that will bite immediately:
1. `client/vite.config.ts` has `include: ['tests/**/*.test.tsx']` — pure `.ts` unit tests would silently never run. Change to `['tests/**/*.test.{ts,tsx}']`.
2. Lab 1's server tests run against the developer's real database. Lab 2 tests write data. Add `server/.env.test` with a separate `DATABASE_URL` (`toktickit_test`), a global setup that runs `prisma migrate deploy` + seed against it, per-test truncation of the ticket-related tables, and **no file parallelism** (`poolOptions.forks.singleFork` or `--no-file-parallelism`) so concurrent suites cannot interleave on the shared counter row. Never point tests at the dev database.
3. Coverage tooling is not installed on either `package.json` yet (`@vitest/coverage-v8` absent from both client and server). The DoD below requires a recorded ≥80% number — install it in Issue 6 (server) and Issue 12 (client), not as an afterthought in Issue 16.

| Level | Tool | Scope |
|---|---|---|
| Unit | Vitest (server) | `formatTicketNo()` padding/year boundary; create-ticket request validator (boundaries: summary 4/5/150/151, description 9/10/5000/5001, blank-after-trim, unknown enum, inactive category); list-query parser (pageSize clamp to 50, negative page, unknown sort → error); attachment policy (extension/MIME/magic-byte agreement matrix, 5 MB boundary, 5-file limit); `TicketEvent` → `summaryText` mapper; DTO mappers assert `storageHash`/`passwordHash`/`storageKey` are absent from output. |
| Unit | Vitest (client) | Filter-state ⇄ URL query serialization; API error-envelope → `ApiError` mapping; date/locale formatting. |
| API | Vitest + Supertest | Every endpoint in §3.1, happy path + each documented error. **Mandatory security tests:** all 13 protected endpoints return 401 without identity; requester B gets 403 on requester A's ticket, comments, attachments, events, and download; `requesterId`/`itPriority`/`status` supplied in a create body are ignored, not honoured; **`GET /tickets?requesterId=<other-user-id>` is ignored server-side, not honoured as a scope override** (the specific IDOR §3.3 #5 warns about — an agent later "helpfully" wiring up that filter would pass every other test in this list); upload of a `.exe` renamed `.png` is rejected 422; the 6th attachment is rejected 409; a 6 MB file is rejected 413; a deleted attachment's download returns 410 and its `storageKey` never appears in any response body; **download response carries `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, and the stored (not client-supplied) mimeType**; **a non-uploader, including IT_STAFF/ADMINISTRATOR, gets 403 on `DELETE /attachments/:id` for someone else's upload** (proves the Lab-3 delete-with-reason path was not accidentally half-wired). **Concurrency test:** 10 parallel `POST /tickets` produce 10 distinct ticket numbers with no gaps or duplicates. **Transaction test:** a forced failure after ticket insert leaves no orphan ticket and no orphan event. |
| UI | Vitest + Testing Library | Create Ticket: required-field errors render and are associated with their inputs; input preserved after a server 422; submit disabled while in flight. My Tickets: loading → rows; the two empty states; error + retry; filter change refetches; pagination controls. Ticket Detail: header renders all Labsheet fields; tab switching; comment composer posts and clears; attachment list shows Delete only on own uploads; confirm dialog cancels without deleting. |
| E2E | Playwright | **J1 (primary):** create a ticket → land on Detail showing the ticket number → open My Tickets → the ticket is listed → filter by its status/category → still listed → open it → post a comment → it appears → upload a PNG → it appears in Attachments and in the Event Log → delete it → it disappears and a removal event appears. **J2 (authorization):** as requester B, navigate directly to requester A's `/tickets/:id` → Access Denied. **J3 (validation/responsive):** submit an empty Create Ticket form → field errors visible; render My Tickets at 375 px → card layout, no horizontal page scroll. |
| Migration | Prisma | Migrate from the Lab 1 baseline on a clean DB, then seed; assert the Lab 1 four categories survive with `code`/`isActive` backfilled. |

**Definition of Done for Lab 2** (W4 lecture theme): every FR in scope has ≥1 automated test; every mandatory business-rule test above passes; server and client coverage ≥80%; Lab 1's five tests still pass; `docs/lab-02/tests.md` records the test-ID → file → requirement mapping in the same table format Lab 1 used; passing terminal output captured for the submission.

---

## 7. GitHub issue / branch breakdown

**Branch base decision (open item 4) — RESOLVED 18 Aug, supersedes the original recommendation below.** `fix/pr9-review-checklist` was never merged and `origin` deleted the remote branch out from under it. In the meantime Lab 1 was finished and closed out through a different path: `docs/lab-01/{ai_use,reviewer,tests}.md` were completed directly on `lab1-staging` with real names/student IDs/review history, and that went in as PR#9 → `main` (merged). Checked file-by-file: our branch's three doc files are now a stale, unfilled draft — **do not merge them, they'd overwrite the real submitted version.** But two real code fixes from that branch never landed anywhere and still reproduce on current `main`:
1. `server/package.json`'s `start` script points at `dist/server.js`; given `tsconfig.json`'s `rootDir: "."` with source at `src/server.ts`, tsc actually emits `dist/src/server.js` — **`npm run start` is broken on `main` right now.**
2. `server/tests/lab-01/categories.test.ts` only asserts category names; the stronger version also asserts count and `id` type.

**Decision: no separate fix PR.** Cut `lab2-staging` from current `main` as planned, and fold both fixes into **Issue 6 (API v1 foundation)**'s acceptance criteria as a first-commit cleanup, since that issue already touches the server bootstrap:
- `server/package.json`: `"start": "node dist/server.js"` → `"start": "node dist/src/server.js"`.
- `server/tests/lab-01/categories.test.ts`: assert `response.body` has length 4 and each `category.id` is a number, in addition to the existing name-array assertion.

Delete the local `fix/pr9-review-checklist` branch once Issue 6 lands the fixes above — the remote copy is already gone, and the doc files it carried are superseded.

**Three more repo-state notes from the Opus review pass, all confirmed on disk:**
- **Do not add an Express root route (`GET /`).** `server/tests/lab-01/app.test.ts` asserts `GET /` returns 404; this plan uses "Lab 1's tests still pass" as regression proof throughout §7, so a root SPA-serving route (eventually needed for SDS D-08) would be a Lab-3-or-later change, not a Lab 2 one.
- **Local `main` is stale and on an unrelated history** (`9b193bc`, disconnected from `origin/main`'s real root). Harmless for GitHub PRs since those target `origin`, but fast-forward or reset local `main` to `origin/main` before Issue 17's final merge so the local branch isn't confusing to work from.
- **D-18's "Lab 3 replaces step 2 only, nothing else changes" claim has one exception.** `app.ts` currently uses bare `cors()`, which doesn't set `credentials`. That's fine for the header-based stub (the custom header still triggers a preflight that default `cors()` reflects), but Lab 3's cookie-based session will need `cors({ origin, credentials: true })`. Note this now so the D-18 claim stays accurate — CORS config is a Lab 3 touch-point.

**Issue-creation staging.** Given the real Lab 2 labsheet doesn't exist yet (§8 q1) and Lab 1's labsheet dictated exact issue counts and branch names, **create only Issues 5–8 on the GitHub Project board now; hold 9–17 until the Lab 2 labsheet is released** and re-check them against it. Renaming branches after PRs are already open is what damages the Kanban evidence trail the rubric grades.

**Staging branch:** `lab2-staging` (Lab 1 used `lab1-staging`). All feature PRs target `lab2-staging`; one PR merges `lab2-staging` → `main` at the end. Continue the Kanban columns Backlog → Specified → Started → PR Review → Fixing → Done. Feature-branch numbering continues from Lab 1's 1–4 to avoid name collisions with the existing branches.

### W3 — Lab 2-1 (contract, design, database, API contract)

| # | Issue | Branch | Acceptance criteria | PR target |
|---|---|---|---|---|
| 5 | Lab 2 specification set | `feature/5-lab2-specs` | `docs/lab-02/` contains: SRS v1.0 (FR-023/BR-006/BR-007 corrected per D-13; FR-016 resolved per D-17; FR-008b/BR-011b added per D-16; FR-024/FR-025 confirmed per D-15), Decision Register addendum D-13…D-20, five feature specs (B, C, D, E, F) using the twelve-section contract, `api-contract.md` (§3), `test-plan.md` (§6), and the requirements→feature→issue→test traceability matrix. No code. | `lab2-staging` |
| 6 | API v1 foundation and identity seam | `feature/6-api-v1-foundation` | `/api/v1` router mounted; Lab 1 `/api/health` + `/api/categories` still respond identically and their tests still pass; error-envelope middleware with correlation IDs; request validation helper; `resolveCurrentUser` per D-18 with the production guard and fail-fast env validation; `GET /api/v1/me` returns the seeded requester; every new route requires identity; `.env.example` updated. **Also fixes two carried-over Lab 1 bugs (§7 branch-decision note): `server/package.json` start script path, and strengthens `categories.test.ts`.** | `lab2-staging` |
| 7 | Data model increment, migration and seed | `feature/7-ticket-data-model` | Prisma schema per §2; one migration applies cleanly from the Lab 1 baseline; seed is idempotent and adds users, related systems, and category backfill without duplicating the four Lab 1 categories; migration test passes; `docs/lab-02/data-model.md` includes the ER diagram (lightweight UML, per the W3 lecture topic). | `lab2-staging` |
| 8 | Ticket creation API | `feature/8-ticket-creation-api` | `POST /api/v1/tickets` per §3; ticket-number service is transactional and passes the 10-parallel-creates test; `itPriority` copied server-side; `TICKET_CREATED` event written in the same transaction; validation returns 422 with `fieldErrors`; unit + API tests green. | `lab2-staging` |

### W4 — Lab 2-2 (screens, attachments, full test suite)

| # | Issue | Branch | Acceptance criteria | PR target |
|---|---|---|---|---|
| 9 | Ticket query API (list, detail, events) | `feature/9-ticket-query-api` | `GET /tickets` with status/category filter, whitelist sort, clamped pagination and the `meta` envelope; `GET /tickets/:id`; `GET /tickets/:id/events`; requester scoping enforced server-side; cross-requester 403 test green. | `lab2-staging` |
| 10 | Comments API | `feature/10-comments-api` | `GET`/`POST /tickets/:id/comments`; 1–2000 char validation; `authorId` forced to the caller; `COMMENT_ADDED` event in the same transaction; no edit/delete route exists; tests green. | `lab2-staging` |
| 11 | Attachments API and storage adapter | `feature/11-attachments-api` | Add `multer` (not yet a dependency); `StorageAdapter` interface + `LocalDiskStorage` (D-20b), driver chosen by env; upload/list/download/delete per §3.3; all attachment security tests green (including the non-uploader-403 and download-header cases in §6); storage keys absent from every response; compensating cleanup on transaction failure; upload directory git-ignored. | `lab2-staging` |
| 12 | UI foundation (theme, shell, router, shared components) | `feature/12-ui-foundation` | React Router installed with the §5.0 routes; KMUTT theme tokens applied (no green); AppShell with nav + profile from `/me`; shared state/badge/dialog/pagination/form components; typed API modules; Lab 1 Check System still reachable and its tests still pass; a component-states demo documented in `docs/lab-02/ui.md`. | `lab2-staging` |
| 13 | Create Ticket screen | `feature/13-create-ticket-screen` | §5.1 delivered with all listed states; server field errors mapped to controls with input preserved; double-submit prevented; success navigates to the new ticket; UI tests green; responsive at 375/768/1280. | `lab2-staging` |
| 14 | My Tickets screen | `feature/14-my-tickets-screen` | §5.2 delivered; filters reflected in the URL; both empty states distinct; pagination correct at boundaries; mobile card layout with no horizontal page scroll; UI tests green. *(Stretch, clearly labelled: free-text `q` filter per D-17 — only if everything else is done.)* | `lab2-staging` |
| 15 | Ticket Detail screen with tabs | `feature/15-ticket-detail-screen` | §5.3 delivered including Public Comments, Attachments and Event Log tabs, read-only field styling, Access Denied and Not Found views; mutations refetch server state; confirm dialog is focus-trapped; UI tests green. | `lab2-staging` |
| 16 | E2E suite, docs and Lab 2 submission evidence | `feature/16-e2e-and-docs` | Playwright installed and configured against the local stack with a dedicated test DB; J1/J2/J3 pass; `docs/lab-02/tests.md`, `ai_use.md`, `reviewer.md` complete; root `README.md` updated with the new setup, env vars and run/test commands; coverage ≥80% recorded; passing output captured. | `lab2-staging` |
| 17 | Release Lab 2 | — | `lab2-staging` → `main` PR, peer-reviewed, all Kanban cards in Done. | `main` |

**Dependency order.** 5 → 6 → 7 → 8. Then 9, 10, 11 may run in parallel (all depend only on 7 and the 6 foundation). 12 depends on 6; 13 depends on 8 + 12; 14 depends on 9 + 12; 15 depends on 9 + 10 + 11 + 12. 16 depends on 13, 14, 15. Only 17 touches `main`.

Thirteen issues is more than Lab 1's four, which matches Lab 2 being roughly four times the work. If the professor's (not-yet-issued) labsheet prescribes a specific issue count, collapse to that shape — the natural merges are 9+10 (query + comments) and 13+14 (the two simpler screens); do **not** merge 11 into anything, since attachments carry the most security surface and deserve their own review.

---

## 8. Open questions for the student

These cannot be resolved from the material provided. Everything above marked with a decision ID is a defensible recommendation, but these specific points are guesses until the official Lab 2 labsheet exists.

0. **(Highest priority, flagged by the Opus review pass) Are Public Comments really in Lab 2's scope, or is "communication" a later-lab feature?** See the grading-risk note under D-15 above. Confirm with the TA before Issue 10 (W4) starts — Issue 10 is kept severable from 9 and 11 specifically so this can be dropped late without disturbing the rest of the plan.
1. **The Lab 2 labsheet does not exist yet.** Everything about issue count, required branch names, the exact required repository structure for `lab-02`, the required minimum test list, and the submission format is inferred from Lab 1's pattern plus the lecture deck. Re-check the whole plan against the labsheet the moment it is released — particularly §7, since Lab 1's labsheet dictated exact branch names.
2. **Is authentication really Lab 3?** D-18 is my reading of "Lab 2 implements the Requester-facing Create Ticket, My Tickets, Ticket Detail, and Attachment functions" plus Lab 2's title. If the labsheet turns out to require Login and First Password Change in Lab 2, the identity stub is still the right seam — you add `Session`, Argon2id hashing, the two screens, and CSRF, and swap step 2 of `resolveCurrentUser`. Nothing designed above gets thrown away. Worth confirming with the TA early, because it's roughly two extra issues.
3. **D-20b (local disk instead of SeaweedFS for Lab 2)** contradicts a strict reading of approved D-06 and needs sign-off. Ask whether `weed mini` is expected to be running for Lab 2, or whether staging the driver is acceptable.
4. **Is `Related System` a reference table or free text?** Labsheet §1.1 says the Administrator manages "Categories and Related Systems", which implies a table; the mockup renders it as a plain box while Category has a dropdown chevron. I chose a table (D-16). Cheap to confirm.
5. **Attach-at-creation.** SRS FR-012 allows it; I deferred it to "after creation only". Confirm the labsheet doesn't require file selection on the Create Ticket form itself.
6. **"Zen Green theme UI"** appears verbatim in the W4 activity line while D-09 mandates KMUTT colours (D-19). I'm confident the green is template chrome, but since it's in the professor's own schedule table it's worth one clarifying question — a whole-theme rework in W4 would be expensive.
7. **Page size** (I used 10) and the exact My Tickets column set are not specified anywhere; Labsheet §1.2's header field list was my source for Ticket Detail, but the list view's columns are my choice.
8. **Peer reviewer for Lab 2** — Lab 1 required a named peer reviewer recorded in `docs/lab-01/reviewer.md`. Assume the same for Lab 2 and line the person up before W3 ends, since issues 5–8 all need PR review.
