# 06: Count answered, skipped, and not shown

**What to build:** Each question's analytics report answered, skipped, and not shown, per version and combined. Respondents who were not shown a question are left out of its shares. The counts come from the path stored on the response, so a later change to the path rules leaves history as it was recorded. Follow ADR-017 and ADR-009. If this ticket and an ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] For each question, per version and combined, analytics report responses, shown, answered, skipped (shown minus answered), and not shown (responses minus shown).
- [ ] Those counts are read from the path stored on each response. Analytics never re-run the path function, so a later change to the path rules does not rewrite history.
- [ ] Option shares keep answered responses as their base. Respondents who were not shown a question are left out of its shares.
- [ ] A response collected before this iteration, whose stored path is every question in its version, contributes to shown and not to not-shown.
- [ ] The same figures come back on PGlite and on Postgres. No raw answers or samples are returned.
- [ ] Ranking, matrix, and NPS aggregates are later tickets. This ticket is the three counts, shown in the builder's analytics tables.
- [ ] Tests cover the counts through the HTTP API and in the shared analytics suite on both databases, and the builder shows the three counts.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
