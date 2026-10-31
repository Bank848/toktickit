# Lab 4 Reviewer Record

Reviews given and received during Sprint 4, compiled from the GitHub API on 2026-10-31
(`gh api repos/<owner>/<repo>/pulls/<n>/reviews`, `.../pulls/<n>/comments` and
`.../issues/<n>/comments`). Review text is quoted or summarised from those responses, not from memory.
Counts and states are the GitHub review states as returned (`APPROVED`, `CHANGES_REQUESTED`,
`COMMENTED`).

## Reviewer identity

- Author of the Lab 4 pull requests in this repository: Bank848 (Bank).
- Reviewers of those pull requests: ArmmyC (#58, #59) and TauForge (#60, #61, #62, #63).
- Release PR into `main`: [#64](https://github.com/Bank848/toktickit/pull/64), reviewer ArmmyC requested.
- Reviews written by Bank848 on teammates' Lab 4 pull requests: see "Reviews given" below.

## Reviews received (Bank848/toktickit, base `lab4-staging`)

| PR | Issue | Title | Reviewer | Reviews (in order) | Merged |
|---|---|---|---|---|---|
| [#58](https://github.com/Bank848/toktickit/pull/58) | #52 | docs(lab-04): Sprint 4 engineering contract | ArmmyC | 6 x CHANGES_REQUESTED (2026-10-08 to 2026-10-29), 12 x COMMENTED, then APPROVED (2026-10-30) | yes |
| [#59](https://github.com/Bank848/toktickit/pull/59) | #53 | feat(lab-04): Action Taken foundation (model, migration, seed, API) | ArmmyC | 3 x CHANGES_REQUESTED, then APPROVED (2026-10-30) | yes |
| [#60](https://github.com/Bank848/toktickit/pull/60) | #54 | feat(lab-04): Action Taken UI | TauForge | APPROVED (2026-10-31) | yes |
| [#61](https://github.com/Bank848/toktickit/pull/61) | #55 | feat(lab-04): ticket resolution gate | TauForge | APPROVED (2026-10-31) | yes |
| [#62](https://github.com/Bank848/toktickit/pull/62) | #56 | feat(lab-04): role dashboards | TauForge | APPROVED (2026-10-31) | yes |
| [#63](https://github.com/Bank848/toktickit/pull/63) | #57 | feat(lab-04): final hardening and regression | TauForge | APPROVED (2026-10-31) | yes |

#58 was merged on 2026-10-30 after ArmmyC's final review, an APPROVED review on head `18266aa` dated
2026-10-30T07:38:19Z. That review says the stale-update and test-path findings are fixed, the PR is
linked to Issue #52 and contains only the four files of the issue, and accepts D-07 as a documented
team interpretation based on the handout context. An earlier version of this record said #58 had no
APPROVED review; that was wrong, it was written from data pulled before the approval was read.

### PR #58 (contract and test plan)

ArmmyC's first review (2026-10-08) had eight inline findings and one note in the review body. In summary:

1. Stale updates: no precondition on status changes or Action Taken edits (P1).
2. Migration recovery: no documented or tested rollback (P1).
3. Test plan marked rows Done although no test files existed (P1).
4. Network retries: a second POST could create a duplicate Action Taken (P1).
5. No performance-smoke test and no named UI-style coverage (P2).
6. Append-only behaviour: the contract allowed edits but did not record an approved reading (P2).
7. Unstable ordering on equal timestamps (P2).
8. Index count did not match the listed indexes (P2).
Review body: the PR also contained an internal plan HTML file outside the issue's four-file scope.

Bank848 replied on each thread on 2026-10-29 (commit `9635794`) and in a PR comment. Responses in
short: `If-Match` on Action Taken edits (428 when missing, 409 `STALE_UPDATE` on mismatch);
`Idempotency-Key` on create with a unique constraint; a `down.sql` plus `pg_dump` recovery step with
test API-44; every row shows its owning issue until the file exists and passes; PERF-01 added with
CMP-33 and E2E-07 named as the UI-style coverage; secondary ordering key `id`; index list named; the
internal plan file removed. For the append-only point, Bank848 recorded the team's reading as D-07
(Public Comments, Internal Notes and the TicketEvent trail are append-only; Action Taken stays
editable with a frozen performer and a logged edit) and asked ArmmyC to confirm or correct it.
ArmmyC's later reviews state that no instructor-approved decision for D-07 was found. The final
review accepts D-07 as a documented team interpretation. The Development-panel link for Issue #52 was added after the
first review, as requested.

Later rounds (2026-10-29): ArmmyC reported the issue link, target branch and file scope as fixed,
then raised remaining contract points: mapping of the handout's minimum test file paths, and the
requirement that status updates without `If-Match` be refused. Both were handled before merge.

### PR #59 (Action Taken foundation)

Three P2 findings in the first review, all fixed in `a1bbd9a` with a reply on each thread:

- Terminal-status check and the write were not in one transaction. Fix: `SELECT ... FOR UPDATE` on
  the Ticket row inside the transaction for create and edit, with a 409 `TICKET_LOCKED` re-check.
- `new Date()` accepted non-ISO and zone-less `actionAt` values. Fix: strict ISO 8601 with `Z` or an
  offset, impossible dates rejected, new validator cases.
- The recovery test did not use `pg_dump`. Fix: API-44 exports with `pg_dump`, reapplies the
  migration and restores with `psql`.

The second review found three more points, fixed in `70ac1c3`: Administrators were rejected by the
shared staff gate, API-35 had no Attachment fixture, and the race tests used a fixed 500 ms wait
(replaced by polling `pg_stat_activity` for a backend waiting on the row lock). The third review
asked for finished Issue #53 rows in `tests.md` to be marked Done, which was fixed in `692e4c8`. The
fourth review is APPROVED. The `actionAt` offset question was recorded in `api-spec.md` and tested
by API-52.

### PRs #60 to #63

Each carries one APPROVED review from TauForge with no inline comments and no requested changes.
Bank848 added one PR comment on each. On #61 the comment states that API-47 (exactly one
TicketEvent per status change) was left open because it needs a migration for a status-change event
type. On #62 the comment states that the Unassigned card excludes CLOSED and CANCELLED Tickets while
its `ownerId=unassigned` link lists every status, so the card number can be lower than the list
total, and that the behaviour was left unchanged. Both items are carried into `docs/lab-04/tests.md`. #63 (final hardening) got one APPROVED review from
TauForge on 2026-10-31. The review text quoted test counts and fixes from TauForge's own PR #56
(406 server tests, owner select, checkbox CSS), so Bank848 posted a comment with the real numbers for
#63: 375 server tests, 219 client tests, 45 of 54 Playwright scenarios passing.

## Reviews given

Reviews written by Bank848 on Lab 4 pull requests in two other repositories. All were
`lab4-staging` unless noted.

| Repository | PR | Title | Reviews by Bank848 |
|---|---|---|---|
| ArmmyC/CPE334-TokTickIT-Lab1 | [#71](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/71) | docs: define Lab 4 engineering contract and test plan | APPROVED, 9 inline comment reviews, APPROVED, APPROVED |
| ArmmyC/CPE334-TokTickIT-Lab1 | [#72](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/72) | feat(lab4): add Actions Taken API and persistence | APPROVED, APPROVED |
| ArmmyC/CPE334-TokTickIT-Lab1 | [#73](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/73) | Implement Ticket workflow transitions and resolution rules | APPROVED |
| ArmmyC/CPE334-TokTickIT-Lab1 | [#74](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/74) | feat(lab4): add Actions Taken ticket UI | APPROVED, APPROVED (after fix) |
| ArmmyC/CPE334-TokTickIT-Lab1 | [#75](https://github.com/ArmmyC/CPE334-TokTickIT-Lab1/pull/75) | Add authoritative Requester and IT Staff dashboards | APPROVED |
| TauForge/TokTickIT | [#49](https://github.com/TauForge/TokTickIT/pull/49) | feat: Actions Taken foundation | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#50](https://github.com/TauForge/TokTickIT/pull/50) | feat: Ticket workflow and resolution gate | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#51](https://github.com/TauForge/TokTickIT/pull/51) | feat: Requester and IT Staff dashboard APIs | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#52](https://github.com/TauForge/TokTickIT/pull/52) | feat: Actions Taken UI and workflow feedback | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#53](https://github.com/TauForge/TokTickIT/pull/53) | feat: Staff and Requester dashboards UI and navigation | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#54](https://github.com/TauForge/TokTickIT/pull/54) | feat: Hardening, accessibility, E2E specs, screenshots, README | COMMENTED, APPROVED |
| TauForge/TokTickIT | [#55](https://github.com/TauForge/TokTickIT/pull/55) | Lab 4 release PR into main | APPROVED, plus one PR comment |
| TauForge/TokTickIT | [#56](https://github.com/TauForge/TokTickIT/pull/56) | fix: owner select, checkbox size, final test status and evidence | APPROVED |
| TauForge/TokTickIT | [#57](https://github.com/TauForge/TokTickIT/pull/57) | Lab 4: final polish and evidence into main | APPROVED |

The reviews on #49 to #54 first appeared as COMMENTED reviews listing fixes to make, and were
followed by an APPROVED review once Bank848 had checked the fix commits. Examples of what was
raised:

- #71: the contract said the student approved it while several sections still said pending; a
  Ticket with a real follow-up could never be resolved if every Action Taken needed
  `followUpRequired = false`; which writes bump `Ticket.version`; whether a Cancelled Ticket accepts
  Action Taken writes. The author's fixes were checked and the threads marked resolved.
- #72 and #73: checked the migration, row locking and the idempotency path; noted that
  `expectedVersion` in the body differed from the contract in a different repository's #52. The
  author answered that the comparison had been made against the other contract, and Bank848
  approved again against #71.
- #74: the retry key was created inside the submit handler, so a lost response followed by a retry
  would create a second Action Taken. Fixed in `9aece87`, then approved again.
- #75: the Actions Taken by Me card counts records while its link lists Tickets, so the two can
  differ. Recorded as a non-blocking note.
- TauForge #49: terminal-status check outside the write transaction; idempotency lookup not scoped
  by ticket. #50: spec said 404, API spec and code said 403; `resolved-indication` bumped
  `Ticket.version`. #51: status filter accepted only `NEW`; the My Open card had no matching
  filter. #52: Reload then Save could overwrite another editor's change; `actionAt` truncated to the
  minute. #53: drill-down links did not match their cards; URL filters read only on first mount.
  #54: README out of date, a focus test that could not fail, VISUAL-01 marked Pass without all
  evidence, and server behaviour changes in a hardening PR.
- One correction by the reviewer: on #52 Bank848 withdrew an earlier note about two controls
  without accessible names because it could not point to specific controls.

## Approvals

Every pull request of this repository merged in Sprint 4 has an APPROVED review in the pulled data:
#58 and #59 from ArmmyC, #60 to #63 from TauForge. #58 and #59 each went through several
CHANGES_REQUESTED rounds first. The release PR [#64](https://github.com/Bank848/toktickit/pull/64)
(`lab4-staging` into `main`) is open and waiting for review.
