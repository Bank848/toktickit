# TokTickIT — Lab 2 UI Specification

Corrected 2026-08-21 (PR #14 review, D-19). Implements the labsheet's mandatory Zen Green design
tokens and responsive presentation rules. Extends the SDS System-Wide UI Standards
(`references/TokTickIT-System-Level-SDS-v1.0.md`) — shared component treatment, form labelling,
focus visibility, WCAG 2.2 AA target — with Lab 2's concrete tokens and screens.

## 1. Zen Green Design Tokens

Corrected 2026-08-21 (second review pass): the labsheet does publish exact Zen Green values.
This table uses those published values in place of the earlier invented palette.

| Token | Value | Use | Contrast note |
|---|---|---|---|
| Zen Green Primary | `#006B3C` | App header/nav background (white text/icons), primary buttons | White text on `#006B3C` ≈ 6.6:1 (AA) |
| Zen Green Secondary | `#0B7A46` | Secondary actions, active nav indicator, focus ring, link emphasis on light backgrounds | On page background ≈ 5.4:1 (AA) |
| Zen Green Pale | `#EAF6EF` | Hover/selected row background, info banners, badge tints | Paired only with the Text token below — high contrast |
| Page background | `#F5F7F6` | Application background (replaces plain white) | Text on it ≈ 15:1 |
| Text | `#1F2937` | Primary text | On page background ≈ 15:1 |
| Muted | `#5B6573` | Secondary labels, metadata, timestamps | On page background ≈ 5.1:1 (AA) |
| Border/icon | `#7A8B80` | Borders, dividers, non-text decorative icons | Non-text; no AA text requirement |
| Success | `#1E7D34` | Completed/success state, always with text/icon (not a status color alone) | On page background ≈ 4.6:1 (AA) |
| Warning | `#8A6D1B` | Warning surfaces, always with text/icon | On page background ≈ 5.0:1 (AA); paired with a light `#FFF6DA` surface |
| Danger | `#B3261E` | Destructive/error state, always with text/icon | On page background ≈ 6.0:1 (AA) |

Status and priority badges use text + an icon, never color alone (SDS System-Wide UI Standards).
Badge background tints use Zen Green Pale or the neutral/warning/danger surfaces above with the
corresponding dark text color, not raw Primary/Secondary (those are reserved for header/
primary-action chrome so the palette does not read as "everything is a button").

**Verification checklist (screenshot/computed-style check, per review request):** app header and
primary buttons render `#006B3C`; secondary actions, the active nav indicator, and the visible
focus ring render `#0B7A46`; hover/selected rows and info banners render `#EAF6EF`; the page
background (`<body>`/app shell, not individual cards) renders `#F5F7F6`. See `tests.md` for the
test that asserts these computed values.

## 2. Global Layout

- App header (Zen Green Primary background, white text): product name "TokTickIT" (left), primary
  nav — My Tickets, Create Ticket (center/left-aligned per Bootstrap navbar), and the
  **selected-requester display + "Change Requester" control** (right, see §3).
- Content area: Bootstrap container, responsive grid, system font stack, Bootstrap spacing scale.
- Shared components (per SDS): one treatment each for forms, buttons, tables, badges,
  confirmation dialogs, loading/empty/error states, used identically across Create Ticket, My
  Tickets, and Ticket Detail.

## 3. Development Requester Selection (D-18)

**Route:** `/dev/select-requester` (also the fallback the app redirects to whenever no valid
requester is currently selected).

**Purpose banner** (always visible on this screen, Zen Green Pale surface, dark text, an info
icon — not color alone): *"Development Requester Selection — this stands in for sign-in in
Lab 2. Lab 3 replaces it with real authentication."*

**Body:** a list of seeded active Requesters, each row showing display name and email, fetched
from `GET /api/v1/dev/requesters`. Selecting a row (click or Enter/Space when focused — full
keyboard support) calls `POST /api/v1/dev/session` with the selected user id and, on success,
navigates to My Tickets.

**States:** loading (skeleton rows), empty (no active Requesters seeded — an error state with
guidance, not a silent blank list, since the app is unusable without at least one), error with
retry (the fetch itself failed).

**Header integration:** once a requester is selected, the app header shows "Testing as: `<display
name>`" and a "Change Requester" button. Activating it clears the stored selection
(`sessionStorage`, not a cookie) and navigates to `/dev/select-requester`. Any in-flight or cached
requester-scoped data (My Tickets list, an open Ticket Detail) is discarded on switch — the next
screen always re-fetches fresh, scoped to the newly selected requester. This is asserted directly
in E2E (see `tests.md`).

## 4. Create Ticket

**Route:** `/tickets/new`.

Single-column card. Fields, in order:

1. **Summary** — text input, required, live character counter to 150.
2. **Category** — select, required, active categories only, placeholder "Select a category".
3. **Related System** — select, optional, "Not applicable" default, active related systems only.
4. **Requested Priority** — select, required, default Medium.
5. **Description** — textarea, 6 rows, required, character counter to 5000.
6. **Attachments** — file picker (multi-select), accepting `.jpg .jpeg .png .webp .pdf`, client-
   side pre-check of extension and size (advisory only — server re-validates everything, per
   `api-spec.md`). Staged files are listed with a remove-before-submit control; nothing uploads
   until the ticket itself is created.

**Actions:** Create Ticket (primary, Zen Green Primary) and Cancel (link back to My Tickets).

**Submit sequence (FR-012):** `POST /tickets` first; on success, for each staged file, upload via
`POST /tickets/:id/attachments` in sequence; navigate to the new Ticket Detail regardless of
individual upload outcomes, with a per-file success/failure summary shown as a dismissible alert
on Ticket Detail if any upload failed ("2 of 3 files attached. 1 failed: invoice.exe — file type
not allowed. Retry from Attachments below."). The ticket itself is never rolled back or hidden
because an attachment upload failed.

**States:** loading (initial categories/related-systems fetch), empty (no active categories —
form disabled with guidance, since a ticket cannot be created without one), submitting
(double-submit disabled, spinner on the button), field errors (validation messages associated
with their inputs via `aria-describedby`, all entered input preserved, first invalid field
receives focus), global error with retry (network/server failure on submit), success (navigate to
Detail with a success alert carrying the new ticket number).

## 5. My Tickets

**Route:** `/tickets`.

**Filter bar** (above the table/cards): search input (placeholder "Search by ticket number or
summary"), status multi-select, category select, all combined with AND semantics (D-17/BR-019).
Changing any filter or the search box (debounced ~300 ms) refetches and resets to page 1.

**Desktop (≥ `md`, 768 px):** table — columns Ticket No., Summary, Category, Status, Last
Updated. Status shown as a text+icon badge, never color alone.

**Mobile (< `md`):** the same rows render as stacked cards (label: value pairs), per the SDS
"card layout" responsive requirement — never a horizontally scrolling table.

**Row selection:** clicking a row/card navigates to that ticket's Detail (FR-018).

**Pagination:** page-size-aware controls below the list, standard Bootstrap pagination component.

**States:** loading (skeleton rows/cards), two distinct empty states — "You haven't created any
tickets yet" (no filters/search active, zero total tickets) versus "No tickets match your
filters" (filters/search active, zero results) with a "Clear filters" action on the latter, error
with retry.

## 6. Ticket Detail

**Route:** `/tickets/:id`.

**Header block:** ticket number, date, category, requester, owner ("Unassigned" — always, in
Lab 2), Requested Priority badge, IT Priority badge, current status badge, description,
resolution summary ("No resolution yet" — always, in Lab 2).

**Attachments section** (corrected 2026-08-21: no tab chrome, no Service Actions placeholder, no
Event Log — Lab 2 Ticket Detail is read-only fields plus the attachment lifecycle only, per
review). Renders directly below the header block: upload control (constraints stated in visible
text: "JPG, PNG, WEBP or PDF, up to 5 MB, maximum 5 files", count shown as "3 of 5 used",
disabled at 5 active). List rows: filename, size, uploader, upload date, Download (active
attachments only), Remove (own uploads only, while ticket is not Closed). **Removed attachments
remain in the list**, visually de-emphasized (muted text, a "Removed" badge with icon), showing
filename, uploader, original upload date, removal reason, remover, and removal date —
Download/preview is replaced with a disabled control (never a working link to the deleted
binary). Removing an attachment opens a confirmation dialog requiring a reason (required text
field, 1..200 characters, submit disabled until non-empty) before the request is sent. Empty
state (zero attachments ever, not even removed ones): "No attachments yet."

**Not part of Lab 2 (removed 2026-08-21):** a Service Actions tab/placeholder and an Event Log
tab. `TICKET_CREATED`/`ATTACHMENT_ADDED`/`ATTACHMENT_REMOVED` events are still written for audit
continuity (BR-015/NFR-004) but are not read back or displayed anywhere in Lab 2 — no events
endpoint, no Event Log UI. Public Comments remain out of scope per D-15.

**States:** loading, not-found/not-accessible (403 — a generic "You don't have access to this
ticket" message, never revealing whether the ticket exists), error with retry.

## 7. Responsive Rules (D-19/NFR-009)

- Bootstrap breakpoints (`xs < 576px`, `sm ≥ 576`, `md ≥ 768`, `lg ≥ 992`, `xl ≥ 1200`) apply
  everywhere; no custom breakpoints without a documented reason.
- No screen produces horizontal page scroll at any breakpoint from 320 px upward — verified in
  E2E at 375 px (see `tests.md` J3).
- My Tickets switches table → card layout at the `md` breakpoint (§5).
- Touch targets (buttons, row taps, form controls) are at least 44×44 CSS px on `xs`/`sm`.

## 8. Accessibility (WCAG 2.2 AA)

- Every form control has a programmatic label; validation messages are associated with their
  field via `aria-describedby` and announced to assistive tech on submit failure.
- Keyboard focus is visible (a Zen Green Secondary focus ring, never suppressed) and follows a logical
  tab order; the confirmation dialog (attachment removal) traps focus and returns it to the
  control that opened it on close.
- Status/priority/removed-attachment states communicate via text and icon, never color alone.
- The Development Requester Selection list and My Tickets rows/cards are fully operable by
  keyboard (Tab to focus, Enter/Space to activate).
