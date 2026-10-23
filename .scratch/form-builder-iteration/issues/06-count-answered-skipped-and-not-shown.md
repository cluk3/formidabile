# 06: Count answered, skipped, and not shown

**What to build:** Each question's analytics report answered, skipped, and not shown, per version and combined. Respondents who were not shown a question are left out of its shares. The counts come from the path stored on the response, so a later change to the path rules leaves history as it was recorded. Follow ADR-017 and ADR-009. If this ticket and an ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] For each question, per version and combined, analytics report responses, shown, answered, skipped (shown minus answered), and not shown (responses minus shown).
- [x] Those counts are read from the path stored on each response. Analytics never re-run the path function, so a later change to the path rules does not rewrite history.
- [x] Option shares keep answered responses as their base. Respondents who were not shown a question are left out of its shares.
- [x] A response collected before this iteration, whose stored path is every question in its version, contributes to shown and not to not-shown.
- [x] The same figures come back on PGlite and on Postgres. No raw answers or samples are returned.
- [x] Ranking, matrix, and NPS aggregates are later tickets. This ticket is the three counts, shown in the builder's analytics tables.
- [x] Tests cover the counts through the HTTP API and in the shared analytics suite on both databases, and the builder shows the three counts.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-23, implementing agent:** Branch `iter/06-count-answered-skipped-and-not-shown`. Counts come from `form_management.response_path` via `shownPerQuestion` in `packages/server/lib/analytics/queries.ts`. Analytics does not call `pathOf`. `skipped` is shown minus answered. `notShown` is responses minus shown. `absentResponses` is unchanged: responses to versions that did not contain the question. A missing path row counts as not shown. Ticket 03's backfill writes a row for every question of a pre-iteration response, so those responses contribute to shown and not to not shown. A response with no show condition stores the same full path. Option `base` is still the answered responses of the versions that offered the option. The NPS summary arm is unchanged: `nps.answered` is the answered count of versions whose snapshot display is `nps`, and the score is still promoters minus detractors over that answered count. `info.version` stays `1.0.0`. No migration. `vp run test:pg` from this worktree tries to start a second Postgres on 5432. The shared analytics suite was run with `TEST_POSTGRES=1` against the container already listening there, and it passed. `packages/http-api/tests/web.pg.test.ts` was killed at its 4s limit with empty stderr while the machine was busy; that test does not exercise these counts. `vp check`, `vp run boundaries`, `vp run check:svelte`, and `vp run check:generated` passed. A full `vp test` finished 814 passed and 6 failed, all timeouts in files this ticket does not change (body limits, duplicate, fresh database, response delete, superseded submit, and a draft-editor click). Those six files passed on their own, 76 tests. `vp run ready` stays open: it includes e2e and CI.

Notes for later tickets:

- `AnalyticsCounts` requires `shown: { versionId, questionId, count }[]`, one group per version and question from the path table. `mergeAnalytics` reads it. Merge-test helpers that omit `shown` fill a full path (`count` = that version's responses for every question) so fixtures from before this ticket keep `notShown: 0` and `skipped` = responses minus answered. See `shownToEveryone` in `analytics-merge.test.ts` and `nps-merge.test.ts`.
- `QuestionAnalytics.combined` and a present `byVersion` entry are `responses`, `shown`, `answered`, `skipped`, `notShown`, then the existing fields. Ranking and matrix summaries append on `AnalyticsSummary`; they should not recompute these counts.
- The builder table "Answered, skipped and not shown" bars each count as a share of `combined.responses` (CSS width, no chart library). The by-version columns are Responses, Shown, Answered, Skipped, Not shown, Result. `countsText` is `N responses: S shown, A answered, K skipped, H not shown.`
