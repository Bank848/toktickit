# Lab 2 AI Use

**LLM used:** Claude (Claude Code), via the terminal-based agent CLI, across the whole Lab 2
lifecycle — specification/test-planning (Issues 5-8, the labsheet reconciliation), implementation
(Issues 19-23), and E2E/visual verification (Issue 24).

## Key prompts

| # | Prompt (paraphrased) | Purpose |
|---|---|---|
| 1 | "Draft `specification.md`, `ui-spec.md`, `api-spec.md`, and `tests.md` for Lab 2 from the SDS decision register and the SRS feature inventory, covering Requester ticket creation, My Tickets, Ticket Detail, and Attachments." | Initial spec-set creation (commits `19914c0`–`e7e593a`), before the real labsheet had been supplied to the session. |
| 2 | "Record the W3 interim coverage measurement in the test plan's Definition-of-Done section." | Capturing a real, dated test-run snapshot rather than an invented coverage number. |
| 3 | "ArmmyC requested changes on PR #14 citing an official labsheet, first against a lecture-slide PDF mistaken for the full labsheet and then, after five more inline comments, against the same incomplete source again — reconcile `specification.md`, `ui-spec.md`, `api-spec.md`, and the feature docs against all twelve review comments across both passes (search scope, Development Requester Selection screen, Zen Green tokens, comments removal, create-time attachments, soft-removal reason, full traceability matrix, RBAC removal, Service Actions/Event Log removal, numbered Acceptance Criteria and Definition of Done, explicit seed baseline, cited Zen Green hex source)." | Two correction passes (commits `5bdbdda`, `d7e803f`) against the wrong source document — this is the pass where two of Bank's own review replies had to ask "where does this number come from?" because the lecture deck genuinely didn't contain the answer. |
| 4 | "Here's the actual official labsheet PDF I forgot to upload earlier — read it in full and reconcile the whole `docs/lab-02/` set against it as the authoritative source, including two new required files (`reviewer.md`, `ai-use.md`) and the exact required file/section structure it specifies." | The task this document is part of: discovering the real source and redoing the reconciliation properly against it, rather than against the lecture deck. |
| 5 | "List every required section for `specification.md` and `tests.md` per the labsheet's Appendix A/B templates, and check the current drafts against that exact structure." | Structural gap analysis before rewriting — confirmed the existing content was substantively correct but organized differently, plus surfaced a real bug: `tests.md` and `traceability-matrix.md` still described Ticket Detail as having three tabs after `specification.md` had already removed two of them. |
| 6 | "Pull the full PR #14 review history via the GitHub API — every review, every inline comment, every reply — and build `reviewer.md` from the actual data, not from memory of the conversation." | Ensuring `reviewer.md` is a factual record rather than a reconstruction, per the labsheet's requirement that it show "reviewer identity, PR links, comments given and received, responses, and approvals." |
| 7 | "Fold `traceability-matrix.md` into `tests.md` §3 rather than keeping both, since the labsheet's Appendix B template puts AC traceability inside `tests.md` and doesn't list a separate matrix file — but don't delete anything until it's confirmed everything is carried over." | Deciding a structural question (keep vs. consolidate) against the source template rather than by habit. |
| 8 | "Implement Issue #24, Lab 2's E2E and visual verification: a dedicated Playwright config plus one spec covering the full requester flow, real screenshots, and honest doc updates." | W4-6 implementation. The background agent that started this Issue hung and never reported back; the work was resumed and finished directly against its worktree. |
| 9 | "The E2E suite times out waiting for the client dev server every single run — diagnose why, don't just retry." | Root-cause debugging rather than raising the timeout or restarting blindly. Found that Vite's `--mode e2e` bound to `localhost`, which resolves to the IPv6 loopback `::1` on this machine, while Playwright's `webServer` health check hit `http://127.0.0.1:5183` (IPv4) — the two never met, so every boot attempt spun for the full 120s. Fixed by pinning Vite to `--host 127.0.0.1`. |
| 10 | "Now that the servers boot, the spec itself fails three different ways per viewport — fix the real cause each time, not the symptom." | Three genuine bugs surfaced once the suite could actually run: (1) `AttachmentPicker` rendered a picked filename as a bare text node sibling to its Remove button, so no element's own text was ever exactly the filename and Playwright's exact-text match could never find it — fixed by wrapping the filename in its own `<span>`; (2) the spec's "Create Ticket" link locator matched both the persistent nav link and the My Tickets empty-state link, a strict-mode collision — fixed by scoping the locator to the nav landmark; (3) the spec assumed ticket detail URLs end in a numeric ID (`/\d+$/`) when the app actually routes on the ticket's UUID — fixed the regex to match a UUID instead of guessing the app was wrong. |

## My Reflection

The real lesson from this PR wasn't about writing specs — it was about source discipline. Two
correction passes (`5bdbdda`, `d7e803f`) were done entirely against `Lecture 3 - Lab 2.pdf`, the
lecture slide deck, because that was the only PDF available in the session at the time and it
looked authoritative enough (it has the Zen Green screenshot, the role table, the general shape of
the assignment). It wasn't the actual labsheet, and it was missing entire sections — the exact
Zen Green hex values, the exact seed-data counts, the required file structure, the exact
`specification.md`/`tests.md` templates, and the `reviewer.md`/`ai-use.md` requirement didn't
exist in it at all. The reviewer's questions in round 2 ("where does this number come from?")
were answered honestly at the time ("I don't see it in the source I have — is there another
document?") instead of inventing a plausible-sounding citation, which in hindsight was the right
call: it left a clean paper trail showing exactly where the gap was, so when the real labsheet
showed up it was straightforward to go back and answer both questions for real instead of quietly
overwriting a fabricated source.

The working pattern that held up well across all three passes was treating the labsheet (once it
existed) as strictly authoritative and re-reading it in full before touching any file, rather than
patching individual review comments in isolation — that's what caught the stale "three tabs"
description that had survived two correction passes inside `tests.md` and the old
`traceability-matrix.md` even after `specification.md` and `api-spec.md` had already dropped
Service Actions and Event Log. A comment-by-comment patch loop would very plausibly have left that
inconsistency in place indefinitely, since no single review comment pointed at `tests.md`
specifically for that issue.
