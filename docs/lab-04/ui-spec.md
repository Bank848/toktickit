# TokTickIT UI Specification (Lab 4)

Extends `docs/lab-02/ui-spec.md` and `docs/lab-03/ui-spec.md`. The Zen Green token table, global
layout, typography and spacing scale, button hierarchy, and the WCAG 2.2 AA and responsive rules are
unchanged and are not repeated. No new color token is introduced. This document states only what is
new or different: one new section on two existing screens, two new dashboard screens, a change to
primary navigation and post-login landing, and one new inline message.

## 1. Carried-Over Tokens and Rules (pointer)

Use `docs/lab-02/ui-spec.md` §1 and §2 as the single source for color, type, spacing, and button
hierarchy. Badges reuse the existing tones: `badge-tone-neutral` for a Result or status label and
`badge-tone-pale` for the Follow-Up Required flag. Text and an icon or label always accompany color;
color is never the only signal.

## 2. Screens Changed or Added

| # | Screen | Route | Roles | Change |
|---|---|---|---|---|
| 1 | IT Staff Ticket Detail | `/staff/tickets/:id` | IT Staff, Administrator | New Actions Taken section; status-change rejection message |
| 2 | Requester Ticket Detail | `/tickets/:id` | Requester | New read-only Actions Taken section |
| 3 | Requester Dashboard | `/dashboard` | Requester | New |
| 4 | IT Staff Dashboard | `/staff/dashboard` | IT Staff, Administrator | New; Administrator sees one extra card |
| 5 | Primary navigation and post-login landing | n/a | all | New Dashboard entry; landing page changes |
| 6 | Ticket Queue and My Tickets | `/staff/tickets`, `/tickets` | IT Staff, Requester | Read filters from the URL query string |

## 3. Actions Taken Section (IT Staff Ticket Detail)

Placed below the existing Public Comments and Internal Notes sections, as its own region with the
heading **Actions Taken** (`<section aria-labelledby>`).

**Header row:** the heading on the left and a **Record Action Taken** primary small button on the
right. The button is hidden while the form is open. It is **disabled** when the Ticket is `CLOSED` or
`CANCELLED` (BR-08); existing records stay visible and each row's Edit button is disabled the same way.

**List:** records oldest first, one block per record, separated by a bottom border:

1. Performer display name in bold, the Result badge (Resolved, Escalated, No Action Needed, Pending
   Follow-Up), the Action Date/Time in the viewer's local time, and a **Follow-Up Required** pale badge
   when applicable.
2. An **Edit** secondary small button, pushed to the right edge.
3. The Description, preserving line breaks.
4. Optional small muted lines: `Follow-up: <note>`, `Attachment: <notes>`, and
   `Edited by <name>` when `lastEditedBy` is set.

**Form** (the same form for create and edit, opening below the list):

| Field | Control | Notes |
|---|---|---|
| Action Date/Time | `datetime-local` input | Defaults to now for create. Edit pre-fills the saved instant. Shown and entered in the viewer's local time; converted to a UTC ISO string only when submitted, so a saved value round-trips to the same instant in any timezone. |
| Description | textarea, max 2000 | Required. |
| Result | select | Four options, default Resolved. |
| Follow-Up Required | checkbox | Reveals the next field when checked. |
| Follow-up Note | textarea, max 1000 | Visible only when the checkbox is checked. Required and non-empty then. Unchecking and saving stores no note (BR-05). |
| Attachment Notes (optional) | text input, max 500 | Helper meaning: a free-text pointer to a file kept elsewhere. It does not upload a file (BR-06). |

Buttons: **Save** (primary) and **Cancel** (secondary), both small.

**Save is disabled** while submitting, while Description is empty after trimming, while Follow-Up
Required is checked with an empty Follow-up Note, and while Action Date/Time is cleared.

**States:**

| State | Behavior |
|---|---|
| Loading | `Loading Actions Taken…` with `aria-busy="true"` |
| Empty | `No Actions Taken yet.` in muted text |
| Load error | `role="alert"` danger alert, `Failed to load Actions Taken.`, with a **Retry** button |
| Submitting | All fields and Cancel disabled, Save `aria-busy="true"` |
| Save error | `role="alert"` danger alert inside the form with the server message (or `Failed to save Action Taken`), form stays open, every entered value is preserved so the user can fix and resubmit |
| Success | Form closes, the list shows the new or updated record, no page reload |

Server validation errors for fields the client already blocks (empty description, missing note,
future time) are shown through the Save error alert if they ever reach the server.

## 4. Status Change Rejection Message (IT Staff Ticket Detail)

When the status control is changed to **Resolved** and the server answers 409
`RESOLUTION_REQUIRES_ACTION_TAKEN`, the existing inline field error under the status control shows:

> This ticket cannot be marked Resolved yet — record an Action Taken first.

The Ticket's displayed status reverts to its previous value. The message appears for that error code
only. Any other status failure keeps its existing message (Lab 3), including another 409 whose text
happens to mention an action. The user is never shown the raw error code.

## 5. Actions Taken Section (Requester Ticket Detail, read only)

A card below Comments with the heading **Actions Taken**. It uses the same record layout and the same
fields as §3 (performer, Result badge, time, Follow-Up Required badge, description, follow-up note,
attachment notes, `Edited by`), with **no** Record button, no Edit button, and no form (FR-03, BR-11).
Loading, empty, and load-error states match §3, including the Retry button.

## 6. Requester Dashboard

**Route:** `/dashboard`. Title **My Dashboard**.

1. A row of four metric cards: **Open**, **Waiting**, **Resolved**, **Closed**. Each card shows the
   label and the count in large type. `Waiting` is the `WAITING_FOR_REQUESTER` status.
2. Each card is a single link to `/tickets?status=<STATUS>` (FR-10). The count sits inside the link,
   so its accessible name reads like "Open 2".
3. Quick actions: **Create Ticket** (primary, `/tickets/new`) and **View My Tickets** (secondary,
   `/tickets`).
4. **Recent Tickets:** up to 5 rows, each a link to the ticket number, the summary in muted text, and a
   status badge.

**States:** loading (`Loading your dashboard…`, `aria-busy`); error (`role="alert"`, `Failed to load
your dashboard.`, Retry); empty (every card shows `0`, the list shows `No recent tickets.`). A zero is
never replaced by a blank or a dash. Layout: 4 columns at desktop and tablet, 2 columns on mobile.

## 7. IT Staff Dashboard (and Administrator variant)

**Route:** `/staff/dashboard`. Title **IT Staff Dashboard**, or **Administrator Dashboard** when the
signed-in user is an Administrator.

1. **Status cards:** New, Open, In Progress, Waiting, plus **Assigned to me**. Each links to
   `/staff/tickets?status=<STATUS>`, and Assigned to me links to `/staff/tickets?ownerId=<my id>`.
2. **IT Priority cards:** Low, Medium, High, Urgent, each linking to
   `/staff/tickets?itPriority=<PRIORITY>`.
3. **Unassigned** card linking to `/staff/tickets?ownerId=unassigned`.
4. **Administrator only:** a **User accounts by role** card listing Requesters, IT Staff, and
   Administrators with their counts. It is absent for an IT Staff user, not rendered empty.
5. **Go to Ticket Queue** primary small button.
6. **Recently Updated Tickets:** up to 5 rows, each linking to `/staff/tickets/:id`.

States and responsive layout match §6. Every card shows a number, including `0`.

## 8. Navigation and Post-Login Landing

| Role | New primary navigation entry | Landing page after sign-in |
|---|---|---|
| Requester | **Dashboard** → `/dashboard` (before My Tickets) | `/dashboard` |
| IT Staff | **Dashboard** → `/staff/dashboard` (before Ticket Queue) | `/staff/dashboard` |
| Administrator | **Dashboard** → `/staff/dashboard` (before User Management) | `/staff/dashboard` |

This replaces the Lab 3 landings (`/tickets`, `/staff/tickets`, `/admin/users`). A user whose
`mustChangePassword` is true still goes to `/change-password` first. A role opening a dashboard that
is not theirs is redirected to their own role's dashboard, the same way Lab 3 redirects a wrong-role
visit. The active entry is marked with `aria-current="page"`.

## 9. Filter Hydration from Dashboard Links

Because dashboard cards deep-link into list screens (FR-10), both list screens read their initial
filter from the URL:

- **My Tickets** reads `status` (repeatable).
- **Ticket Queue** reads `status` (repeatable), `itPriority`, and `ownerId` (including the literal
  `unassigned`).

With no query string both screens behave exactly as in Lab 1-3, unfiltered. After the initial load the
screens manage their own filter state as before; changing a filter does not need to rewrite the URL.

## 10. Accessibility and Polish Checklist

- Every metric card is a link with a visible focus ring and a name that includes its count.
- The Actions Taken form fields each have a visible `<label>`; error alerts use `role="alert"`; busy
  controls use `aria-busy`.
- No placeholder text, no clipped or overlapping control at 375, 768, and 1280 px widths, and no
  console errors on any screen listed in §2.
- Every empty, loading, and error state above is reachable and has a matching automated test.
