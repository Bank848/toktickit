# TokTickIT — Lab 3 UI Specification

Extends `docs/lab-02/ui-spec.md`. The Zen Green token table (Lab 2 §1), global layout conventions,
typography/spacing scale, and button hierarchy (Lab 2 §2) are unchanged and are not repeated here
in full — this document states only what is new or different for Lab 3, plus the two full screens
(Login, Change Password) and the four changed/new screens (App Shell, Requester Ticket Detail, IT
Staff Ticket Queue, IT Staff Ticket Detail, Administrator User Management).

## 1. Carried-Over Tokens and Rules (pointer)

Use exactly `docs/lab-02/ui-spec.md` §1 (Zen Green token table), §2 (global layout, typography,
button hierarchy). No new token is introduced in Lab 3. The one new badge tone need is the
`REOPENED` status (§6 below), which reuses the existing `badge-tone-warning` surface (amber),
already defined in `client/src/theme.css`.

## 2. Verification Checklist (extends Lab 2 §1)

Same computed-style checks as Lab 2, plus: the Login and Change Password screens' header bar
renders `#006B3C` exactly like every other screen (no separate "auth" visual theme); the
`REOPENED` badge renders the amber warning surface (`#FFF6DA` background, `#8A6D1B` text/border),
distinct from `IN_PROGRESS`'s existing amber use only by its icon and label, per the "text and icon,
never color alone" rule already in force.

## 3. Login

**Route:** `/login` (also the fallback the app redirects to whenever no valid session exists).

**Layout:** a centered card below the app header (Zen Green Primary, "TokTickIT" only — no nav,
since there is no identity yet), matching the labsheet's §8.1 mockup:

1. Title **"Sign in to your account."**
2. **Email address** — text input, type `email`, required.
3. **Password** — password input with a visibility-toggle icon button (`aria-label="Show password"`
   / `"Hide password"`), required.
4. Inline error banner (Zen Green Error token, appears immediately below the password field, per
   the labsheet mockup): *"Invalid email or password. Please try again."* for `INVALID_CREDENTIALS`,
   or *"This account has been deactivated. Contact an administrator."* for `ACCOUNT_DEACTIVATED`
   (BR-06/BR-07) — two distinct messages, same visual treatment, `role="alert"`.
5. **Sign In** — primary button, full width, busy state (spinner, `aria-busy="true"`, click-disabled)
   while the request is in flight.
6. A disabled, non-functional "Forgot your password?" tertiary link with a tooltip/helper text
   *"Contact an administrator to reset your password"* — Lab 3 has no password-reset-by-email flow
   (explicitly excluded), so this link must never navigate anywhere or submit anything; it exists
   only because the labsheet's own mockup shows it, and removing it entirely versus disabling it
   with an explanatory label are both defensible, but disabling with a clear reason avoids a dead
   click with no feedback.

**States:** idle, submitting (busy Sign In button, both fields and the button disabled), invalid
credentials (error banner, password field cleared, email preserved, focus returns to password),
deactivated account (distinct error banner, same field-preservation behavior), network/server error
(same banner treatment with a generic message, no Retry button needed since resubmitting is just
pressing Sign In again).

**On success:** navigate based on the returned `mustChangePassword` — `true` → `/change-password`;
`false` → the role's home route (Requester → `/tickets`, IT Staff → `/staff/tickets`,
Administrator → `/admin/users`).

## 4. Change Password

**Route:** `/change-password`. Reachable only while authenticated; if `mustChangePassword` is
`false` and the user is not initiating a voluntary change (Lab 3 has no voluntary-change entry
point — see `specification.md` A-08's sibling scoping note: only the mandatory first-login flow is
implemented), the app redirects away to the role's home route instead of showing this screen.

**Layout** (matches the labsheet's §8.1 mockup, appears directly below Login when arriving via the
mandatory flow, or as its own standalone card when reached directly):

1. Title **"Change Your Password."**
2. One line of explanatory text: *"You must change your password to continue."*
3. **Current (temporary) password** — password input with visibility toggle, required.
4. **New password** — password input with visibility toggle, required.
5. **Confirm new password** — password input with visibility toggle, required.
6. A live password-rules checklist below the New Password field (four items, each with a check/
   circle icon that fills in as the typed value satisfies it): "Be at least 8 characters," "Include
   upper and lower case letters," "Include a number and a special character" — mirrors the
   labsheet's mockup exactly; this is client-side, advisory feedback only, the server independently
   re-validates every rule (`api-spec.md` #4).
7. **Continue** — primary button, full width, disabled until all three fields are filled and the
   client-side checklist and match check pass; busy state while the request is in flight.

**States:** idle, submitting, wrong current password (field-level error under Current Password:
"Current password is incorrect," other fields preserved), new-password policy violation
(field-level error under New Password naming the unmet rule(s), values preserved), mismatch
(field-level error under Confirm New Password: "Passwords do not match"), success (navigates
directly to the role's home route without a second login — no success toast needed since the
navigation itself is the confirmation).

## 5. App Shell and Navigation (extends Lab 2 §2, `client/src/components/AppShell.tsx`)

The header keeps its Zen Green Primary background and "TokTickIT" brand. What changes:

- The "Testing as: `<name>`" text and "Change Requester" button are replaced by **"Signed in as:
  `<displayName>` (`<Role label>`)"** and a **Logout** button (`btn-header`, same visual treatment
  Lab 2 used for "Change Requester"). Role labels: "Requester," "IT Staff," "Administrator."
- Activating Logout calls `POST /api/v1/auth/logout`, clears any client-side user state, and
  navigates to `/login` regardless of the response (a failed logout call still clears local state
  and redirects, since the goal — the user no longer being able to act as themselves in this tab —
  is achieved client-side either way; the session row itself is best-effort revoked server-side).
- Primary nav is role-specific and mutually exclusive per role, never a union: Requester sees **My
  Tickets** and **Create Ticket** (unchanged from Lab 2); IT Staff sees **My Queue** only; Administrator
  sees **Users** only. No role ever sees another role's nav item, matching FR-07/FR-08.
- The mobile hamburger-collapse behavior (below 768 px) is unchanged from Lab 2 §2: the collapsed
  header keeps the "Signed in as" text and Logout button visible outside the collapsed menu.
- A route guard component wraps the shell: unauthenticated → redirect `/login`; authenticated with
  `mustChangePassword: true` → redirect `/change-password`; authenticated but the current route's
  required role doesn't match → redirect to the caller's own home route (this is a client-side
  convenience only; the server's 403 `FORBIDDEN_ROLE` is the actual enforcement, per FR-08).

## 6. Requester Ticket Detail — Public Comments Addition (extends `docs/lab-02/ui-spec.md` §6)

Every Lab 2 field, layout, and Attachments behavior in `ui-spec.md` §6 is unchanged. Added directly
below the Attachments section:

**Public Comments section.** A labelled list of comments (author display name, a "Requester" or
"IT Staff" role tag next to the name — reusing the existing badge treatment — timestamp, body
text), oldest first, each entry visually plain (no card-within-card), separated by a thin divider.
Below the list: a **Post Comment** form — a required textarea (placeholder "Type your comment
here…", 1..2000 characters, live counter past 1800), a **Problem Appears Resolved** checkbox
(unchecked by default, label: "This also indicates the reported problem appears resolved"), and a
**Post Comment** primary button (disabled while the textarea is empty/whitespace-only, busy state
while submitting). Checking the box does not disable or change the textarea — the Requester still
writes their own comment text; checking it only sets `problemAppearsResolved: true` on submit
(`api-spec.md` #15). A comment posted with the box checked renders in the list with a distinct
"Problem Appears Resolved" badge (Zen Green Pale surface with a check icon) next to the timestamp,
so the Requester and any IT Staff reading the thread can see which comment carried that flag
without parsing the stored text prefix themselves.

**States:** loading (skeleton rows while comments fetch, independent of the Attachments section's
own loading state), empty ("No comments yet."), submitting (busy button, textarea disabled),
validation (inline message if submitted empty), success (new comment appends to the list
immediately, textarea and checkbox reset), error with retry (fetch failure shows an inline error
with Retry, submit failure shows a dismissible alert above the form without losing the typed
draft).

**Status badge update.** `TicketStatusBadge`'s `STATUS_META` map (`client/src/components/
TicketStatusBadge.tsx`) is rewritten to the 8 renamed/added keys:

| Key | Label | Icon | Badge tone |
|---|---|---|---|
| `NEW` | New | `circle-fill` | info (unchanged) |
| `OPEN` | Open | `person-check` | info (unchanged icon/tone, renamed from `ASSIGNED`) |
| `IN_PROGRESS` | In Progress | `arrow-repeat` | warning (unchanged) |
| `WAITING_FOR_REQUESTER` | Waiting for Requester | `pause-circle-fill` | neutral (unchanged icon/tone, renamed from `PENDING_REQUESTER`) |
| `RESOLVED` | Resolved | `check-circle-fill` | success (unchanged) |
| `CLOSED` | Closed | `dash-circle-fill` | dark (unchanged) |
| `REOPENED` | Reopened | `arrow-clockwise` | warning (new) |
| `CANCELLED` | Cancelled | `x-circle-fill` | danger (unchanged) |

`STATUS_OPTIONS` (used by My Tickets' and the Ticket Queue's status filter) is derived from this
map automatically, as it already is in the Lab 2 implementation — no separate list to keep in sync.

## 7. IT Staff Ticket Queue

**Route:** `/staff/tickets`. Reachable only by role `IT_STAFF` (client guard per §5; server-enforced
by `requireRole('IT_STAFF')` regardless).

**Filter bar** (same visual pattern as My Tickets, `docs/lab-02/ui-spec.md` §5): search input
(placeholder "Search by ticket number or summary"), status multi-select (8 values from §6's table),
IT Priority select (new — Low/Medium/High/Urgent, "Any" default), an Owner select ("Any," "Unassigned,"
then each active IT Staff/Administrator by display name, populated from `GET
/api/v1/staff/assignable-owners`), a Sort control (same whitelist as My Tickets), and "Clear
filters" — all combined with AND semantics, matching Lab 2's convention.

**Desktop (≥ `md`, 768 px):** table — columns Ticket No., Created Date, Summary, Category, Req.
Priority, IT Priority, Status, Owner ("Unassigned" when null). This is the exact column set shown
in the labsheet's §8.3 mockup; it was kept rather than trimmed further because every column maps to
a filter or sort key IT Staff can act on, and the labsheet's own illustration already fits these
eight columns without becoming an unreadable mega-grid at desktop width.

**Mobile (< `md`):** the same rows render as stacked cards (label: value pairs), identical pattern
to My Tickets' mobile layout, never a horizontally scrolling table.

**Row selection:** clicking a row/card navigates to that ticket's Staff Ticket Detail (§8).

**Pagination:** identical Bootstrap pagination component and page-size convention as My Tickets.

**States:** loading (skeleton rows/cards), empty ("No tickets in the queue yet" — genuinely zero
tickets exist system-wide, a rare/setup-only state), no-match ("No tickets match your filters," with
a working "Clear filters" action — distinct from the empty state, same pattern as My Tickets' two
empty states), error with retry, forbidden (a `IT_STAFF`-only page reached by a misrouted
non-staff session shows the same "Ticket not found"-style generic message rather than a 403 stack
trace, though this should be unreachable in practice since the route guard in §5 redirects before
this screen ever renders for the wrong role).

## 8. IT Staff Ticket Detail

**Route:** `/staff/tickets/:id`.

**Header block:** same read-only field set as Requester Ticket Detail (ticket number, date,
category, related system, requester, Requested Priority badge, summary, description, resolution
summary), plus two now-editable controls in place of what was read-only for the Requester:

- **Ticket Owner** — a select populated from `GET /api/v1/staff/assignable-owners`, showing
  "Unassigned" as a placeholder-only option (not selectable once a real owner exists, per BR-16 — no
  unassign path) or the current owner's display name. Changing it calls `PATCH
  /api/v1/staff/tickets/:id/owner` immediately (no separate Save button for this field, since it's
  a single atomic action, consistent with a claim/reassign being a one-step operation); a busy
  spinner replaces the select's dropdown chevron while the request is in flight, and a toast/inline
  confirmation shows "Ticket claimed" or "Ticket reassigned to `<name>`."
- **IT Priority** — a select (Low/Medium/High/Urgent), editable independent of Requested Priority,
  saved the same immediate-on-change way via `PATCH /api/v1/staff/tickets/:id/priority`. Disabled
  (with a tooltip "Locked: ticket is Closed/Cancelled") when the ticket's status is `CLOSED` or
  `CANCELLED`, per BR-19.
- **Current Status** — a select whose available options are computed client-side from the
  transition matrix (`specification.md` §4.4) based on the ticket's current status, so an IT Staff
  member is never shown an option the server would reject; changing it calls `PATCH
  /api/v1/staff/tickets/:id/status`. If the ticket is `NEW` and unowned, this select is disabled
  with the tooltip "Assign an owner first" (BR-15) rather than silently offering `OPEN` and then
  failing.

**Tabs/sections below the header** (same visual tab-or-stacked-sections pattern already established
by the header block's card, not the removed Lab-2-era Service Actions/Event Log tab chrome): Public
Comments (identical component to §6's Requester-facing one, reused as-is — same list/post form,
same "Problem Appears Resolved" badge rendering — since `CommentDto` is identical for both
endpoints), Internal Notes (visually distinct surface — a warm neutral background, never the same
white card as Public Comments, with a persistent header label "Internal — visible only to IT Staff
and Administrators" so an IT Staff member is never at risk of mistaking which box they are typing
into), and Attachments (read-only list, same row layout as Lab 2's Attachments section minus the
upload control and the Remove action — download only, per A-10's IT-Staff-cannot-upload/remove
decision).

**States:** loading, not-found (404 — a ticket id that doesn't exist; unlike the Requester's version
there is no ownership ambiguity to hide here, since IT Staff can see every ticket, so this state is
reached only for a genuinely nonexistent id), forbidden (reached only by a misrouted session, same
generic treatment as §7), error with retry (independently for the header block, the Comments
section, the Notes section, and the Attachments section, matching the granular-loading pattern
already used for Lab 2's Attachments section), saving/success/failure feedback per control (owner,
priority, status) shown as a small inline toast near that control rather than a page-level banner,
so acting on one control's result is never confused with another's.

## 9. Administrator User Management

**Route:** `/admin/users`.

**Layout** (matches the labsheet's §8.5 mockup): a two-pane desktop layout — a Users list on the
left, a Create/Edit User panel on the right that slides in only when Create or an existing row's
Edit action is activated (otherwise the right pane is empty with a placeholder "Select a user to
edit, or create a new one").

**Users list (left pane):**

- Search input (placeholder "Search users…", matches by name or email, debounced ~300 ms).
- Role filter select ("Any role," then each of the three roles) — optional, combines with search
  using AND semantics.
- Table (desktop ≥ `md`) with columns Name, Role, Status (a badge: "Active"/"Inactive," success/
  neutral tone), and an Edit action per row (icon button, `aria-label="Edit <name>"`).
- Mobile (< `md`): stacked cards, same label:value pattern as every other Lab 2/3 list.
- **Create User** button (primary), top of the pane, opens the right panel in create mode.
- No pagination and no multi-column sort control in Lab 3 (explicitly excluded) — the list renders
  every matching row from a single fetch; this is acceptable because the excluded-features list
  caps this screen's expected data volume far below where pagination would matter.

**Create/Edit User panel (right pane, or a full-screen sheet on mobile):**

Fields, in order: **Full Name** (required, 2..100 chars), **Email Address** (required, valid email
format, disabled/read-only when editing an existing user's own row is not restricted — email *can*
be edited, this field is only read-only in the sense that its uniqueness is re-validated on save),
**Role** (required select, one of the three), **Active** (a toggle/switch, default on for Create).

Create mode adds an **Initial Password** field (required, same live policy checklist as Change
Password's New Password field) and a static note: *"The user must change this password at first
login."* Edit mode does not show a password field inline; instead it shows a **Set New Password**
secondary button that opens a small confirmation dialog with its own single Initial Password field
and the same note, calling `PATCH /api/v1/admin/users/:id/password` independently of the main
Save action, so resetting a password is never bundled with (and cannot be silently skipped by) an
unrelated name/email/role edit.

Actions: **Save User** (primary) and **Cancel** (tertiary, closes the panel without saving). Edit
mode additionally shows a **Deactivate User** / **Activate User** toggle-styled destructive-tier
button (matches the labsheet's mockup, which labels this "Deactivate User" — implemented as the
same `isActive` field the main Save action already carries, exposed as a dedicated one-click button
so deactivation doesn't require opening the full edit form fields first) — disabled with a tooltip
"You cannot deactivate your own account" when editing the signed-in Administrator's own row (BR-27),
and disabled with the tooltip "At least one active Administrator is required" when editing the last
remaining active Administrator (BR-28).

**States:** loading (initial user list fetch), empty ("No users match your search" when filtered to
zero — the list can never be genuinely empty at rest, since the seed always keeps at least one
active Administrator), submitting (busy Save button), validation (field-level messages: name
length, email format, missing role, password policy), duplicate email (inline error on the Email
field: "This email is already in use"), self-deactivation-blocked and last-Administrator-blocked
(both surface as a dismissible alert above the form rather than a field error, since neither is
about a specific field's value), success (a dismissible success alert — "User created," "User
updated," "Password reset — user must change it at next login" — and the list refetches to reflect
the change), forbidden (reached only by a misrouted non-Administrator session, same generic
treatment as §7/§8).

## 10. Responsive and Accessibility Rules (pointer)

Same as `docs/lab-02/ui-spec.md` §7 (breakpoints: desktop ≥ 992 px, tablet 768–991 px, mobile
< 768 px, no horizontal scroll at any size) and §8 (WCAG 2.2 AA: labelled controls, visible focus,
keyboard operability, text+icon status communication). Every new screen in this document (Login,
Change Password, Ticket Queue, Staff Ticket Detail, User Management) is built to the same rules
without exception — in particular, the Ticket Queue's table→card breakpoint and the User
Management list's table→card breakpoint both follow the identical 768 px rule My Tickets already
established, and every new select/toggle/dialog in this document is keyboard-operable using native
element semantics, matching Lab 2's "no custom widget that breaks native keyboard behavior" rule.

**Screenshot path convention (extends Lab 2's, new subfolders):**
`artifacts/lab-03/screenshots/authentication/` (Login + Change Password), `.../staff-queue/`,
`.../staff-ticket-detail/`, `.../user-management/`, one subfolder per screen group, filenames
stating the viewport and state (e.g. `staff-queue/mobile-no-match-empty-state.png`).
