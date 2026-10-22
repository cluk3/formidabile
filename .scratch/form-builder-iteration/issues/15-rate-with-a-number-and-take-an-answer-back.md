# 15: Rate with a number, and take an answer back

**What to build:** A number question can be shown as a plain input, stars, a labelled scale, a slider, or an NPS scale. Changing the display keeps the question identity. Publish reports when a display's rules are not met. Any number question can require a step. Rating, scale, and slider start empty. Optional questions answered with radios gain Clear answer, including the existing single-choice and boolean questions. NPS analytics report the promoter-minus-detractor score for versions that use that display. Rating, scale, and slider use the ordinary number summary. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A number question has one display setting: `input` (the default), `rating`, `scale`, `slider`, or `nps`. Changing the display keeps the question identity, so its answers keep combining across versions.
- [x] Publish rejects a display whose rules are not met, in the same all-at-once result as the other publish problems. Rating is stars, whole numbers, minimum 1, maximum from 3 to 10. Scale is whole numbers, minimum 0 or 1, maximum from 2 to 10, with an optional label at each end. Slider needs a minimum, a maximum, and a step. NPS is fixed at whole numbers from 0 to 10, with end labels.
- [x] Any number question may set a step: an optional positive decimal with at most 4 decimal places. A valid answer is the minimum plus a whole number of steps, or a whole multiple of the step when there is no minimum. The check scales both sides to integers. When the question accepts only whole numbers, the step is a whole number.
- [x] Rating, scale, and slider start empty. The slider shows "Not answered" and no thumb until the respondent moves it. The respondent is never recorded as choosing a value they did not pick.
- [x] Every optional question answered with radios has Clear answer. That includes the existing single-choice and boolean questions, and rating, scale, and NPS. Matrix rows are a later ticket.
- [x] NPS analytics report promoter (9 or 10), passive, and detractor (0 to 6) counts and the score, promoters minus detractors. The score counts only versions whose snapshot uses the NPS display, per version and combined over those versions. A number question on another display does not get an NPS score.
- [x] Rating, scale, and slider use the number summary: minimum, maximum, mean, and median.
- [x] The advisory answer schema carries the step as an `x-fb-*` key. The server's check stays final. This ticket does not bump `info.version`.
- [x] Tests cover the display publish rules, the step check, and display at the core entry point; the advisory schema and the NPS score through the HTTP API; the NPS score on both PGlite and Postgres; empty starts, the slider, and Clear answer in the renderer; and the display and step settings in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-22, implementing agent:** Built on branch `iter/15-rate-with-a-number-and-take-an-answer-back`. The last box stays open: `vp run ready` includes e2e and the PR's CI jobs, which this agent does not run. Matrix rows are a later ticket, so Clear answer stops at single choice, boolean radios, rating, scale, and NPS. Paths and not-shown questions are later tickets; nothing here depends on them. Notes for later tickets:

- `display` is optional on the number snapshot. Absent means a plain input, so stored format-1 definitions keep parsing. Do not add a zod default of `"input"`: the editing round-trip compares parsed output with literals that omit `display`. `newConfig` for a number question is `{ integer: false, display: "input" }`.
- A valid step is checked in units of 0.0001 (`toFixed(4)` then bigint modulo), so `0.1 + 0.2` with step `0.1` passes. The advisory key is `x-fb-step`. Ajv does not enforce it; `validateAnswers` does. This ticket does not change `info.version`; it stays `1.0.0` from ticket 01.
- The NPS score is `Math.round(((promoters - detractors) / answered) * 100)`, or `null` when nobody answered — percentage points, the share of promoters minus the share of detractors (ADR-018). Combined score sums the buckets of versions whose snapshot display is `nps`, then scores once. Number minimum, maximum, mean, and median still combine across every version, including versions on another display. The `nps` field is omitted when the display is not NPS.
- Clear answer is a `type="button"` inside the radio fieldset, only when the question is optional. After merging ticket 16, the must-be-yes checkbox does not get it. The button stays on the boolean radio branch (`mustBeYes` unset).
- The slider's answer stays unset until the respondent moves it. The control may sit at the minimum visually, with class `unset` hiding the thumb and the text "Not answered".
- Builder saves are format 2. Read the saved question with `questionsOf`, not `definition.questions`.
- `openapi.json` and `schema.d.ts` were regenerated after the merge. Do not hand-merge them.
- Ticket 19 owns `docs/embedding.md`. This ticket does not edit it.

**2026-10-22, implementing agent:** Merged `form-builder-iteration` into this branch. After that merge, `vp check`, `vp run boundaries`, `vp run check:svelte`, `vp run check:generated`, `vp test` (754 tests) and the Postgres suite (54 tests) are green. The last box stays open: `vp run ready` also runs end-to-end tests, and this agent does not run the PR's CI jobs. Boolean Clear answer is still `{#if !question.required}` inside the Yes/No radio fieldset only. Matrix-row Clear answer is a later ticket. `vp run ready` also runs `e2e`, and CI on the PR is the central gate; both stay open here.
