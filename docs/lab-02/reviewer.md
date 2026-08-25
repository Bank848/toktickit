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
- Status as of this document: **open**, three review rounds completed, changes requested each
  round; not yet approved.

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

## Review round 3 — this reconciliation pass

Not yet submitted to GitHub. This document, and the rest of `docs/lab-02/`, are being reconciled
against the real labsheet in one pass (commit pending) that:

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

None yet. PR #14 has received CHANGES_REQUESTED from ArmmyC in both completed rounds; no APPROVED
review exists as of this document.
