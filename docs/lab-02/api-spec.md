# TokTickIT REST API Contract (Lab 2)

Corrected 2026-08-21 (PR #14 review). Conventions per the SDS (`references/TokTickIT-System-Level-SDS-v1.0.md`):
root `/api/v1`, JSON except upload/download, camelCase, ISO-8601 UTC, DTOs only (never a Prisma
model), 201 create / 401 auth / 403 authz / 404 missing / 409 conflict / 422 validation.

**Error envelope** (all non-2xx):
```json
{ "error": { "code": "TICKET_NOT_ACCESSIBLE", "message": "…", "fieldErrors": [], "correlationId": "…" } }
```

**Pagination envelope** (all collections):
```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 10, "total": 37, "totalPages": 4 } }
```

## 1. Endpoints

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 1 | `GET /api/v1/me` | Current identity for the header | 200 `UserDto` | 401 |
| 2 | `GET /api/v1/categories` | Active categories for the form | 200 `CategoryDto[]` | 401 |
| 3 | `GET /api/v1/related-systems` | Active related systems | 200 `RelatedSystemDto[]` | 401 |
| 4 | `GET /api/v1/dev/requesters` | Seeded active Requesters, for the picker (D-18) | 200 `UserDto[]` | — (no auth required — bootstraps identity itself) |
| 5 | `POST /api/v1/dev/session` | Select the active dev-testing Requester (D-18) | 200 `UserDto` | 404 unknown/inactive id, 422 |
| 6 | `POST /api/v1/tickets` | Create a ticket | **201** `TicketDetailDto` | 401, 422 |
| 7 | `GET /api/v1/tickets` | My Tickets: filtered, searched, sorted, paged | 200 paged `TicketListItemDto` | 401, 422 |
| 8 | `GET /api/v1/tickets/:id` | Ticket Detail | 200 `TicketDetailDto` | 401, 403, 404 |
| 9 | `GET /api/v1/tickets/:id/attachments` | Attachments, active and removed | 200 `AttachmentDto[]` | 401, 403, 404 |
| 10 | `POST /api/v1/tickets/:id/attachments` | Upload (multipart, field `file`) | **201** `AttachmentDto` | 401, 403, 404, **409** limit, **413** too large, 422 type |
| 11 | `GET /api/v1/attachments/:id/content` | Authenticated download (active only) | 200 stream | 401, 403, 404, **410** if removed |
| 12 | `DELETE /api/v1/attachments/:id` | Uploader soft-removes own attachment, reason required | **200** `AttachmentDto` (removed state) | 401, 403, 404, 409 (ticket Closed), 422 (missing/empty reason) |
| 13 | `GET /api/v1/tickets/:id/events` | Event Log tab (newest→oldest) | 200 paged `TicketEventDto` | 401, 403, 404 |
| 14 | `GET /api/health` | Lab 1 health endpoint, unchanged alias | 200 | — |

Endpoint #14 stays exactly as Lab 1 shipped it (no `/api/v1/health` alias is added in Lab 2, per
D-20a). Lab 1's `GET /api/categories` (no `/v1`) also stays mounted, unchanged.

**Endpoints removed from the earlier (incorrect) draft of this contract, per D-15:**
`GET/POST /api/v1/tickets/:id/comments` — Public Comments are out of Lab 2 scope. Do not
implement, do not add a `CommentDto`.

**Endpoint #12 changed from the earlier draft:** was a hard `DELETE` returning 204 with no body
and no reason; is now a soft removal requiring a `reason` field in the request body and returning
the updated (removed-state) `AttachmentDto`, per the FR-028/BR-013 required-reason soft-removal
correction — see §3 below for the full validation sequence.

## 2. Request/response DTOs

```ts
// #6 request
CreateTicketRequest {
  summary: string           // required, 5..150, trimmed
  description: string       // required, 10..5000, trimmed
  categoryId: number        // required, must be an ACTIVE category
  relatedSystemId?: number  // optional, must be ACTIVE if present
  requestedPriority: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'   // required
}

// #7 query params
ListTicketsQuery {
  status?: string[]         // repeatable, validated against the Ticket status enum
  categoryId?: number
  q?: string                 // free-text search, 1..100 chars after trim (BR-019/D-17); omitted or blank = no search
  page?: number               // default 1, min 1
  pageSize?: number           // default 10, clamped to max 50
  sort?: 'createdAt:desc' | 'createdAt:asc' | 'updatedAt:desc' | 'ticketNo:asc'   // whitelist only; default createdAt:desc
}

TicketListItemDto {
  id, ticketNo, summary,
  category: { id, name },
  status, requestedPriority, itPriority,
  createdAt, updatedAt,
  attachmentCount   // active (non-removed) attachments only
}

TicketDetailDto = TicketListItemDto + {
  description,
  relatedSystem: { id, name } | null,
  requester: { id, displayName },
  owner: { id, displayName } | null,      // always null in Lab 2
  resolutionSummary: string | null,       // always null in Lab 2
  version
}

// #10 response / #9 list items
AttachmentDto {
  id, originalFilename, mimeType, sizeBytes, createdAt,
  uploadedBy: { id, displayName },
  status: 'ACTIVE' | 'REMOVED',
  downloadUrl: string | null,             // absolute URL when ACTIVE, null when REMOVED
  removal: {                              // present only when status === 'REMOVED'
    reason: string, removedAt: string, removedBy: { id, displayName }
  } | null
}
// storageKey never appears in any DTO.

// #12 request
RemoveAttachmentRequest { reason: string }   // required, 1..200 chars, trimmed

TicketEventDto  { id, eventType, createdAt, actor: { id, displayName }, summaryText }
UserDto         { id, email, displayName, role }
```

## 3. Endpoint notes a coding agent will otherwise get wrong

**#7 `GET /api/v1/tickets`** — the requester scope is never a query parameter: the server always
scopes to `req.user.id` for a REQUESTER (D-13/BR-019). Do not add `?requesterId=`; that is an
IDOR handed to the client. `q` matches `ticketNo` and `summary` (case-insensitive `contains`,
Prisma-parameterized — never build raw SQL from `q`), combined with `status`/`categoryId` using
AND semantics, and applies on top of the same ownership scope. `q` over 100 characters after trim
→ 422; blank/whitespace-only `q` behaves as if omitted (no search). `pageSize` clamps silently to
50 rather than erroring. Unknown `sort` → 422, never a raw string into `orderBy`.

**#8 access rule** — a REQUESTER may read a ticket only if `ticket.requesterId === req.user.id`,
else **403** (not 404, to avoid confirming existence to a scanning client — actually 403 vs 404
is a deliberate choice: SDS convention here is 403 for "exists but not yours," matching the error
table above). IT_STAFF/ADMINISTRATOR may read all — implemented now even with no IT Staff screen,
because the rule is cheap and proves FR-007/D-13.

**#4/#5 dev-selector endpoints (D-18)** — `GET /dev/requesters` requires no identity (it exists
to bootstrap identity) and returns only `isActive = true` Requesters. `POST /dev/session` takes
`{ userId }`, 404s on an unknown or inactive id (never silently substitutes a default), and on
success the client stores `userId` and sends it as `x-dev-user-id` on every subsequent request.
`resolveCurrentUser` validates that header against the active-Requester list **on every request**,
not only at selection time — a since-deactivated id gets 401, which the client treats as "return
to picker," never a silent fallback to some other identity. These two endpoints, and the header
they enable, are explicitly not an authentication mechanism (NFR-002) — Lab 3 replaces them with
real session-based login without changing any other endpoint's contract.

**#10 upload validation order** (fail before touching storage): authorize → ticket exists and
accessible → active attachment count < 5 (else 409 `ATTACHMENT_LIMIT_REACHED`; removed
attachments do not count) → declared size ≤ 5 MB, enforced by the multer limit so an oversized
body is rejected during streaming, not after buffering (else 413) → extension ∈
{jpg, jpeg, png, webp, pdf} **and** declared MIME ∈ {image/jpeg, image/png, image/webp,
application/pdf} **and** magic-byte sniff of the first bytes agrees with both (else 422
`ATTACHMENT_TYPE_REJECTED`). Only then write to storage under a generated key, then insert
metadata + `ATTACHMENT_ADDED` event in one transaction. If the transaction fails, delete the
just-written object (compensating cleanup, per SDS) — and if this upload was part of the Create
Ticket flow (FR-012), the already-created ticket is untouched either way.

**#11 download headers** — `Content-Disposition: attachment; filename="<sanitized original>"`,
`X-Content-Type-Options: nosniff`, and serve the **stored** mimeType, never a client-supplied
one. Never redirect to a storage URL. A removed attachment returns 410, and its `storageKey`
never appears in any response body at any point (active or removed).

**`downloadUrl` composition (fixes a real bug, not a style choice).** `client/src/api.ts` calls
an absolute `API_BASE_URL` (`http://localhost:4000` in dev) and `client/vite.config.ts` has no
`server.proxy`, so a root-relative `downloadUrl` (`/api/v1/...`) resolves against the Vite dev
origin (`:5173`), not the API, and 404s. The DTO must return the full absolute URL built from the
same `API_BASE_URL` the client already uses, or the API layer must compose it client-side from an
`id` alone — pick one in the ticket-and-attachment-endpoints issue, not during E2E debugging.

**#12 soft removal, corrected** — Lab 2 permits removal only by the uploader
(`attachment.uploadedById === req.user.id`) while `ticket.status !== 'CLOSED'`. The request body
must include a non-empty `reason` (1..200 chars, trimmed) — missing or empty reason is 422, not
a silently-defaulted value. The IT-Staff "remove another user's attachment with reason" path is
Lab 3; return 403 for it now rather than half-implementing it. Removal sets `deletedAt` /
`deletedById` / `deletedReason`, writes `ATTACHMENT_REMOVED` in the same transaction, then deletes
the binary from storage; if the binary delete fails, log with correlation ID and leave it queued
for retry — never restore visibility, and never re-attempt exposing the old `storageKey`. The
response returns the updated `AttachmentDto` in its `REMOVED` state (not a bare 204) so the client
can render the now-visible-but-blocked metadata without a second fetch.

**#6 transaction** — ticket number + ticket insert + `TICKET_CREATED` event, all in one
`prisma.$transaction`. `itPriority` is set equal to `requestedPriority` server-side and is
**not** accepted from the request body (FR-011 + BR-009). Attachment uploads triggered by
Create Ticket (FR-012) happen as separate, subsequent requests against the new ticket id — they
are not part of this transaction, by design, so a later upload failure cannot roll back the
ticket.
