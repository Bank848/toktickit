# Lab 4 AI Use

**LLM used:** Claude Code (terminal agent). For Issue #57 the work was done by a Claude Sonnet 5.5
sub-agent that a coordinating Claude Opus 5.5 session started with a written brief. The models used
for Issues #52 to #56 were not recorded in this repository and are not restated here; their prompts
and sessions are not reconstructed in this file.

This file covers Issue #57 (final hardening and regression) only, because those are the sessions
whose transcript was available when it was written. Each entry below can be checked against the
commit history of `feature/57-final-hardening` or the test output named in it.

## Key prompts

| # | Prompt (paraphrased) | Purpose and result |
|---|---|---|
| 1 | "Open one draft PR for Issue #57 from a separate worktree. Run the full server and client suites plus the Lab 1-3 regression and fix only real regressions. Add E2E specs for E2E-01 to E2E-05 and the visual rows, run them in Microsoft Edge with a temporary config that is not committed. Do not mark a checklist item true without evidence." | The task brief for the whole issue. Set the scope and the rule that tests.md rows become Done only when the test exists and passes. |
| 2 | "Use a throwaway PostgreSQL 18 cluster on port 5547 with trust auth on 127.0.0.1, pass DATABASE_URL through the environment only, run the server suite with a 60 second test timeout, and stop the cluster at the end." | Test environment. Two Lab 3 seed tests exceed Vitest's 5 second default on this machine, so the longer timeout was needed. The migration recovery test also needed `--hookTimeout=180000` once; the config was not changed. |
| 3 | "Add an automated accessibility check for the new screens (CMP-33) and a performance smoke test (PERF-01)." | `client/tests/lab-04/a11y.test.tsx` uses axe-core in jsdom with the color-contrast and region rules disabled, because jsdom has no layout. `server/tests/lab-04/performance.smoke.test.ts` seeds 2,000 Tickets and 5,000 Action Taken records and asserts p95 under 500 ms with a constant query count. |
| 4 | "Write the Playwright specs for E2E-02, E2E-04, E2E-05 and E2E-07 and review every screenshot at 375, 768 and 1280 px." | `e2e/lab-04/*.spec.ts`. Bugs found while getting them to run: a regex escape lost inside a template literal (`\d`), a 401 console error from the by-design `/api/v1/me` probe on the login screen (filtered in the console collector), and 30 second default timeouts on slow first renders. The dashboard checks compare card counts with independent API results so they stay valid when the Lab 2 and 3 specs add data. |
| 5 | "The disk is full. Stop and report; do not delete anything." | C: filled up during the run. Work stopped and was reported. After the owner freed space the work resumed. |
| 6 | "Resume #57: restart the throwaway Postgres, run the Lab 4 E2E in Edge, finish E2E-02/04/05/06/07, review screenshots, write reviewer.md and ai-use.md, document the Unassigned-card limitation, push and open a draft PR." | Continuation brief. |
| 7 | "Run the full Playwright suite (Lab 1-3 plus Lab 4) and explain any failure." | The first full run in Edge had failures in Lab 2 and Lab 3 specs. Cause for the Lab 3 specs: Lab 4 intentionally lands every role on a dashboard (FR-10), and Resolved now needs an Action Taken (FR-06). The Lab 3 specs were updated for exactly those two changes. The Lab 2 spec still opens `/select-requester`, a page that Lab 3 removed from the client; it was left unchanged and is recorded as a pre-existing failure in `tests.md` section 5. |
| 8 | "Pull the full review history from the GitHub API for the Sprint 4 pull requests and build reviewer.md from the data." | `docs/lab-04/reviewer.md`. The data shows #58 merged without an APPROVED review, and this is stated as is. |

## My Reflection

The part of this issue that needed the most care was deciding what counts as a regression. The
first full Playwright run failed in six Lab 2 and Lab 3 scenarios in each viewport project (18 in total), and the easy
reading was "Lab 4 broke Lab 3". Reading each failure showed three different causes. The Lab 3
login and permission specs expected to land on the ticket list, and the Lab 3 status flow expected
to reach Resolved with no Action Taken; both are behaviour that Lab 4 changes on purpose, so the
specs were updated in the same way the server test table was extended earlier in the sprint. The
Lab 2 spec failed for a reason older than Lab 4: it drives a Development Requester selector that
Lab 3 removed. Fixing that spec would have meant rewriting a Lab 2 test, so it was documented
instead of silently changed, and the pass count claim for E2E-06 was written to match what the run
showed rather than the wording "same pass count as before Lab 4".

A second point was evidence. Screenshots were each opened and looked at before any checklist item
was ticked, and test-plan rows were moved to Done only after the tests had run on the commit being
shipped. Two items stay open in `tests.md` because the spec does not settle them: API-47 needs a
migration for a status-change event, and the Unassigned card excludes Closed and Cancelled Tickets
while its link lists every status. Both are documented as known limitations and the behaviour was
not changed.
