# TokTickIT REST API Contract (Lab 3)

Extends `docs/lab-02/api-spec.md`. Conventions unchanged: root `/api/v1`, JSON except upload/
download, camelCase, ISO-8601 UTC, DTOs only (never a Prisma model), 201 create / 401
unauthenticated / 403 authorization / 404 missing-or-not-yours / 409 conflict / 422 validation.

**Error envelope** (unchanged from Lab 2, all non-2xx):
```json
{ "error": { "code": "INVALID_CREDENTIALS", "message": "…", "fieldErrors": [], "correlationId": "…" } }
```

**Pagination envelope** (unchanged from Lab 2, all collections):
```json
{ "data": [ … ], "meta": { "page": 1, "pageSize": 10, "total": 37, "totalPages": 4 } }
```

**Session cookie.** Every authenticated request carries the `ttk_session` cookie (httpOnly,
`SameSite=Lax`, `Secure` in production), set by `POST /auth/login` and cleared by
`POST /auth/logout`. Clients must call `fetch` with `credentials: 'include'` (server CORS is
configured with an explicit origin and `credentials: true` — a wildcard origin cannot be combined
with credentialed cookies). No endpoint in Lab 3 accepts an API key, bearer token, or
`x-dev-user-id` header; that header and its `/api/v1/dev/*` endpoints are removed entirely.

## 1. Endpoints

### 1.1 Authentication

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 1 | `POST /api/v1/auth/login` | Authenticate with email + password | 200 `LoginResponseDto`, sets `ttk_session` cookie | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_DEACTIVATED`, 422 |
| 2 | `POST /api/v1/auth/logout` | Invalidate the current session | 200 `{}`, clears `ttk_session` cookie | 401 |
| 3 | `GET /api/v1/me` | Current authenticated identity | 200 `MeDto` | 401 |
| 4 | `POST /api/v1/auth/change-password` | Change own password (used for the mandatory first-login flow) | 200 `MeDto` (with `mustChangePassword: false`) | 401, 422 |

Endpoints #2–#4 require a valid session; #1 does not (it creates one). Unlike every other
protected route, #3 and #4 remain reachable even while `mustChangePassword` is true — see §3's
`assertPasswordCurrent` note.

### 1.2 Requester (carried over from Lab 2, now session-authenticated)

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 5 | `GET /api/v1/categories` | Active categories for the form | 200 `CategoryDto[]` | 401 |
| 6 | `GET /api/v1/related-systems` | Active related systems | 200 `RelatedSystemDto[]` | 401 |
| 7 | `POST /api/v1/tickets` | Create a ticket | **201** `TicketDetailDto` | 401, 422 |
| 8 | `GET /api/v1/tickets` | My Tickets: filtered, searched, sorted, paged | 200 paged `TicketListItemDto` | 401, 422 |
| 9 | `GET /api/v1/tickets/:id` | Requester Ticket Detail | 200 `TicketDetailDto` | 401, 404 |
| 10 | `GET /api/v1/tickets/:id/attachments` | Attachments, active and removed | 200 `AttachmentDto[]` | 401, 404 |
| 11 | `POST /api/v1/tickets/:id/attachments` | Upload (multipart, field `file`) | **201** `AttachmentDto` | 401, 404, **409** limit, **413** too large, 422 type |
| 12 | `GET /api/v1/attachments/:id/content` | Authenticated download (active only) | 200 stream | 401, 404, **410** if removed |
| 13 | `DELETE /api/v1/attachments/:id` | Uploader soft-removes own attachment, reason required | **200** `AttachmentDto` (removed state) | 401, 403, 404, 409 (ticket Closed), 422 (missing/empty reason) |
| 14 | `GET /api/v1/tickets/:id/comments` | Public Comments on an owned ticket | 200 `CommentDto[]` | 401, 404 |
| 15 | `POST /api/v1/tickets/:id/comments` | Post a Public Comment (optionally flagged) | **201** `CommentDto` | 401, 404, 422 |

Endpoints #5–#13 are unchanged in shape from `docs/lab-02/api-spec.md` #2–#3, #6–#12; only the
identity source changed (session cookie, not `x-dev-user-id`). #14–#15 are new in Lab 3.

### 1.3 IT Staff

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 16 | `GET /api/v1/staff/tickets` | Ticket Queue: every ticket, searched, filtered, sorted, paged | 200 paged `StaffTicketListItemDto` | 401, 403, 422 |
| 17 | `GET /api/v1/staff/tickets/:id` | Staff Ticket Detail, any ticket | 200 `StaffTicketDetailDto` | 401, 403, 404 |
| 18 | `PATCH /api/v1/staff/tickets/:id/owner` | Claim (self) or reassign ownership | 200 `StaffTicketDetailDto` | 401, 403, 404, 409 (owner id not an active IT Staff/Administrator), 422 |
| 19 | `PATCH /api/v1/staff/tickets/:id/priority` | Set IT Priority | 200 `StaffTicketDetailDto` | 401, 403, 404, 409 (ticket Closed/Cancelled), 422 |
| 20 | `PATCH /api/v1/staff/tickets/:id/status` | Change status per the transition matrix | 200 `StaffTicketDetailDto` | 401, 403, 404, **409** `INVALID_STATUS_TRANSITION`, 422 |
| 21 | `GET /api/v1/staff/tickets/:id/comments` | Public Comments, any ticket | 200 `CommentDto[]` | 401, 403, 404 |
| 22 | `POST /api/v1/staff/tickets/:id/comments` | Post a Public Comment, any ticket | **201** `CommentDto` | 401, 403, 404, 422 |
| 23 | `GET /api/v1/staff/tickets/:id/notes` | Internal Notes, any ticket | 200 `InternalNoteDto[]` | 401, 403, 404 |
| 24 | `POST /api/v1/staff/tickets/:id/notes` | Write an Internal Note, any ticket | **201** `InternalNoteDto` | 401, 403, 404, 422 |
| 25 | `GET /api/v1/staff/tickets/:id/attachments` | Existing Attachments, read-only, any ticket | 200 `AttachmentDto[]` | 401, 403, 404 |
| 26 | `GET /api/v1/staff/assignable-owners` | Active IT Staff + Administrator users, for the ownership dropdown | 200 `UserSummaryDto[]` | 401, 403 |

Every endpoint in §1.3 requires role `IT_STAFF`; a `REQUESTER` or `ADMINISTRATOR` caller gets 403
`FORBIDDEN_ROLE` on all of them (§3's role-gate note) — there is no ownership-based 404 here,
because these routes are gated on role, not on Requester ownership.

### 1.4 Administrator

| # | Method & path | Purpose | Success | Errors |
|---|---|---|---|---|
| 27 | `GET /api/v1/admin/users` | List users, search by name/email, optional role filter | 200 `UserAdminDto[]` | 401, 403, 422 |
| 28 | `POST /api/v1/admin/users` | Create a user with one role and an initial password | **201** `UserAdminDto` | 401, 403, 409 (duplicate email), 422 |
| 29 | `PATCH /api/v1/admin/users/:id` | Edit name/email/role/activation state | 200 `UserAdminDto` | 401, 403, 404, 409 (duplicate email, self-deactivation, last-Administrator), 422 |
| 30 | `PATCH /api/v1/admin/users/:id/password` | Set a new initial password | 200 `UserAdminDto` | 401, 403, 404, 422 |

Every endpoint in §1.4 requires role `ADMINISTRATOR`; any other caller gets 403 `FORBIDDEN_ROLE`.

### 1.5 Removed from Lab 2

- `GET /api/v1/dev/requesters` and `POST /api/v1/dev/session` — the Development Requester selector
  is gone entirely; do not implement, do not re-add the `x-dev-user-id` header anywhere.

### 1.6 Unchanged

- `GET /api/health` — Lab 1 health endpoint, unchanged, no auth.
- `GET /api/categories` (no `/v1`) — Lab 1 endpoint, stays mounted, unchanged.

## 2. Request/Response DTOs

```ts
// #1 request/response
LoginRequest { email: string; password: string }
LoginResponseDto { id, email, displayName, role, mustChangePassword }

// #3 response (extends Lab 2's UserDto with role + mustChangePassword)
MeDto { id, email, displayName, role: 'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR', mustChangePassword: boolean }

// #4 request
ChangePasswordRequest {
  currentPassword: string
  newPassword: string        // must satisfy the password policy (specification.md §4.1)
  confirmNewPassword: string // must equal newPassword
}

// #7 request — unchanged shape from Lab 2
CreateTicketRequest {
  summary: string; description: string; categoryId: number
  relatedSystemId?: number; requestedPriority: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'
}

// #8/#16 query params
ListTicketsQuery {
  status?: string[]           // repeatable, validated against the 8-value TicketStatus enum
  categoryId?: number
  q?: string
  page?: number; pageSize?: number
  sort?: 'createdAt:desc' | 'createdAt:asc' | 'updatedAt:desc' | 'ticketNo:asc'
}
StaffListTicketsQuery = ListTicketsQuery + {
  itPriority?: 'LOW'|'MEDIUM'|'HIGH'|'URGENT'   // Queue-only filter, not on My Tickets
  ownerId?: string                              // 'unassigned' or a specific IT Staff/Administrator id
}

// Shared ticket shapes (unchanged fields from Lab 2, plus a widened status enum)
TicketListItemDto {
  id, ticketNo, summary, category: { id, name },
  status: 'NEW'|'OPEN'|'IN_PROGRESS'|'WAITING_FOR_REQUESTER'|'RESOLVED'|'CLOSED'|'REOPENED'|'CANCELLED',
  requestedPriority, itPriority, createdAt, updatedAt, attachmentCount
}
TicketDetailDto = TicketListItemDto + {
  description, relatedSystem: { id, name } | null,
  requester: { id, displayName },
  owner: { id, displayName } | null,
  resolutionSummary: string | null, version
}

// #16 response items — same shape as TicketListItemDto plus the owner, since the Queue must show it
StaffTicketListItemDto = TicketListItemDto + { owner: { id, displayName } | null }

// #17/#18/#19/#20 response — same shape as TicketDetailDto (staff sees everything a Requester sees)
StaffTicketDetailDto = TicketDetailDto

// #14/#15/#21/#22 — Public Comments
CommentDto { id, ticketId, body, author: { id, displayName }, createdAt }
CreateCommentRequest {
  body: string                        // required, 1..2000 chars after trim
  problemAppearsResolved?: boolean    // Requester-only flag; ignored (and rejected with 422 if sent) on the staff endpoint
}

// #23/#24 — Internal Notes
InternalNoteDto { id, ticketId, body, author: { id, displayName }, createdAt }
CreateInternalNoteRequest { body: string }   // required, 1..2000 chars after trim

// #18 request
UpdateOwnerRequest { ownerId: string }    // required, must be an active IT_STAFF or ADMINISTRATOR user id

// #19 request
UpdatePriorityRequest { itPriority: 'LOW'|'MEDIUM'|'HIGH'|'URGENT' }

// #20 request
UpdateStatusRequest {
  status: 'OPEN'|'IN_PROGRESS'|'WAITING_FOR_REQUESTER'|'RESOLVED'|'CLOSED'|'REOPENED'|'CANCELLED'
  // NEW is never a valid target value — it is only ever the ticket's starting status.
}

// #26 response
UserSummaryDto { id, displayName, role: 'IT_STAFF'|'ADMINISTRATOR' }

// #27/#28/#29/#30 — Administrator user management
UserAdminDto { id, displayName, email, role: 'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR', isActive, mustChangePassword, createdAt }

ListUsersQuery { q?: string; role?: 'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR' }   // q matches name/email, case-insensitive substring; no pagination in Lab 3 (specification.md exclusions)

CreateUserRequest {
  displayName: string          // required, 2..100 chars, trimmed
  email: string                // required, valid email format, unique case-insensitively
  role: 'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR'
  isActive: boolean
  initialPassword: string      // required, must satisfy the password policy
}

UpdateUserRequest {
  displayName: string; email: string
  role: 'REQUESTER'|'IT_STAFF'|'ADMINISTRATOR'; isActive: boolean
}

SetInitialPasswordRequest { newInitialPassword: string }   // must satisfy the password policy
```

## 3. Endpoint notes a coding agent will otherwise get wrong

**Session resolution (`resolveCurrentUser`, rewritten from Lab 2's dev-header version).** Reads the
`ttk_session` cookie, hashes it with SHA-256, looks up `Session` by `tokenHash`. If no row, or
`revokedAt` is set, or `expiresAt` has passed: 401 `UNAUTHENTICATED`. Otherwise loads the related
`User`; if `!user.isActive`: 401 `UNAUTHENTICATED` (the session existing is irrelevant once the
account itself is deactivated — BR-11). On success, sets `req.user = { id, email, displayName,
role, mustChangePassword }`. This middleware is mounted once, ahead of every `/api/v1/*` route
except `/auth/login` (which has no session yet) — the same "mount it once so a future route can't
forget it" pattern Lab 2 used for the dev header.

**`assertPasswordCurrent` gate.** A second middleware, mounted immediately after
`resolveCurrentUser` on every route except `/auth/login`, `/auth/logout`, `/auth/change-password`,
and `/me`: if `req.user.mustChangePassword` is true, respond 403 `PASSWORD_CHANGE_REQUIRED`
immediately. The client treats this code as "redirect to Change Password," distinct from a
role-mismatch 403.

**Role gate (`requireRole(...)`).** A small middleware factory mounted on the `/staff/*` and
`/admin/*` routers: `requireRole('IT_STAFF')` and `requireRole('ADMINISTRATOR')` respectively. On a
role mismatch, respond 403 `FORBIDDEN_ROLE` — never 404. This is deliberately different from the
Requester ownership 404 (D-24): a 403 here reveals nothing that a caller of the wrong role doesn't
already know (the route exists; they just can't use it), whereas Lab 2's 404 exists specifically to
avoid confirming *which ticket* exists to a caller who might otherwise have access.

**#1 login sequence.** Look up `User` by lowercased email. If not found, or `passwordHash` is
`null`, or `bcrypt.compare(password, passwordHash)` fails: 401 `INVALID_CREDENTIALS` — identical
message and status for all three cases (BR-06), never revealing which one occurred. If found and
the password matches but `!isActive`: 403 `ACCOUNT_DEACTIVATED` (BR-07) — this check runs *after*
password verification, not before, so a wrong password against a deactivated account still returns
the generic `INVALID_CREDENTIALS`, not a hint that the account exists and is merely deactivated.
On success: create a `Session` row (`tokenHash` = SHA-256 of a fresh random token, `expiresAt` =
now + 12h), set the `ttk_session` cookie to the raw token (never store the raw token), return
`LoginResponseDto`.

**#4 change-password sequence.** Verify `currentPassword` against the stored hash first (422
`INVALID_CURRENT_PASSWORD` if it fails — even while `mustChangePassword` is true, the *current*
temporary password still has to be supplied correctly). Then validate `newPassword` against the
password policy and that it equals `confirmNewPassword` (422 with field errors otherwise). On
success: hash and store the new password, set `mustChangePassword = false`, and leave the calling
session valid (do not force logout) — this is a deliberate UX choice so a first-time user doesn't
have to log in twice.

**#8 `GET /api/v1/tickets` (My Tickets) — unchanged from Lab 2 except identity source.** Still
scoped to `req.user.id` as `requesterId`, never a query parameter (BR-03 here, D-17/BR-13 in Lab 2).
The status enum values in the whitelist are now the 8 renamed/added values; `ASSIGNED` and
`PENDING_REQUESTER` are no longer valid `status[]` values anywhere in the API.

**#9/#10/#11/#12/#13/#14/#15 Requester ownership (unchanged pattern from Lab 2's #8 note).** A
ticket accessible only if `ticket.requesterId === req.user.id`, else 404, identical body for
"doesn't exist" and "exists but isn't yours." This still applies to the new comment endpoints
(#14/#15): a Requester cannot read or post comments on a ticket they don't own, and gets the same
404 as if it didn't exist.

**#15/#22 comment creation — the `problemAppearsResolved` flag (specification.md A-08).** On the
Requester endpoint (#15) only, if the request body includes `problemAppearsResolved: true`, the
server prepends the fixed literal `"[Requester marked: problem appears resolved] "` to the trimmed
`body` before saving — this prefix is never accepted from the client as literal text in `body`
itself (a client-submitted string that merely starts with the same text is stored as ordinary
comment text, not specially flagged, since the flag comes from the boolean field, not from string
matching). Ticket status is never touched by this endpoint. The staff endpoint (#22) rejects
`problemAppearsResolved` in the body with 422 if present — only a Requester can raise this flag.

**#16 Ticket Queue filters.** `ownerId=unassigned` filters to `ownerId IS NULL`; any other value
must be a real user id or the query is rejected 422 (never silently ignored — an IT Staff member
mistyping an id should see a validation error, not an empty-looking "no results" that could be
mistaken for the queue being genuinely empty). `itPriority` and `status` combine with `q` using AND
semantics, matching Lab 2's My Tickets convention.

**#18 ownership assignment and the NEW→OPEN side effect.** Validate `ownerId` is an existing,
active user whose role is `IT_STAFF` or `ADMINISTRATOR` (else 409 `INVALID_OWNER`). If the ticket's
current status is `NEW`, this request also sets `status = 'OPEN'` in the same database transaction
(BR-15) — this is the *only* code path that ever moves a ticket out of `NEW`. If the ticket already
has any other status, this endpoint changes only `ownerId`, never `status`.

**#20 status transitions.** Validated against the table in `specification.md` §4.4 as an in-memory
map keyed by current status, not a giant `if/else` chain — e.g. `TRANSITIONS['OPEN'] =
['IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'CANCELLED']`. A target not present in the current status's
allowed list is rejected 409 `INVALID_STATUS_TRANSITION`, including any attempt to set `status:
'NEW'` explicitly (never a valid target) or `status: 'OPEN'` on a ticket that is still `NEW` and
unowned (must go through #18 first, per BR-15).

**#19/#20 terminal-state lock.** Before applying either an IT Priority or a status change, check
`ticket.status` is not `CANCELLED`, and if it's `CLOSED`, only allow the status endpoint with
`status: 'REOPENED'` — every other combination on a `CLOSED`/`CANCELLED` ticket is rejected 409
`TICKET_LOCKED`.

**#28 user creation.** `email` normalized to lowercase before the uniqueness check and the insert.
`initialPassword` validated against the password policy, then bcrypt-hashed; `mustChangePassword`
is always set to `true` on the created row regardless of any client-supplied value (BR-25 — there
is no request field for it at all, precisely so a client cannot opt out of the forced change).

**#29 edit safety rules, checked in this order:** (1) if `email` changed, re-check uniqueness
case-insensitively against every *other* user (409 `EMAIL_ALREADY_EXISTS`); (2) if `isActive` is
being set to `false` and `id === req.user.id`, reject (409 `SELF_DEACTIVATION_BLOCKED` — BR-27);
(3) if the edit would either set `isActive: false` on the last remaining active `ADMINISTRATOR`, or
change that same user's `role` away from `ADMINISTRATOR`, reject (409 `LAST_ADMIN_PROTECTED` —
BR-28), determined by counting active Administrators excluding the row being edited's *current*
state, inside the same transaction as the update to avoid a race between the count and the write.

**#30 password reset side effect.** Sets a new bcrypt hash, `mustChangePassword = true`, and — in
the same transaction — deletes (or sets `revokedAt` on) every existing `Session` row for that
`userId` (BR-26), so a session opened under the old password stops working immediately.

**Cookie/CORS wiring.** `server/src/app.ts`'s `cors()` call must be changed from the current
no-argument (wildcard) form to `cors({ origin: CLIENT_ORIGIN, credentials: true })`, and every
client `fetch` call in `client/src/api.ts` (and any new API module) must pass `credentials:
'include'`, or the browser will never attach or accept the `ttk_session` cookie across the
`:5173`↔`:4000` dev-port boundary.
