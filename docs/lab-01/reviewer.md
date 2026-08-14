# Peer Review Evidence — Lab 1

- **My name:** สิทธิชัย ภิรมย์ปั่น
- **My student ID:** 67070501074
- **My GitHub username:** Bank848
- **Repository:** https://github.com/Bank848/toktickit

## My reviewer (reviewed my Pull Requests)

- **Name:** นายรัฐธรรมนูญ บูรณพัฒนา
- **Student ID:** 67070501037
- **GitHub username:** `TauForge`
- **PR links reviewed by them:**
  - [PR #7 — Create and seed IT request categories](https://github.com/Bank848/toktickit/pull/7) (merged)
  - [PR #8 — Display the IT request category list](https://github.com/Bank848/toktickit/pull/8) (merged)

**On [PR #7](https://github.com/Bank848/toktickit/pull/7) (2026-08-14, Approved):**

> "LGTM. Checked the schema, migration, seed, and README. Everything looks good and matches the changes in this PR. No issues from my side. Approved."

**My response:** No changes requested — merged into `lab1-staging`.

**On [PR #8](https://github.com/Bank848/toktickit/pull/8) (2026-08-14, Approved):**

Approved with no written comment beyond the approval itself; the implementation matched Issue #4's acceptance criteria as-is.

**My response:** No changes requested — merged into `lab1-staging`.

### Additional community review received

Two other classmates also reviewed PRs in this repo before my pairing with TauForge settled in on Issues 3-4 — real review activity worth keeping as evidence:

- **`ArmmyC`** requested changes on [PR #5](https://github.com/Bank848/toktickit/pull/5) (server test setup was incomplete and the README described work that wasn't in the branch yet). My response: added the runtime `supertest` dependency, added `server/tests/lab-01/app.test.ts`, and scoped the README down to just the foundation. ArmmyC re-reviewed and approved. ArmmyC also approved [PR #6](https://github.com/Bank848/toktickit/pull/6) directly, no changes requested.
- **`N0M3KM`** left a Changes Requested review on [PR #5](https://github.com/Bank848/toktickit/pull/5), pointing out that `server/tests/lab-01/` was missing. My response: this was fixed in the same commit that addressed ArmmyC's feedback; once `server/tests/lab-01/app.test.ts` existed I dismissed the stale review with a note explaining the fix.

## Who I reviewed (reviewed my partner's Pull Requests)

- **Name:** นายรัฐธรรมนูญ บูรณพัฒนา
- **Student ID:** 67070501037
- **GitHub username:** `TauForge`
- **Repository:** https://github.com/TauForge/TokTickIT
- **PR links I reviewed:**
  - [PR #5 — Issue 1: Set up the TokTickIT project foundation](https://github.com/TauForge/TokTickIT/pull/5) (merged)
  - [PR #6 — Issue 2: Implement the API health check](https://github.com/TauForge/TokTickIT/pull/6) (merged)
  - [PR #7 — Issue 3: Create and seed IT request categories](https://github.com/TauForge/TokTickIT/pull/7) (merged)
  - [PR #8 — Issue 4: Display the IT request category list](https://github.com/TauForge/TokTickIT/pull/8) (merged)
  - [PR #9 — Lab 1: Promote lab1-staging to main](https://github.com/TauForge/TokTickIT/pull/9) (merged)

**A real comment I gave them, and how they responded:**

On [PR #5](https://github.com/TauForge/TokTickIT/pull/5), I approved with: "clean foundation setup, scoped to just issue 1 as intended with no category or health code sneaking in early. workspaces docker prisma and tests all wired up. approving." — no changes needed, they merged as-is.

On [PR #6](https://github.com/TauForge/TokTickIT/pull/6), I approved with: "health endpoint and the checking/online/offline states are all covered with real tests. approving with one small note below not blocking." — a non-blocking note, so they merged without a follow-up round.

On [PR #7](https://github.com/TauForge/TokTickIT/pull/7), I approved with: "Clean, scoped change: Prisma Category model + migration + idempotent seed (upsert), matches the PR description. No issues found." — merged as-is.

On [PR #8](https://github.com/TauForge/TokTickIT/pull/8), I approved with: "Solid implementation: /api/categories endpoint with proper Prisma client reuse and error handling, frontend fetch with response shape validation + loading/error states, and matching test coverage on both sides. No issues found." — merged as-is.

On [PR #9](https://github.com/TauForge/TokTickIT/pull/9), I approved with: "Promotion PR consolidating the already-reviewed and merged Issue 1-4 changes (PRs #5-#8) from lab1-staging to main. No new content beyond what was previously reviewed. No issues found." — merged as-is.
