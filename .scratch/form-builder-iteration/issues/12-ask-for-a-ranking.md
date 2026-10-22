# 12: Ask for a ranking

**What to build:** A ranking question has 2 to 20 options. The respondent starts from an unranked list, adds options one by one, and reorders with Move up and Move down. The answer lists every option value once. Conditions can test whether an option ranks in the top N, and the complement. Analytics show each option's mean position and first-place count. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `ranking`. It uses the existing option model and has 2 to 20 options.
- [ ] The answer lists every option value exactly once, in rank order. An optional ranking is complete or absent: an unanswered ranking has no answer key.
- [ ] The list starts unranked. The respondent adds options one by one and reorders with Move up and Move down, including from the keyboard. A ranking shown in a default order is not an answer.
- [ ] Conditions offer ranks X in the top N, does not rank X in the top N, is answered, and is not answered. The constant is an option value and N.
- [ ] Removing an option that a condition names leaves that condition in place and marked broken, and publish refuses it.
- [ ] Analytics report each option's mean position and how often it was ranked first. The base is the answered responses of the versions that offered that option. Versions whose option sets differ still combine, and the per-version breakdown shows each version on its own. No raw rankings are returned.
- [ ] The advisory answer schema describes a ranking as unique items drawn from the option values, with exactly as many items as options. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the permutation rule, display, and the operators at the core entry point; the advisory schema and the ranking aggregates through the HTTP API; the ranking aggregates on both PGlite and Postgres; the add and move interaction in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
