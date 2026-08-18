# TokTickIT REST API Contract (Lab 2)

Copied verbatim from §3 of `TokTickIT-Lab2-Implementation-Plan-v0.1.md`, with one addition
annotated inline: endpoint #14 is flagged **not implemented in Issues 5-8** (see the note under
the endpoint table).

Conventions per SDS: root `/api/v1`, JSON except upload/download, camelCase, ISO-8601 UTC, DTOs
only (never a Prisma model), 201 create / 401 auth / 403 authz / 404 missing / 409 conflict /
422 validation.

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

**Endpoint #14 note (not otherwise stated elsewhere in this plan): not implemented in Issues
5-8.** Per D-20a, Lab 1's existing `GET /api/health` (no `/v1`) stays mounted unchanged and is
the only health endpoint W3 ships — no `/api/v1/health` alias is added in this plan.

Lab 1 aliases `GET /api/health` and `GET /api/categories` stay mounted, unchanged, returning
exactly what they return today.

## 2. Request/response DTOs

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

## 3. Endpoint notes a coding agent will otherwise get wrong

**#5 `GET /api/v1/tickets`** — query params: `status` (repeatable, validated against the enum),
`categoryId`, `page` (default 1, min 1), `pageSize` (default 10, **clamped to max 50**), `sort`
(whitelist only: `createdAt:desc` default, `createdAt:asc`, `updatedAt:desc`, `ticketNo:asc`).
Unknown `sort` → 422, never a raw string into `orderBy`. **The requester filter is not a query
parameter** — the server always scopes to `req.user.id` for a REQUESTER. Do not add
`?requesterId=`; that would be an IDOR handed to the client.

**#6 access rule** — a REQUESTER may read a ticket only if `ticket.requesterId === req.user.id`,
else **403** (not 404). IT_STAFF/ADMINISTRATOR may read all — implement the role branch now even
though no IT Staff screen exists, because the rule is cheap and the test proves FR-007.

**#10 upload validation order** (fail before touching storage): authorize → ticket exists and
accessible → active attachment count < 5 (else 409 `ATTACHMENT_LIMIT_REACHED`) → declared size
≤ 5 MB, enforced by the multer limit so an oversized body is rejected during streaming, not
after buffering (else 413) → extension ∈ {jpg, jpeg, png, webp, pdf} **and** declared MIME ∈
{image/jpeg, image/png, image/webp, application/pdf} **and** magic-byte sniff of the first
bytes agrees with both (else 422 `ATTACHMENT_TYPE_REJECTED`). Only then write to storage under a
generated key, then insert metadata + `ATTACHMENT_ADDED` event in one transaction. If the
transaction fails, delete the just-written object (compensating cleanup, per SDS).

**#11 download headers** — `Content-Disposition: attachment; filename="<sanitized original>"`,
`X-Content-Type-Options: nosniff`, and serve the **stored** mimeType, never a client-supplied
one. Never redirect to a storage URL.

**`downloadUrl` composition (fixes a real bug, not a style choice).** `client/src/api.ts` calls
an absolute `API_BASE_URL` (`http://localhost:4000` in dev) and `client/vite.config.ts` has no
`server.proxy`, so a root-relative `downloadUrl` (`/api/v1/...`) resolves against the Vite dev
origin (`:5173`), not the API, and 404s. The DTO must return the full absolute URL built from
the same `API_BASE_URL` the client already uses, or the API layer must compose it client-side
from an `id` alone — pick one in Issue 6, not during W4 E2E debugging.

**#12** — Lab 2 permits deletion only by the uploader (`attachment.uploadedById ===
req.user.id`) while `ticket.status !== 'CLOSED'`. The IT-Staff "delete another user's
attachment with reason" path is Lab 3; return 403 for it now rather than half-implementing it.
Delete = set `deletedAt`/`deletedById`, write `ATTACHMENT_REMOVED` in the same transaction, then
delete the binary; if the binary delete fails, log with correlation ID and leave it queued —
never restore visibility.

**#4 transaction** — ticket number + ticket insert + `TICKET_CREATED` event, all in one
`prisma.$transaction`. `itPriority` is set equal to `requestedPriority` server-side and is
**not** accepted from the request body (FR-011 + BR-009).
