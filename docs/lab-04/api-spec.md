# TokTickIT REST API Contract (Lab 4)

Extends `docs/lab-03/api-spec.md`. Conventions are unchanged: root `/api/v1`, JSON, camelCase,
ISO-8601 UTC timestamps, DTOs only (never a Prisma model), 201 create / 401 unauthenticated /
403 authorization / 404 missing-or-not-yours / 409 conflict / 422 validation. Every Lab 1-3 endpoint
keeps its documented shape; this document lists only what is new or changed.

**Error envelope** (unchanged, all non-2xx):
```json
{ "error": { "code": "TICKET_LOCKED", "message": "...", "fieldErrors": [], "correlationId": "..." } }
```

**Session cookie.** Every endpoint below requires the `ttk_session` cookie, exactly as in Lab 3.
The mandatory password-change gate (`PASSWORD_CHANGE_REQUIRED`) applies to all of them.

## 1. Endpoints

### 1.1 New in Lab 4

| # | Method & path | Role | Purpose | Success | Errors |
|---|---|---|---|---|---|
| 1 | `GET /api/v1/tickets/:id/actions` | Requester | Actions Taken on an owned Ticket, read only | 200 `ActionTakenDto[]` | 401, 404 `TICKET_NOT_ACCESSIBLE` |
| 2 | `GET /api/v1/staff/tickets/:id/actions` | IT Staff, Administrator | Actions Taken on any Ticket | 200 `ActionTakenDto[]` | 401, 403, 404 `TICKET_NOT_FOUND` |
| 3 | `POST /api/v1/staff/tickets/:id/actions` | IT Staff, Administrator | Record an Action Taken (requires `Idempotency-Key`) | **201** `ActionTakenDto`; **200** on a replay | 401, 403, 404 `TICKET_NOT_FOUND`, 409 `TICKET_LOCKED`, 422, 428 `PRECONDITION_REQUIRED` |
| 4 | `PATCH /api/v1/staff/tickets/:id/actions/:actionId` | IT Staff, Administrator | Edit an Action Taken (requires `If-Match`) | 200 `ActionTakenDto` | 401, 403, 404 `TICKET_NOT_FOUND` / `ACTION_NOT_FOUND`, 409 `TICKET_LOCKED` / `STALE_UPDATE`, 422, 428 `PRECONDITION_REQUIRED` |
| 5 | `GET /api/v1/dashboard` | Requester | Requester Dashboard metrics | 200 `RequesterDashboardDto` | 401, 403 |
| 6 | `GET /api/v1/staff/dashboard` | IT Staff, Administrator | IT Staff Dashboard metrics | 200 `StaffDashboardDto` | 401, 403 |

There is no delete endpoint for Action Taken. The Requester namespace has no write route at all, so
`POST` and `PATCH` under `/api/v1/tickets/:id/actions` return 404, not 403 or 405.

### 1.2 Changed in Lab 4

| Endpoint | Change |
|---|---|
| `PATCH /api/v1/staff/tickets/:id/status` | Honors an optional `If-Match` (409 `STALE_UPDATE`, section 4.4). New failure mode: **409 `RESOLUTION_REQUIRES_ACTION_TAKEN`** when the target status is `RESOLVED` and the Ticket has zero Action Taken records. |
| Every `/api/v1/staff/*` route | Role gate widened from `IT_STAFF` to `IT_STAFF` or `ADMINISTRATOR`, so an Administrator can reach the IT Staff Dashboard and perform every IT Staff action (specification.md §7). A `REQUESTER` still receives 403 `FORBIDDEN_ROLE`. No IT Staff behavior is removed. |

## 2. DTOs

### 2.1 `ActionTakenDto`

```json
{
  "id": "uuid",
  "ticketId": "uuid",
  "performedBy": { "id": "uuid", "displayName": "Somchai IT" },
  "lastEditedBy": { "id": "uuid", "displayName": "Malee IT" },
  "actionAt": "2026-09-22T09:30:00.000Z",
  "description": "Replaced the faulty network cable at desk 14.",
  "result": "RESOLVED",
  "followUpRequired": true,
  "followUpNote": "Check the link again on Monday.",
  "attachmentNotes": "Photo shared on the team LINE group.",
  "createdAt": "2026-09-22T09:41:12.000Z",
  "updatedAt": "2026-09-22T09:41:12.000Z"
}
```

- `lastEditedBy` is `null` until the record is edited once.
- `followUpNote` and `attachmentNotes` are `null` when empty.
- `result` is one of `RESOLVED`, `ESCALATED`, `NO_ACTION_NEEDED`, `PENDING_FOLLOW_UP`.
- The Requester endpoint (#1) returns the same fields as the staff endpoint (#2); Action Taken is
  not treated as IT-Staff-private (BR-11).
- Lists are ordered oldest first by `createdAt`, then `id` ascending, so ties on `createdAt` still give a deterministic order. Neither list endpoint is paginated; a Ticket is
  expected to carry a handful of records.

### 2.2 `RequesterDashboardDto`

```json
{
  "statusCounts": {
    "NEW": 0, "OPEN": 2, "IN_PROGRESS": 1, "WAITING_FOR_REQUESTER": 0,
    "RESOLVED": 3, "CLOSED": 4, "REOPENED": 0, "CANCELLED": 0
  },
  "recentTickets": [
    { "id": "uuid", "ticketNo": "TKT-2026-00123", "summary": "VPN drops every hour", "status": "OPEN", "updatedAt": "2026-09-22T09:30:00.000Z" }
  ]
}
```

### 2.3 `StaffDashboardDto`

```json
{
  "unassignedCount": 4,
  "ownedByMeCount": 7,
  "statusCounts": { "NEW": 4, "OPEN": 6, "IN_PROGRESS": 3, "WAITING_FOR_REQUESTER": 1, "RESOLVED": 2, "CLOSED": 9, "REOPENED": 0, "CANCELLED": 1 },
  "priorityCounts": { "LOW": 5, "MEDIUM": 9, "HIGH": 6, "URGENT": 2 },
  "recentTickets": [ { "id": "uuid", "ticketNo": "TKT-2026-00130", "summary": "Printer offline", "status": "NEW", "updatedAt": "2026-09-22T10:02:00.000Z" } ],
  "userCounts": { "REQUESTER": 12, "IT_STAFF": 3, "ADMINISTRATOR": 1 }
}
```

- `userCounts` is present **only** for an Administrator caller. For an IT Staff caller the field is
  absent entirely, not `null` (AC-11).
- Every key in `statusCounts` (all 8 statuses), `priorityCounts` (all 4 priorities) and `userCounts`
  (all 3 roles) is always present and zero-filled, never omitted (FR-10, AC-12).
- `recentTickets` holds at most 5 entries, newest `updatedAt` first (ties break on `id` descending); an empty array when there are
  none.

## 3. Request Bodies

### 3.1 `POST` and `PATCH` Action Taken (same validator, same body)

| Field | Type | Rule |
|---|---|---|
| `actionAt` | string, ISO 8601 | Required. Must parse. Must not be later than the current instant (BR-07); the current instant itself is accepted. |
| `description` | string | Required. Trimmed, 1 to 2000 characters. |
| `result` | string | Required. One of the four `ActionResult` values. |
| `followUpRequired` | boolean | Optional, defaults to `false`. Any non-boolean value is 422. |
| `followUpNote` | string | Required and non-empty (trimmed, up to 1000 characters) when `followUpRequired` is `true`. When `followUpRequired` is `false` the server stores `null` regardless of what the body contains (BR-05, AC-07). |
| `attachmentNotes` | string or null | Optional, trimmed, up to 500 characters. An empty string is stored as `null`. Creates no `Attachment` row (BR-06). |

`PATCH` is a full replacement of these six fields, not a partial update: the client always sends the
whole form. The body is never allowed to set `performedById`, `lastEditedById`, `ticketId`, or any
timestamp; such keys are ignored (FR-04, FR-05).

Failures list every invalid field in `fieldErrors` as `{ "field": "...", "message": "..." }` with
status 422 and code `VALIDATION_FAILED`.

## 4. Behavior and Ordering Rules

### 4.1 Creating and editing an Action Taken

1. Body is validated first (422).
2. The Ticket is looked up (404 `TICKET_NOT_FOUND`).
3. If the Ticket status is `CLOSED` or `CANCELLED`, the request is rejected with 409 `TICKET_LOCKED`
   (BR-08).
4. For `PATCH` only, the Action Taken must exist **and** belong to this Ticket, otherwise 404
   `ACTION_NOT_FOUND`.
5. In one database transaction: write the record and write a `TicketEvent` of type
   `ACTION_TAKEN_ADDED` (create) or `ACTION_TAKEN_UPDATED` (edit) with payload `{ "actionId": "..." }`.

On create, `performedById` is set from the session. On edit, `performedById` is never written;
only `lastEditedById` changes to the session user (BR-03, BR-04). Any IT Staff member or
Administrator may edit any record (BR-02).

Neither operation changes the parent Ticket's `updatedAt` (BR-14, D-06).

### 4.2 Status change to `RESOLVED`

`PATCH /api/v1/staff/tickets/:id/status` evaluates its checks in this fixed order:

1. Body validation (422).
2. Ticket exists (404).
3. Terminal-status lock and transition-matrix check (409 `INVALID_STATUS_TRANSITION` or the existing
   locked-ticket code). These keep returning their existing error unchanged.
4. **New:** if `status` is `RESOLVED`, count the Ticket's Action Taken records. Zero means 409
   `RESOLUTION_REQUIRES_ACTION_TAKEN`, message "Record at least one Action Taken before resolving this
   ticket", and the Ticket is unchanged.
5. Apply the change.

The count ignores each record's `result` value (D-02). A Ticket that was reopened and resolved again
passes on its earlier records. Transitions that do not target `RESOLVED` never run this check.

### 4.3 Dashboards

- Neither endpoint accepts a query parameter, user id, date range, or filter. Extra query strings are
  ignored (BR-12).
- `GET /dashboard` always scopes to the authenticated user as `requesterId`.
- `ownedByMeCount` always scopes to the authenticated user as `ownerId`. It counts every status,
  including `CLOSED` and `CANCELLED`, because FR-08 states no status qualifier for it.
- `unassignedCount` counts Tickets with `ownerId = null` and a status other than `CLOSED` or
  `CANCELLED` (AC-10).
- `statusCounts` and `priorityCounts` on the staff dashboard span all Requesters.
- Every metric is a database `count` or `groupBy`; none is derived by loading Tickets into application
  memory (BR-13).

### 4.4 Stale-write protection (`If-Match`)

Every `ActionTakenDto` and the staff Ticket detail response carry an `ETag` header whose value is the
record's `updatedAt` as a quoted ISO-8601 string, for example `"2026-09-22T09:41:12.000Z"`.

- `PATCH .../actions/:actionId` **requires** `If-Match`. Missing header: 428 `PRECONDITION_REQUIRED`.
  Value different from the stored `updatedAt`: 409 `STALE_UPDATE`, nothing written. The check and the
  write happen in one transaction as a conditional update (`updateMany` where `id` and `updatedAt`
  match; zero rows changed means stale), so two editors cannot both win.
- `PATCH .../status` **honors** `If-Match` against `Ticket.updatedAt` when sent (Lab 3 callers that
  omit it keep working, AC-13); the Lab 4 client always sends it. Mismatch: 409 `STALE_UPDATE`,
  Ticket unchanged. The existing transition-matrix check still runs on the current state.
- On `STALE_UPDATE` the client reloads the record and shows it to the user instead of overwriting.
- Creating an Action Taken needs no `If-Match`: it never overwrites existing state.

### 4.5 Replay-safe create (`Idempotency-Key`)

`POST .../actions` requires `Idempotency-Key`, a client-generated UUID created once per open form and
reused on every retry of that submission. Missing or malformed: 428 `PRECONDITION_REQUIRED`.

- Scope is `(ticketId, performedById, key)`, enforced by a unique constraint (specification.md
  section 9.1), so a duplicate that races the first request fails on the constraint and is resolved to
  the stored record rather than creating a second row.
- Same key and same body as the stored record: **200** with the stored `ActionTakenDto` and header
  `Idempotent-Replayed: true`; no new row and no new `TicketEvent`.
- Same key but a different body: 409 `IDEMPOTENCY_KEY_REUSED`, nothing written.
- A new form submission gets a new key, so two genuine records are never merged.

## 5. Authorization Summary

| Endpoint | Requester | IT Staff | Administrator |
|---|---|---|---|
| `GET /tickets/:id/actions` | own Tickets only (404 otherwise) | 403 | 403 |
| `GET/POST/PATCH /staff/tickets/:id/actions...` | 403 | allowed | allowed |
| `GET /dashboard` | allowed | 403 | 403 |
| `GET /staff/dashboard` | 403 | allowed, no `userCounts` | allowed, with `userCounts` |

The 403 for a wrong role is code `FORBIDDEN_ROLE`. The Requester-ownership failure is a 404 with the
same body as an unknown id, so the response never confirms that another user's Ticket exists (the
Lab 2 D-24 pattern).

## 6. Error Code Reference (new in Lab 4)

| Code | Status | When |
|---|---|---|
| `RESOLUTION_REQUIRES_ACTION_TAKEN` | 409 | Status change to `RESOLVED` on a Ticket with zero Action Taken records |
| `ACTION_NOT_FOUND` | 404 | `PATCH` on an action id that does not exist or belongs to another Ticket |
| `TICKET_LOCKED` | 409 | Create or edit an Action Taken on a `CLOSED` or `CANCELLED` Ticket |
| `STALE_UPDATE` | 409 | `If-Match` does not equal the stored `updatedAt` (section 4.4) |
| `IDEMPOTENCY_KEY_REUSED` | 409 | Known `Idempotency-Key` sent with a different body (section 4.5) |
| `PRECONDITION_REQUIRED` | 428 | Missing `If-Match` on an Action Taken `PATCH`, or missing or malformed `Idempotency-Key` on `POST` |

`TICKET_NOT_FOUND`, `TICKET_NOT_ACCESSIBLE`, `FORBIDDEN_ROLE`, `VALIDATION_FAILED`, and
`INVALID_STATUS_TRANSITION` are unchanged from Lab 2-3.

## 7. Client Contract Note

The client reads `error.code` from the envelope to branch on `RESOLUTION_REQUIRES_ACTION_TAKEN`; it
never pattern-matches the human-readable message, because a different 409 may legitimately mention
the words "action" or "resolve".
