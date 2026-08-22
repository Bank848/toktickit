# Lab 2 AI Use

**LLM used:** Claude (Claude Code), via the terminal-based agent CLI, across the whole
specification/test-planning phase of Lab 2 (Issues 5–8 and this PR's reconciliation work).

## Key prompts

| # | Prompt (paraphrased) | Purpose |
|---|---|---|
| 1 | "Draft `specification.md`, `ui-spec.md`, `api-spec.md`, and `tests.md` for Lab 2 from the SDS decision register and the SRS feature inventory, covering Requester ticket creation, My Tickets, Ticket Detail, and Attachments." | Initial spec-set creation (commits `19914c0`–`e7e593a`), before the real labsheet had been supplied to the session. |
| 2 | "Record the W3 interim coverage measurement in the test plan's Definition-of-Done section." | Capturing a real, dated test-run snapshot rather than an invented coverage number. |
| 3 | "ArmmyC requested changes on PR #14 citing an official labsheet — reconcile `specification.md`, `ui-spec.md`, `api-spec.md`, and the feature docs against the seven review comments (search scope, Development Requester Selection screen, Zen Green tokens, comments removal, create-time attachments, soft-removal reason, full traceability matrix)." | First correction pass (commit `5bdbdda`) — working from the lecture-slide PDF (`Lecture 3 - Lab 2.pdf`), which was mistakenly treated as the full labsheet. |
| 4 | "ArmmyC left five more inline comments after the first correction — remove RBAC branches entirely, remove Service Actions and Event Log from Ticket Detail, add numbered Acceptance Criteria with a Definition of Done, make the seed baseline explicit and testable, and cite a source for the Zen Green hex values." | Second correction pass (commit `d7e803f`), again against the incomplete lecture-slide source — this is the pass where two of Bank's own review replies had to ask "where does this number come from?" because the source document genuinely didn't contain the answer. |
| 5 | "Here's the actual official labsheet PDF I forgot to upload earlier — read it in full and reconcile the whole `docs/lab-02/` set against it as the authoritative source, including two new required files (`reviewer.md`, `ai-use.md`) and the exact required file/section structure it specifies." | The task this document is part of: discovering the real source and redoing the reconciliation properly against it, rather than against the lecture deck. |
| 6 | "List every required section for `specification.md` and `tests.md` per the labsheet's Appendix A/B templates, and check the current drafts against that exact structure." | Structural gap analysis before rewriting — confirmed the existing content was substantively correct but organized differently, plus surfaced a real bug: `tests.md` and `traceability-matrix.md` still described Ticket Detail as having three tabs after `specification.md` had already removed two of them. |
| 7 | "Pull the full PR #14 review history via the GitHub API — every review, every inline comment, every reply — and build `reviewer.md` from the actual data, not from memory of the conversation." | Ensuring `reviewer.md` is a factual record rather than a reconstruction, per the labsheet's requirement that it show "reviewer identity, PR links, comments given and received, responses, and approvals." |
| 8 | "Fold `traceability-matrix.md` into `tests.md` §3 rather than keeping both, since the labsheet's Appendix B template puts AC traceability inside `tests.md` and doesn't list a separate matrix file — but don't delete anything until it's confirmed everything is carried over." | Deciding a structural question (keep vs. consolidate) against the source template rather than by habit. |

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
