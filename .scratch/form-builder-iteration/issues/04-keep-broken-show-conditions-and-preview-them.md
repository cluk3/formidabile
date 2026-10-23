# 04: Keep broken show conditions and preview them

**What to build:** Deleting a question or an option, or moving a question below a condition that reads it, leaves the condition in place and marked broken. Publish refuses a definition with a broken condition. Preview still runs: a broken reference counts as unanswered, and the broken-logic warning sits beside the preview. "Treat as a new question" points every condition that read the old question identity at the new one. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] Removing a question or an option, or moving a question so a condition can no longer read it, leaves that condition in the draft. Nothing deletes it silently.
- [x] Broken is computed from the draft, never stored. The builder marks the condition broken.
- [x] Publish refuses a definition with a broken show condition, and says why.
- [x] Preview of a draft with broken logic still runs. A leaf whose question cannot be resolved, is not earlier, or names an option value that no longer exists counts as unanswered. The broken-logic warning is shown beside the preview.
- [x] "Treat as a new question" rewrites every show condition in the draft that names the old question identity so that it names the new one.
- [x] Jumps are a later ticket. A later question type that adds row values extends this same rule; this ticket covers questions and option values.
- [x] Tests cover the editing operations and the draft-tolerant path at the core entry points, publish refusing the broken draft through the HTTP API, and the broken marker plus the preview warning in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

Removing a question, an option, or a page already left conditions and jumps in place. `reidentifyQuestion` is what changed: it mints the new identity, then rewrites every show condition and every jump condition in the draft that names the old one. Option values and a leaf's `row` are left as written. `changeQuestionType` still mints a new identity and does not rewrite, so conditions that named the old identity stay and `conditionIssues` reports them.

Broken stays computed. The question card already lists `conditionIssues` for that question (`aria-label="Show condition problems"`). Preview, in `DraftEditor`, shows this beside the renderer when that list is non-empty: "This draft has broken logic. A broken reference counts as unanswered." Publish already refused through `validateForPublish`. The messages are the ones from ticket 03.

Draft tolerance was already in `holds`. A missing question or one that is not earlier counts as unanswered, so only `is_not_answered` holds. A leaf that names an option value the question does not have does not hold, including `is_none_of`. A jump condition is evaluated the same way; a target that is not a later page is still ticket 05.

Ticket 13 should leave a condition in place when a row value disappears, the same way `removeOption` leaves an option value. `reidentifyQuestion` already keeps `row` while it rewrites `questionId`.
