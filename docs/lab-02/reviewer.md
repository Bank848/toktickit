# Lab 2 Reviewer Record

Reviewer identity, PR links, comments given and received, responses, and approvals, per the
labsheet's Part 1 "Git Use with Engineering Workflow" submission requirement. Compiled directly
from the GitHub API against PR #14 (`gh api repos/Bank848/toktickit/pulls/14/reviews` and
`.../comments`), not from memory — every quote below is the actual review text.

## Reviewer identity

- **Reviewer:** ArmmyC (GitHub user id 186667389), repository collaborator.
- **Author:** Bank848 (Bank, this repository's owner).

## Pull request

- **PR #14 — "Lab 2 specification set"**
  https://github.com/Bank848/toktickit/pull/14
- Branch: `feature/5-lab2-specs` → `lab2-staging`. Linked to Issue #10.
- Status as of this document: **merged** (2026-08-25T11:58:38Z), after three CHANGES_REQUESTED
  rounds from ArmmyC. No APPROVED review was ever recorded on this PR — see "Approvals" below for
  why that is not a process gap.

## Review round 1 — commit `bac2fee`

**ArmmyC, CHANGES_REQUESTED** (2026-08-21T04:07:19Z)

> "Requesting changes because this specification set is not aligned with the official Lab 2
> labsheet now supplied for the course. The current documents appear to follow the earlier W3
> foundation plan, and several decisions contradict graded requirements."

Required contract corrections requested:
1. Provide `docs/lab-02/specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md` as the exact
   required deliverables (supporting docs may remain, but do not replace them).
2. Make the contract self-contained — referenced planning docs were missing from the repository.
3. Complete the requirements → acceptance-criteria → test traceability before implementation.
4. Reconcile seven inline scope corrections (below) across the endpoint table, feature specs,
   test plan, and Issue decomposition.

Seven inline comments (all on `bac2fee`, general/file-level, not line-anchored):

| # | File | ArmmyC's comment (summary) | Bank848's response (summary) |
|---|---|---|---|
| 1 | `decision-register-addendum.md` | Reverse D-17 — My Tickets search is required, not deferred | Reversed D-17; `q` param added, AND semantics with existing filters |
| 2 | `decision-register-addendum.md` | Replace the header/env identity seam with a real Development Requester Selection screen | Replaced D-18 with a real picker screen, "Change Requester" control, scoped reload |
| 3 | `decision-register-addendum.md` | Zen Green tokens and responsive rules are mandatory, not KMUTT palette | Reversed D-19 to Zen Green tokens |
| 4 | `features/feature-e-ticket-comments.md` | Remove Feature-E (Public Comments) entirely — labsheet excludes it | Deleted `feature-e-ticket-comments.md`, dropped comment endpoints, cut Ticket Detail down to three tabs |
| 5 | `features/feature-b-ticket-creation.md` | Create-time attachment upload/compensation must be defined, not deferred | Added create-then-upload sequence with per-file failure handling that never rolls back the ticket |
| 6 | `features/feature-f-attachments.md` | Removal must be soft (required reason, metadata stays visible) | Rewrote removal as soft delete: required reason, metadata retained, content 410s |
| 7 | `traceability-matrix.md` | Full AC-to-test matrix required before implementation, not deferred | Rewrote the matrix with the full mapping and a J1–J5 E2E index |

## Review round 2 — commit `5bdbdda`

**ArmmyC, CHANGES_REQUESTED** (2026-08-21T06:42:15Z)

> "Follow-up review against correction commit 5bdbdda. The first correction addressed the
> original seven threads well, but five Lab 2 contract gaps remain when checked against the
> official labsheet. Please address the inline comments before approval. I am leaving the earlier
> threads unresolved until the corrected commit is re-reviewed."

Five new inline comments:

| # | File | ArmmyC's comment (summary) | Status after commit `d7e803f` |
|---|---|---|---|
| 8 | `ui-spec.md` | Labsheet publishes exact Zen Green hex values (`#006B3C`/`#0B7A46`/`#EAF6EF`/`#F5F7F6`) — replace the invented palette and carry the values into the visual checklist | Bank848 asked where the values were documented (see below); resolved in this reconciliation pass — see `reviewer.md` §"Answers below" |
| 9 | `specification.md` | Add numbered Acceptance Criteria (Given/When/Then), a Definition of Done, and Assumptions and Decisions; give a stable AC-NN id to each and map every one to a real test path | Addressed in `d7e803f` (AC-01…AC-19 added) and restructured further in this pass into the labsheet's exact §8.10 section order |
| 10 | `features/feature-d-ticket-detail.md` (line 9) | Remove the Service Actions placeholder and Event Log from Lab 2's Ticket Detail scope entirely | Addressed in `d7e803f` for `specification.md`/`api-spec.md`; `tests.md`, `traceability-matrix.md`, and `feature-d-ticket-detail.md` still described the old three-tab structure until this reconciliation pass, which now removes it everywhere |
| 11 | `specification.md` | Remove IT Staff/Administrator access branches and role-based/session semantics entirely — ownership-only | Addressed in `d7e803f` (D-21 added) |
| 12 | `specification.md` (line 65) | Make the seed baseline explicit and testable (counts for active/inactive Requesters, Categories, Related Systems, idempotency) | Addressed in `d7e803f` (D-23, §7 added); source of the exact counts confirmed in this pass — see below |

Two of these threads carried a follow-up question from Bank848 that had not yet been answered
when this reconciliation pass started:

- On thread 8 (Zen Green tokens): *"Checked the labsheet PDF and the SDS/SRS docs — I don't see
  these hex values anywhere, only the 'Zen Green' name and the illustrative green screenshot. Is
  there a separate style guide/palette doc for this? Want to cite the right source before baking
  exact values into the spec."*
- On thread 12 (seed counts): *"Same question here — I don't see specific seed counts (4+ active
  Requesters, 1 inactive, 6+ Related Systems) anywhere in the labsheet or SDS/SRS. Is that from
  the assignment brief somewhere else, or your own recommendation for testability?"*

**Answer, now that the actual official labsheet PDF has been supplied and read in full:** both
values are in the real labsheet, not a separate style guide. The Zen Green hex values are
`Lab_02_labsheet.pdf` §7 "Zen Green Theme UI Specification" (page 8), a literal token table. The
seed counts are `Lab_02_labsheet.pdf` §5.3 "Required Seed Data" (pages 6–7): "at least four active
Development Requesters," "at least one inactive Development Requester," "the four required Ticket
Categories," "at least six realistic Related Systems." Both questions were correct to ask — the
values genuinely were not derivable from the lecture-slide PDF or the SDS/SRS drafts that were the
only source material available at the time the second-pass corrections were written. See
`ai-use.md` for how that gap happened.

## Review round 3 — commit `0638c582`

**ArmmyC, CHANGES_REQUESTED** (2026-08-21T19:44:11Z)

> "Requesting changes. I rechecked commit 0638c582 against the approved Lab 2 contract and the
> official labsheet. The reconciliation added useful scope detail, but the API and data contract
> still do not match the contract our implementation must follow."

Five more corrections requested, all against `api-spec.md`/`specification.md`/`tests.md`:

1. Align `api-spec.md` with the approved public interface — drop the `/api/v1`, `/api/v1/dev/session`,
   `/api/v1/me`, `x-dev-user-id` authentication-shaped surface; use `/api/...` endpoints with a
   visible selector backed by `toktickit.developmentRequesterId` and explicit `requesterId`
   query/body fields as test context only, not an auth protocol.
2. Replace the wire formats and status rules with the approved shape — safe error string plus
   optional `fieldErrors`, list responses with `items/page/pageSize/totalItems/totalPages/
   hasNext/hasPrevious`, statuses limited to 400/404/409/413/415/500 (foreign and removed
   resources both return the same safe 404); drop the nested error object, `data`/`meta`
   pagination, and 401/403/422/410.
3. Remove out-of-scope fields — no `User`/`TicketEvent` models, no audit-event requirement, no
   authenticated-download semantics, no `owner`/`resolutionSummary` fields, no
   requestedPriority-copies-to-IT-Priority rule; IT Priority stays nullable/read-only; the ticket
   number format is `TKT-UTCYEAR-######`, not `TKT-YYYY-NNNNN`.
4. Correct field rules to match the approved contract: summary 5-120 chars, description
   10-4000 chars, required active Related System on create, removal reason 5-500 chars,
   unsupported attachment type returns 415.
5. Fix `tests.md` paths — entries like `client/.../lab-02 tests/...` are placeholders, not real
   repository paths; use the real paths under `client/tests/lab-02` and verify every acceptance
   criterion maps to a real test file and scenario.

This round is the direct source of two defects that persisted into this document set until the
present reconciliation pass caught them: the placeholder test-file paths in `tests.md` §2, and the
ticket-number format inconsistency between `api-spec.md` and the implementation.

## Review round 4 — this reconciliation pass

Not submitted to GitHub as a formal review round (this reconciliation pass predates PRs #18-#30,
which is where the actual implementation and further peer review happened — see "Lab 2 W4 pull
requests" below). This document, and the rest of `docs/lab-02/`, are being reconciled against the
real labsheet in one pass that:

- restructures `specification.md` and `tests.md` into the labsheet's exact required section
  layout (§8.10, §16);
- removes the stale "three tabs (Attachments, Service Actions, Event Log)" description that
  survived in `tests.md`, the (now-deleted) `traceability-matrix.md`, and
  `features/feature-d-ticket-detail.md` after round 2 had already removed those tabs from
  `specification.md`/`api-spec.md` — an internal-consistency gap this pass closes;
- fills the `ui-spec.md` gaps the labsheet's Appendix C checklist requires (full button hierarchy,
  explicit attachment states, screenshot-path convention, the exact Development Requester
  Selection screen layout);
- adds this file and `ai-use.md`, the two required files the labsheet's §12 structure lists that
  did not exist yet;
- folds `traceability-matrix.md` into `tests.md` §3, since the labsheet's Appendix B template
  puts acceptance-criterion traceability inside `tests.md` and does not list a separate
  traceability-matrix file.

A draft top-level PR comment and draft replies to the five open round-2 threads are prepared in
the working session for the repository owner to review before posting — see the session record;
they are not auto-posted.

## Approvals

PR #14 itself was never formally APPROVED — it received three CHANGES_REQUESTED rounds from
ArmmyC (2026-08-21, commits `bac2fee`/`5bdbdda`/`0638c582`) and was merged on 2026-08-25 once the
specification set matched the real labsheet, without a fourth review round being requested. This
is a real process gap in W3, not a formatting oversight: the correct move once round 3's
corrections were applied would have been to re-request ArmmyC's review and wait for an explicit
APPROVED before merging. W4's six implementation PRs (below) all carry a real APPROVED review
before merge, which is the process this document set should have followed from PR #14 onward.

## Lab 2 W4 pull requests (Issues #19–#24)

Reviewer identity, PR links, and approvals for the six implementation PRs that shipped the
requester-facing UI (App Shell, Attachment backend, Create Ticket UI, My Tickets, Ticket Detail
and Attachments UI, and E2E/visual verification). Compiled from
`gh pr view <n> --repo Bank848/toktickit --json reviews`, not from memory. All six merged into
`lab2-staging`.

| PR | Issue | Title | Reviewer | Verdict |
|---|---|---|---|---|
| [#18](https://github.com/Bank848/toktickit/pull/18) | #19 | App shell, routing, and Development Requester selection | N0M3KM | APPROVED |
| [#25](https://github.com/Bank848/toktickit/pull/25) | #20 | Attachment storage and lifecycle backend | N0M3KM | APPROVED |
| [#26](https://github.com/Bank848/toktickit/pull/26) | #21 | Create Ticket UI | Jinnakan | APPROVED |
| [#27](https://github.com/Bank848/toktickit/pull/27) | #22 | My Tickets | N0M3KM | APPROVED |
| [#28](https://github.com/Bank848/toktickit/pull/28) | #23 | Ticket Detail and Attachments UI | N0M3KM | CHANGES_REQUESTED, CHANGES_REQUESTED, APPROVED |
| [#29](https://github.com/Bank848/toktickit/pull/29) | #24 | Lab 2 E2E and visual verification | TauForge | APPROVED |

PR #28 is the one substantive review round of Lab 2 W4. N0M3KM's first review found a real bug:
the attachment-removal dialog's keyboard focus trap captured its list of focusable elements once,
in a `useEffect` that didn't re-run when the Remove button's disabled state changed, so Remove
silently dropped out of the Tab cycle even after becoming enabled.

> N0M3KM, CHANGES_REQUESTED (2026-09-01T16:24:47Z, commit `a4a5ced`): "Some issue, I found. Please
> recheck."

Fixed in commit `8e7fb65` — the focus trap now re-queries focusable elements on every Tab press
instead of caching a stale snapshot — with a new regression test covering exactly that scenario
(`client/tests/lab-02/RemovalConfirmDialog.test.tsx`).

> N0M3KM, CHANGES_REQUESTED (2026-09-01T16:29:09Z, commit `a4a5ced`): "Sorry this one"

This second review is a duplicate of the first, pinned to the same pre-fix commit (`a4a5ced`) —
confirmed by comparing `submitted_at`/`commit_id` across both reviews via the GitHub API, not a
new finding. Once N0M3KM re-reviewed against the fix commit, it was approved:

> N0M3KM, APPROVED (2026-09-01T16:33:52Z, commit `8e7fb65`): "Ok!! everything seems great now.
> Ready to merge :)"

PR #29's review came from a repository collaborator account:

> TauForge, APPROVED (2026-09-01T17:28:47Z, commit `b63aa79`): "The E2E coverage, responsive
> testing, and bug fixes look solid."

## Lab 2 release pull request

- **PR #30 — "Lab 2: TokTickIT Requester Ticketing (W3 + W4)"**
  https://github.com/Bank848/toktickit/pull/30
- Branch: `lab2-staging` → `main`. 51 commits, 122 files changed. Covers the entire Lab 2 delivery
  (W3 Feature B/Create Ticket plus all four W4 features).

> TauForge, APPROVED (2026-09-01T17:34:53Z, commit `1220350`): "Looks good to me. The full Lab 2
> implementation, E2E coverage, and test results look solid."

Merged into `main` at `ef4f08c` (2026-09-01T17:36:08Z).

## Lab 2 UI redesign pull request

Post-submission follow-up: the merged W3+W4 delivery implemented all required functionality but
did not apply `ui-spec.md`'s Zen Green theme anywhere (no Bootstrap classes on any input, button,
or label, despite `bootstrap.min.css` being imported). This PR closes that gap. Same staging-branch
pattern as `lab2-staging`: `ui-redesign-staging` was branched off `main`, and this PR merges the
restyle work into it; `ui-redesign-staging` → `main` is a separate release PR, not yet opened.

- **PR #31 — "Apply Zen Green design system across the client"**
  https://github.com/Bank848/toktickit/pull/31
- Branch: `feature/ui-redesign-zen-green` → `ui-redesign-staging`. 4 commits, 15 files changed
  (+1212/-677).

> TauForge, APPROVED (2026-09-02T10:16:41Z, commit `869ab11`): "the Zen Green restyle and the
> follow-up fixes look good, and the test/TypeScript checks are clean."

Merged into `ui-redesign-staging` at `517343a` (2026-09-02T10:56:29Z).
