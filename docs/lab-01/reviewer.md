# Peer Review Evidence — Lab 1

- **My name:** นายกมลภพ วิทยารัฐ
- **My student ID:** 67070501002
- **My GitHub username:** Bank848
- **Repository:** https://github.com/Bank848/toktickit

## My reviewer (reviewed my Pull Requests)

- **Name:** [FILL IN: ArmmyC's real name]
- **Student ID:** [FILL IN: ArmmyC's student ID]
- **GitHub username:** `ArmmyC`
- **PR links reviewed by them:**
  - [PR #5 — Set up the TokTickIT project foundation](https://github.com/Bank848/toktickit/pull/5) (merged)
  - [PR #6 — Implement the API health check](https://github.com/Bank848/toktickit/pull/6) (merged)

**On [PR #5](https://github.com/Bank848/toktickit/pull/5) (first pass, 2026-08-13, Changes Requested):**

> "I reviewed this foundation PR against Issue #1. I cannot approve it yet.
> 1. Server test setup is incomplete. `server/package.json` declares only `@types/supertest`, not the runtime `supertest` package, and the PR adds no `server/tests/**/*.test.ts` file... 2. The README documents work that is not in this branch. It tells users to run `npx prisma db seed`, but there is no `server/prisma/seed.ts`... Please address these points and request my re-review."

**My response:** Added the runtime `supertest` dependency, added a server smoke test at `server/tests/lab-01/app.test.ts`, and rewrote the README to describe only what the foundation branch actually contains, moving the seed instructions to a later feature PR.

**On [PR #5](https://github.com/Bank848/toktickit/pull/5) (re-review, 2026-08-13, Approved):**

> "I re-reviewed the updated foundation PR at 21ce25a. The requested fixes are complete... The implementation satisfies Issue #1's acceptance criteria. Approved."

**My response:** No further changes needed — merged into `lab1-staging`.

**On [PR #6](https://github.com/Bank848/toktickit/pull/6) (2026-08-14, Approved):**

> "I reviewed PR #6 against Issue #2. The API exposes GET /api/health with HTTP 200 and the required JSON response, and the Supertest test verifies it... The README is scoped to this feature."

**My response:** No changes requested — merged into `lab1-staging`.

### Additional community review received

Two other classmates also reviewed PRs in this repo (not my assigned partner, but real review activity worth noting):

- **`N0M3KM`** left a Changes Requested review on [PR #5](https://github.com/Bank848/toktickit/pull/5), pointing out that `server/tests/lab-01/` was missing. My response: added it in the same fix that addressed ArmmyC's feedback. Once `server/tests/lab-01/app.test.ts` existed, I dismissed the stale review with a note explaining the fix, since the concern was already resolved by that point.
- **`TauForge`** approved [PR #7](https://github.com/Bank848/toktickit/pull/7) and [PR #8](https://github.com/Bank848/toktickit/pull/8) ("LGTM. Checked the schema, migration, seed, and README. Everything looks good and matches the changes in this PR.").

## Who I reviewed (reviewed my partner's Pull Requests)

- **Name:** [FILL IN: ArmmyC's real name]
- **Student ID:** [FILL IN: ArmmyC's student ID]
- **GitHub username:** `ArmmyC`
- **PR links I reviewed:** [FILL IN: links to ArmmyC's PRs in their own `toktickit` repo]
- **A real comment I gave them, and how they responded:** [FILL IN — this happened in ArmmyC's repository, not this one, so it isn't visible from here]

---

**Gaps flagged for you to fill in:** your real name and student ID, ArmmyC's real name and student ID, and the review you left on ArmmyC's own PRs (that activity lives in their repository, not this one). Everything else above is pulled directly from the actual review comments on this repo.
