# Lab 3 Reviewer Record

Reviewer identity, PR links, comments given and received, responses, and approvals, per the
labsheet's Part 1 "Git Use with Engineering Workflow" submission requirement. To be compiled
directly from the GitHub API against each Lab 3 PR (`gh api repos/Bank848/toktickit/pulls/<n>/
reviews` and `.../comments`), not from memory — same discipline `docs/lab-02/reviewer.md` used.

**Do not fill this file in from memory or paraphrase at submission time.** Re-run the `gh api`
commands below fresh and quote the actual review text, the same way `docs/lab-02/reviewer.md`
does.

## Reviewer identity

- **Reviewer:** `TauForge`
- **Author:** Bank848 (Bank, this repository's owner).

## Pull requests (Issues #35–#41)

| PR | Issue | Title | Reviewer | Verdict |
|---|---|---|---|---|
| [#44](https://github.com/Bank848/toktickit/pull/44) | #35 | Data model, migration, seed | TauForge | APPROVED |
| [#45](https://github.com/Bank848/toktickit/pull/45) | #36 | Authentication foundation | TauForge | APPROVED |
| [#46](https://github.com/Bank848/toktickit/pull/46) | #37 | Requester regression + Public Comments | TauForge | APPROVED |
| [#47](https://github.com/Bank848/toktickit/pull/47) | #38 | IT Staff Ticket Queue | TauForge | APPROVED |
| [#48](https://github.com/Bank848/toktickit/pull/48) | #39 | IT Staff Ticket Detail operations | TauForge | APPROVED |
| [#49](https://github.com/Bank848/toktickit/pull/49) | #40 | Administrator user management | TauForge | APPROVED |
| [#50](https://github.com/Bank848/toktickit/pull/50) | #41 | E2E, visual evidence, reviewer close-out | TauForge | APPROVED |

## Review rounds

No PR in this set received a CHANGES_REQUESTED round. Every PR was approved on its first review
pass. [#45](https://github.com/Bank848/toktickit/pull/45) carried non-blocking findings alongside
its approval:

> Non-blocking findings:
>
> - MEDIUM: timing side-channel user enumeration. In auth.ts around line 31, `verifyPassword`
>   only runs when the user exists (`user ? await verifyPassword(...) : false`), so an unknown
>   email returns faster than a known email with a wrong password even though the message is
>   identical. Suggest always calling verifyPassword with a fixed dummy hash when user is null so
>   timing doesn't leak account existence.
> - LOW: no rate limiting on /auth/login or /auth/change-password, brute-force is unmitigated.
>   Fine for a lab project, worth flagging for later.
> - LOW: no explicit CSRF token; SameSite=Lax covers most cases but isn't complete CSRF
>   protection.
> - NOTE: bcrypt cost factor 10 is a bit dated (12 is more common now), not a concern for a
>   student project.
>
> Approving since none of these are CRITICAL/HIGH, but flagging the timing side-channel as worth
> a follow-up fix.

Bank848's response (posted as a PR comment): agreed on the timing side-channel and tracked it as
a follow-up rather than blocking the merge; rate limiting and the bcrypt cost factor accepted as
known trade-offs for this lab project. The timing side-channel fix itself is not yet implemented.

## Approvals

Every Lab 3 PR (#44–#50, covering issues #35–#41) carries a real APPROVED review from TauForge
before merge. No PR in this set merged without one.

## Lab 3 release pull request

- **PR [#51](https://github.com/Bank848/toktickit/pull/51) — "Lab 3: TokTickIT Authentication, Staff Workflow, and Administration"**
- Branch: `lab3-staging` → `main`. 64 commits, 200 files changed.

`<Quote the release PR's APPROVED review verbatim once it lands, same as docs/lab-02/reviewer.md's
final section.>`
