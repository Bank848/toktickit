# TokTickIT — Lab 2 UI Specification

**Status:** Reconciled 2026-08-21, third pass, against the actual official Lab 2 labsheet
(§7 "Zen Green Theme UI Specification" and §17 "Appendix C. Suggested ui-spec.md Checklist").
Implements the labsheet's mandatory Zen Green design tokens, full component-state set, and
responsive presentation rules. Extends the SDS System-Wide UI Standards
(`references/TokTickIT-System-Level-SDS-v1.0.md`) — shared component treatment, form labelling,
focus visibility, WCAG 2.2 AA target — with Lab 2's concrete tokens and screens.

## 1. Zen Green Design Tokens

Table below matches the labsheet's §7 token table exactly (page 8), including the rows the
earlier draft of this spec omitted (Surface/cards, Editable field, Read-only field, Warning).

| Token / Element | Value | Required Style (per labsheet) | Contrast note |
|---|---|---|---|
| Primary green | `#006B3C` | App header, primary actions, strong emphasis | White text on `#006B3C` ≈ 6.6:1 (AA) |
| Secondary green | `#0B7A46` | Active tabs, focus accents, links, hover states | On page background ≈ 5.4:1 (AA) |
| Pale green | `#EAF6EF` | Selected, success, and subtle section emphasis | Paired only with the Text token — high contrast |
| Page background | `#F5F7F6` | Application background (or similarly quiet near-white) | Text on it ≈ 15:1 |
| Surface / cards | White (`#FFFFFF`) | White with subtle border and restrained shadow | Cards sit above the page background |
| Text | `#1F2937` | Dark charcoal-green, not pure black, for comfortable reading | On page background ≈ 15:1 |
| Editable field | White background, `#7A8B80` border | White background with clear neutral border | Distinct from read-only fields |
| Read-only field | `#F0F3F1` background | Soft gray-green shading, clearly distinct but still readable | Never the same fill as an editable input |
| Error | `#B3261E` | Dark red text and border; message appears immediately below the field | On page background ≈ 6.0:1 (AA) |
| Warning | `#8A6D1B` on `#FFF6DA` | Amber callout or badge; never used as ordinary decoration | On page background ≈ 5.0:1 (AA) |
| Success | `#1E7D34` | Green confirmation with readable text, never color alone | On page background ≈ 4.6:1 (AA) |
| Muted (supplementary) | `#5B6573` | Secondary labels, metadata, timestamps | On page background ≈ 5.1:1 (AA) |
| Border/icon (supplementary) | `#7A8B80` | Borders, dividers, non-text decorative icons | Non-text; no AA text requirement |

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
  **selected-requester display + "Change Requester" control** (right, see §3). The active nav item
  is indicated with the Secondary green underline/pill, never color alone (also carries an
  `aria-current="page"`).
- Content area: Bootstrap container, responsive grid, system font stack, Bootstrap spacing scale.
- Shared components (per SDS): one treatment each for forms, buttons, tables, badges,
  confirmation dialogs, loading/empty/error states, used identically across Create Ticket, My
  Tickets, and Ticket Detail.
- **Mobile navigation:** below the `md` (768 px) breakpoint, the primary nav (My Tickets, Create
  Ticket) collapses behind a Bootstrap navbar-toggler (hamburger) button in the header; the
  selected-requester display and "Change Requester" control stay visible in the collapsed header
  bar rather than moving into the collapsed menu. Expanding the toggler shows the nav items
  stacked full-width; it closes on item selection or on a second toggle press. This satisfies the
  labsheet's §8 "responsive mobile navigation" requirement.

### Typography and Spacing

- **Font stack:** system font stack (`-apple-system, "Segoe UI", Roboto, Helvetica, Arial,
  sans-serif`) — no custom web font is loaded in Lab 2.
- **Type scale:** page/section headings `1.25rem`/`600` weight; field labels and table headers
  `0.875rem`/`600`; body text and input values `1rem`/`400`; helper/muted text and timestamps
  `0.8125rem`/`400` using the Muted token.
- **Spacing:** Bootstrap's default spacing scale (`0.25rem` increments) throughout; form fields use
  `1rem` vertical gap between rows, `0.5rem` between a label and its control; cards use `1.5rem`
  internal padding on desktop, `1rem` on mobile.

### Button hierarchy (labsheet §17)

| Style | Visual | Use |
|---|---|---|
| Primary | Solid Zen Green Primary fill, white text | The one main action per screen (Create Ticket submit, Continue on the selector) |
| Secondary | White fill, Zen Green Secondary border and text | Supporting actions alongside a primary (e.g. "Clear filters" next to search) |
| Tertiary | No fill, no border, Zen Green Secondary text, underline on hover | Low-emphasis actions (e.g. "Cancel" links back to a list) |
| Destructive | White fill, Danger border and text; solid Danger fill on confirm-dialog submit | Attachment removal confirm |
| Disabled | Muted gray fill/border/text, `cursor: not-allowed`, `aria-disabled="true"` | Any button whose action cannot currently be taken (e.g. Continue with nothing selected) |
| Busy | Primary/Destructive styling plus an inline spinner, text unchanged, `aria-busy="true"`, click-disabled | Submit while the request is in flight |

Icon-only controls (e.g. a table-row remove icon) always carry a visible text label via
`aria-label` and a hover tooltip — an icon never replaces the required visible text on a button.

## 3. Development Requester Selection (D-18, labsheet §8.1)

**Route:** `/dev/select-requester` (also the fallback the app redirects to whenever no valid
requester is currently selected).

**Layout** (matches the labsheet's §8.1 illustration): a centered card below the app header and a
"Home > Development Requester Selection" breadcrumb, containing, top to bottom:

1. An icon and the title **"Select Development Requester."**
2. One line of explanatory text: *"Choose a development requester to simulate the current
   requester context for Lab 2. This is for testing only and is not a login screen."*
3. A labelled **Development Requester dropdown** (required, red asterisk), populated from
   `GET /api/v1/dev/requesters` (active Requesters only).
4. An info line, Zen Green Pale surface with an info icon: *"Only active development requesters
   are shown."*
5. A secondary note, neutral surface with a shield icon: *"Authentication coming in Lab 3 — in
   Lab 3, this selection will be replaced with secure authentication so you can access the system
   with your own account."*
6. Two buttons, right-aligned: **Cancel** (tertiary — no-ops back to the header/home when a prior
   selection exists, disabled with no effect when this is the first-load fallback) and
   **Continue** (primary; disabled until a Requester is chosen).

Choosing a Requester and activating Continue calls `POST /api/v1/dev/session` with the selected
user id; on success the app navigates to My Tickets. The dropdown and both buttons are fully
keyboard-operable (Tab to focus, Enter/Space/arrow keys per native `<select>` and `<button>`
semantics — no custom widget that breaks native keyboard behavior).

**States:** loading (dropdown shows a disabled "Loading requesters…" placeholder while the fetch
is in flight), empty (no active Requesters seeded — a labelled error state with guidance, not a
silent empty dropdown, since the app is unusable without at least one), API-failure (the fetch
itself failed — an inline error banner with a Retry action, Continue stays disabled).

**Header integration:** once a requester is selected, the app header shows "Testing as: `<display
name>`" and a "Change Requester" button. Activating it clears the stored selection
(`sessionStorage`, not a cookie) and navigates to `/dev/select-requester`. Any in-flight or cached
requester-scoped data (My Tickets list, an open Ticket Detail) is discarded on switch — the next
screen always re-fetches fresh, scoped to the newly selected requester. This is asserted directly
in E2E (see `tests.md`).

## 4. Create Ticket

**Route:** `/tickets/new`.

Single-column card. Fields, in order:

1. **Ticket Number**, **Ticket Date**, **Requester** — read-only display fields (Read-only-field
   token background, `#F0F3F1`), shown near the top per the labsheet's §8.2 "system-generated
   fields near the top" arrangement. Ticket Number and Ticket Date show placeholder text
   ("Assigned on save" / "Today") until the ticket is created; Requester shows the currently
   selected Development Requester's display name. None of the three is ever rendered as an
   editable input or accepted from the request body.
2. **Summary** — text input, required, live character counter to 150.
3. **Category** — select, required, active categories only, placeholder "Select a category".
4. **Related System** — select, optional, "Not applicable" default, active related systems only.
5. **Requested Priority** — select, required, default Medium.
6. **Description** — textarea, 6 rows, required, character counter to 5000.
7. **Attachments** — file picker (multi-select), accepting `.jpg .jpeg .png .webp .pdf`, client-
   side pre-check of extension and size (advisory only — server re-validates everything, per
   `api-spec.md`). Staged files are listed with a remove-before-submit control; nothing uploads
   until the ticket itself is created.

**Actions:** Create Ticket (primary, Zen Green Primary) and Cancel (link back to My Tickets).

**Submit sequence (FR-11):** `POST /tickets` first; on success, for each staged file, upload via
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
summary"), status multi-select, category select, a Sort control (whitelist per `api-spec.md` #7:
Newest first (default), Oldest first, Recently updated, Ticket No.), and a secondary "Clear
filters" button that resets search/filters/sort to their defaults and is disabled when nothing is
active — all combined with AND semantics (D-17/BR-13). Changing any filter, the sort, or the
search box (debounced ~300 ms) refetches and resets to page 1.

**Desktop (≥ `md`, 768 px):** table — columns Ticket No., Summary, Category, Status, Last
Updated. Status shown as a text+icon badge, never color alone.

**Mobile (< `md`):** the same rows render as stacked cards (label: value pairs), per the SDS
"card layout" responsive requirement — never a horizontally scrolling table.

**Row selection:** clicking a row/card navigates to that ticket's Detail (FR-17).

**Pagination:** page-size-aware controls below the list, standard Bootstrap pagination component.

**States:** loading (skeleton rows/cards), two distinct empty states — "You haven't created any
tickets yet" (no filters/search active, zero total tickets) versus "No tickets match your
filters" (filters/search active, zero results) with a "Clear filters" action on the latter, error
with retry.

## 6. Ticket Detail

**Route:** `/tickets/:id`.

**Header block:** ticket number, date, category, related system ("Not applicable" when none was
selected), requester, owner ("Unassigned" — always, in Lab 2), Requested Priority badge, IT
Priority badge, current status badge, summary, description, resolution summary ("No resolution
yet" — always, in Lab 2) — matching `specification.md` FR-18's full field list.

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

**Attachment states (labsheet §17 checklist):**

| State | Presentation |
|---|---|
| Active | Normal row: filename, size, uploader, date, working Download, Remove shown only for the current requester's own uploads |
| Uploading | Row shows the staged filename with a progress/busy indicator in place of Download/Remove; not yet persisted |
| Invalid | Client-side pre-check (wrong extension or over 5 MB) renders an inline error next to the staged file and blocks it from being included in the upload request; the server re-validates independently and returns the same class of error if a client check is bypassed |
| Removed | De-emphasized (muted text, "Removed" badge with icon), shows reason/remover/removal date, Download replaced with a disabled control — never a working link to the deleted binary |
| Unavailable | If a fetch for the attachment list itself fails, the whole section shows an inline error with Retry rather than a partial/broken list |

**Not part of Lab 2 (removed 2026-08-21):** a Service Actions tab/placeholder and an Event Log
tab. `TICKET_CREATED`/`ATTACHMENT_ADDED`/`ATTACHMENT_REMOVED` events are still written for audit
continuity (BR-11/BR-15) but are not read back or displayed anywhere in Lab 2 — no events
endpoint, no Event Log UI. Public Comments remain out of scope per D-15.

**States:** loading, not-found/not-accessible (404, corrected 2026-08-22 PR #14 peer review, D-24
— a generic "Ticket not found" message, never revealing whether the ticket exists; 403 would have
confirmed existence, so it's never used here), error with retry.

## 7. Responsive Rules (D-19/NFR-04, labsheet §8.7)

| Viewport | Required Behavior |
|---|---|
| Desktop ≥ 992 px | Multi-column layout as specified in §4/§5/§6; content centered with a sensible maximum width |
| Tablet 768–991 px | Two-column layout where practical; Summary and Description receive enough width |
| Mobile < 768 px | Fields stack vertically; buttons remain touch-friendly (≥ 44×44 CSS px); no horizontal page scrolling |
| All sizes | No clipped labels, overlapping messages, hidden buttons, or unreadable attachment names |

My Tickets switches table → stacked-card layout at the 768 px boundary (§5). Verified in E2E at a
sub-768px viewport (see `tests.md` E2E-01) and by the manual/screenshot checklist in `tests.md` §4.

**Screenshot path convention:** `artifacts/lab-02/screenshots/create-ticket/`,
`.../my-tickets/`, `.../ticket-detail/`, one subfolder per screen, filenames stating the viewport
and state (e.g. `create-ticket/mobile-validation-failure.png`).

## 8. Accessibility (WCAG 2.2 AA)

- Every form control has a programmatic label; validation messages are associated with their
  field via `aria-describedby` and announced to assistive tech on submit failure.
- Keyboard focus is visible (a Zen Green Secondary focus ring, never suppressed) and follows a logical
  tab order; the confirmation dialog (attachment removal) traps focus and returns it to the
  control that opened it on close.
- Status/priority/removed-attachment states communicate via text and icon, never color alone.
- The Development Requester Selection list and My Tickets rows/cards are fully operable by
  keyboard (Tab to focus, Enter/Space to activate).
