# Peer Review Evidence — Lab 1

- **My name:** สิทธิชัย ภิรมย์ปั่น
- **My student ID:** 67070501074
- **My GitHub username:** Bank848
- **Repository:** https://github.com/Bank848/toktickit

## My reviewer (reviewed my Pull Requests)

- **Assigned peer partner:** นายรัฐธรรมนูญ บูรณพัฒนา, Student ID 67070501037, GitHub username TauForge
- **Other reviewer:** นายกมลภพ วิทยารัฐ, Student ID 67070501002, GitHub username ArmmyC — reviewed PR #5 and #6
- **PR links reviewed and by whom:**
  - https://github.com/Bank848/toktickit/pull/5 — reviewed by ArmmyC (นายกมลภพ วิทยารัฐ, 67070501002) and N0M3KM (TauForge was not requested on this PR)
  - https://github.com/Bank848/toktickit/pull/6 — reviewed by ArmmyC (นายกมลภพ วิทยารัฐ, 67070501002) (TauForge was not requested on this PR)
  - https://github.com/Bank848/toktickit/pull/7 — reviewed by TauForge
  - https://github.com/Bank848/toktickit/pull/8 — reviewed by TauForge
  - https://github.com/Bank848/toktickit/pull/9 — reviewed by TauForge
- **Review comments received and my response:**
  - PR #5 (project foundation) — **ArmmyC** requested changes: "I reviewed this foundation PR against Issue #1. I cannot approve it yet. 1. Server test setup is incomplete. `server/package.json` declares only `@types/supertest`, not the runtime `supertest` package, and the PR adds no `server/tests/**/*.test.ts` file... 2. The README documents work that is not in this branch. It tells users to run `npx prisma db seed`, but there is no `server/prisma/seed.ts`..." **N0M3KM** also commented: "The code is clean and organized, but I have a small request. According to the required repository structure, the tests/lab-01 directory should be inside the server folder. It looks like this commit is missing those folders. Could you please add them?" I responded in commit `21ce25a` by adding the runtime `supertest` dependency and a smoke test at `server/tests/lab-01/app.test.ts`, and by trimming the README back to only the foundation scope. ArmmyC then re-reviewed and approved: "I re-reviewed the updated foundation PR at 21ce25a. The requested fixes are complete... Approved." N0M3KM's review was dismissed once the same fix landed.
  - PR #6 (health check) — **ArmmyC** approved: "I reviewed PR #6 against Issue #2. The API exposes GET /api/health with HTTP 200 and the required JSON response, and the Supertest test verifies it. The React page makes a real health-check request and handles loading, success, and backend-unavailable error states. The README is scoped to this feature. Approved." No changes requested.
  - PR #7 (Category model, migration, seed) — **TauForge**: "LGTM. Checked the schema, migration, seed, and README. Everything looks good and matches the changes in this PR. No issues from my side. Approved." No changes requested, so the PR merged as submitted.
  - PR #8 (Category list API + UI) — **TauForge** approved with no inline comments, then followed up on the issue thread: "LGTM. Checked the API, UI, and tests. Everything looks good and matches the requirements of this PR. No issues from my side. Approved." No changes requested.
  - PR #9 (promote lab1-staging to main) — **TauForge**: "Checked the changes and the lab documentation. Everything looks good and the previous PR changes are included correctly. No issues from my side. Approved." No changes requested.

TauForge was not assigned as a reviewer on PR #5 or #6 (confirmed via GitHub's `requested_reviewers` and timeline API — only ArmmyC and N0M3KM were requested on those two). TauForge became my requested reviewer starting with PR #7 onward.

## Who I reviewed (reviewed my partner's Pull Requests)

- **Name:** นายรัฐธรรมนูญ บูรณพัฒนา
- **Student ID:** 67070501037
- **GitHub username:** TauForge
- **Repository:** https://github.com/TauForge/TokTickIT
- **PR links I reviewed:**
  - https://github.com/TauForge/TokTickIT/pull/5
  - https://github.com/TauForge/TokTickIT/pull/6
  - https://github.com/TauForge/TokTickIT/pull/7
  - https://github.com/TauForge/TokTickIT/pull/8
  - https://github.com/TauForge/TokTickIT/pull/9
- **A real comment I gave them, and how they responded:**
  - PR #5 (project foundation) — I approved with: "clean foundation setup, scoped to just issue 1 as intended with no category or health code sneaking in early. workspaces docker prisma and tests all wired up. approving." No changes requested.
  - PR #6 (health check) — I approved but left an inline note on `client/src/App.tsx`: "the api url is hardcoded to localhost:3000, worth pulling from an env var or a vite proxy later so this doesn't break outside local dev. also no fetch timeout so a hung request just sits on checking forever." TauForge addressed it in commit `694e0ef`: the client now reads `VITE_API_BASE_URL` from `client/.env` (with a `.env.example` added), health requests use an `AbortController` with a 5-second timeout and a dedicated timeout message, and they added Vitest coverage for the timeout case.
  - PR #7 (category model, migration, seed) — I approved with: "Clean, scoped change: Prisma Category model + migration + idempotent seed (upsert), matches the PR description. No issues found." TauForge replied: "Thanks for the review. I confirmed the Category model, migration, and idempotent upsert seed match Issue 3 acceptance criteria. No changes were needed from the review."
  - PR #8 (category list API + UI) — I approved with: "Solid implementation: /api/categories endpoint with proper Prisma client reuse and error handling, frontend fetch with response shape validation + loading/error states, and matching test coverage on both sides. No issues found." No changes requested.
  - PR #9 (promote lab1-staging to main) — I approved with: "Promotion PR consolidating the already-reviewed and merged Issue 1-4 changes (PRs #5-#8) from lab1-staging to main. No new content beyond what was previously reviewed. No issues found." No changes requested.
