# TokTickIT — Lab 2 UI Specification

Corrected 2026-08-21 (PR #14 review, D-19). Implements the labsheet's mandatory Zen Green design
tokens and responsive presentation rules. Extends the SDS System-Wide UI Standards
(`references/TokTickIT-System-Level-SDS-v1.0.md`) — shared component treatment, form labelling,
focus visibility, WCAG 2.2 AA target — with Lab 2's concrete tokens and screens.

## 1. Zen Green Design Tokens

No hex values are published in the labsheet or lecture deck beyond the "Zen Green" name and the
Figure 1 mockup's dark-green header/accent chrome. The table below is this spec set's concrete
interpretation, chosen to visually match that mockup while meeting WCAG 2.2 AA contrast on every
pairing actually used in the UI. If the course later publishes exact tokens, only this table (and
its two consumers below) need to change.

| Token | Value | Use | Contrast note |
|---|---|---|---|
| Zen Green 900 (header) | `#14532D` | App header/nav background, with white text/icons | White text on `#14532D` ≈ 10.9:1 (AAA) |
| Zen Green 600 (primary) | `#1F7A45` | Primary buttons, primary links, active nav indicator | White text on `#1F7A45` ≈ 4.6:1 (AA for normal text) |
| Zen Green 100 (surface) | `#E6F4EA` | Hover/selected row background, subtle info surfaces | Paired only with dark text below |
| Zen Green 700 (interactive dark) | `#155A32` | Visited/active link emphasis on light backgrounds | Text on white ≈ 8.4:1 |
| Text | `#1F2937` | Primary text | On white ≈ 15.6:1 |
| Muted | `#5B6573` | Secondary labels, metadata, timestamps | On white ≈ 5.1:1 (AA) |
| Background | `#FFFFFF` | Application background | — |
| Border/icon | `#7A8B80` | Borders, dividers, non-text decorative icons | Non-text; no AA text requirement |
| Success | `#1E7D34` | Completed/success state, always with text/icon (not a status color alone) | On white ≈ 4.6:1 (AA) |
| Warning | `#8A6D1B` | Warning surfaces, always with text/icon | On white ≈ 5.0:1 (AA); paired with a light `#FFF6DA` surface, never used as text-on-Zen-Green |
| Danger | `#B3261E` | Destructive/error state, always with text/icon | On white ≈ 6.0:1 (AA) |

Status and priority badges use text + an icon, never color alone (SDS System-Wide UI Standards).
Badge background tints are light neutral/warning/danger surfaces with the corresponding dark
text color above, not raw Zen Green 600/900 (those are reserved for header/primary-action
chrome so the palette does not read as "everything is a button").

## 2. Global Layout

- App header (Zen Green 900 background, white text): product name "TokTickIT" (left), primary
  nav — My Tickets, Create Ticket (center/left-aligned per Bootstrap navbar), and the
  **selected-requester display + "Change Requester" control** (right, see §3).
- Content area: Bootstrap container, responsive grid, system font stack, Bootstrap spacing scale.
- Shared components (per SDS): one treatment each for forms, buttons, tables, badges,
  confirmation dialogs, loading/empty/error states, used identically across Create Ticket, My
  Tickets, and Ticket Detail.

## 3. Development Requester Selection (D-18)

**Route:** `/dev/select-requester` (also the fallback the app redirects to whenever no valid
requester is currently selected).

**Purpose banner** (always visible on this screen, Zen Green 100 surface, dark text, an info
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

**Actions:** Create Ticket (primary, Zen Green 600) and Cancel (link back to My Tickets).

**Submit sequence (FR-012):** `POST /tickets` first; on success, for each staged file, upload via
`POST /tickets/:id/attachments` in sequence; navigate to the new Ticket Detail regardless of
individual upload outcomes, with a per-file success/failure summary shown as a dismissible alert
on Ticket Detail if any upload failed ("2 of 3 files attached. 1 failed: invoice.exe — file type
not allowed. Retry from the Attachments tab."). The ticket itself is never rolled back or hidden
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

**Tabs:** Attachments (default open), Service Actions, Event Log — three tabs, not four; there is
no Public Comments tab (D-15 correction).

- **Attachments tab:** upload control (constraints stated in visible text: "JPG, PNG, WEBP or
  PDF, up to 5 MB, maximum 5 files", count shown as "3 of 5 used", disabled at 5 active). List
  rows: filename, size, uploader, upload date, Download (active attachments only), Remove (own
  uploads only, while ticket is not Closed). **Removed attachments remain in the list**, visually
  de-emphasized (muted text, a "Removed" badge with icon), showing filename, uploader, original
  upload date, removal reason, remover, and removal date — Download/preview is replaced with a
  disabled control (never a working link to the deleted binary). Removing an attachment opens a
  confirmation dialog requiring a reason (required text field, 1..200 characters, submit disabled
  until non-empty) before the request is sent. Empty state (zero attachments ever, not even
  removed ones): "No attachments yet."
- **Service Actions tab:** always empty in Lab 2 — "No service actions yet. Service Actions are
  added by IT Staff in a later lab." (labelled empty state, not a hidden tab).
- **Event Log tab:** read-only list, newest-first, of `TICKET_CREATED`, `ATTACHMENT_ADDED`,
  `ATTACHMENT_REMOVED` events, each showing actor, a plain-language summary, and timestamp.

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
- Keyboard focus is visible (a Zen Green 700 focus ring, never suppressed) and follows a logical
  tab order; the confirmation dialog (attachment removal) traps focus and returns it to the
  control that opened it on close.
- Status/priority/removed-attachment states communicate via text and icon, never color alone.
- The Development Requester Selection list and My Tickets rows/cards are fully operable by
  keyboard (Tab to focus, Enter/Space to activate).
