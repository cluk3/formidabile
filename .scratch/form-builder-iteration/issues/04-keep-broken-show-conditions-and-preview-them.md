# 04: Keep broken show conditions and preview them

**What to build:** Deleting a question or an option, or moving a question below a condition that reads it, leaves the condition in place and marked broken. Publish refuses a definition with a broken condition. Preview still runs: a broken reference counts as unanswered, and the broken-logic warning sits beside the preview. "Treat as a new question" points every condition that read the old question identity at the new one. Follow ADR-017. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] Removing a question or an option, or moving a question so a condition can no longer read it, leaves that condition in the draft. Nothing deletes it silently.
- [ ] Broken is computed from the draft, never stored. The builder marks the condition broken.
- [ ] Publish refuses a definition with a broken show condition, and says why.
- [ ] Preview of a draft with broken logic still runs. A leaf whose question cannot be resolved, is not earlier, or names an option value that no longer exists counts as unanswered. The broken-logic warning is shown beside the preview.
- [ ] "Treat as a new question" rewrites every show condition in the draft that names the old question identity so that it names the new one.
- [ ] Jumps are a later ticket. A later question type that adds row values extends this same rule; this ticket covers questions and option values.
- [ ] Tests cover the editing operations and the draft-tolerant path at the core entry points, publish refusing the broken draft through the HTTP API, and the broken marker plus the preview warning in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
