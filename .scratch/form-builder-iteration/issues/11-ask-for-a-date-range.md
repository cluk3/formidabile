# 11: Ask for a date range

**What to build:** A date-range question accepts a start and an end, both or neither, start on or before end, both inside the optional bounds. Conditions can test the start and the end separately. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `date_range`. The answer is an object `{ start, end }` of dates, not a list. Date range, matrix, and address share the object answer arm; add that arm if an earlier ticket has not.
- [x] The respondent fills in both dates or neither. Start is on or before end, so a single day is allowed. Both dates fall inside the optional bounds. Half a range is rejected.
- [x] An optional date range with both dates empty has no answer key.
- [x] Conditions offer starts before, starts on, starts after, ends before, ends on, ends after, is answered, and is not answered.
- [x] The control is two native date inputs, labelled From and To, in one group. Analytics are counts only, the same shape as text.
- [x] The advisory answer schema carries the start-on-or-before-end rule as an `x-fb-*` key. The server's check stays final. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the From / To group in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-23, implementing agent:** Branch `iter/11-ask-for-a-date-range`. The last box stays open: `vp run ready` includes e2e and the PR's CI jobs. Notes for later tickets:

- The shared object answer arm is the last member of `AnyAnswers` in `packages/core/lib/answers/answers.ts`: `z.record(z.string(), z.union([z.string(), z.array(z.string())]))`. Matrix and address should reuse it. Do not add a second arm.
- `present` in `packages/core/lib/definition/evaluate.ts` treats a non-null object as answered, so `is_answered` holds for a date range, and will for a matrix or address. A list is still present on its own.
- Operator ids: `starts_before`, `starts_on`, `starts_after`, `ends_before`, `ends_on`, `ends_after`, plus `is_answered` and `is_not_answered`. The constant kind is `date`. Builder labels are in `ConditionEditor.svelte`.
- Display text is `${start} to ${end}`. `newConfig` is `{}`. Bounds are optional `min` / `max`, same publish rule as date.
- The advisory key is `x-fb-startOnOrBeforeEnd: true`, plus `x-fb-minDate` / `x-fb-maxDate` when bounds are set. Ajv does not enforce the order; `validateAnswers` does. `info.version` stays `1.0.0`.
- Analytics summary for this type is `{ type: "date_range" }`, the counts-only arm next to text, email, and date. No new query.
- An optional range with both inputs empty omits the answer key in the renderer. One side filled is sent and rejected (`Enter a date` on the blank side). `openapi.json` and `schema.d.ts` were regenerated. Do not hand-merge them.

`vp check`, `vp run boundaries`, `vp run check:svelte`, `vp run check:generated`, `vp run --no-cache @fb/renderer#build`, and `vp test` passed on `6cafc92` before this merge. The draft-editor "every question type" failure in an earlier full run was load: that test passed alone, and the later full `vp test` passed. `form-builder-iteration` was `c819003` (ticket 06's shown, skipped, and not-shown counts). No earlier ticket had landed the object answer arm, so this branch still owns it. Phone, URL, time of day, and date-and-time were not on `form-builder-iteration`, so `date_range` stays after `boolean` until those types merge in spec order. `vp run ready` stays open.
