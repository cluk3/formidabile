# 15: Rate with a number, and take an answer back

**What to build:** A number question can be shown as a plain input, stars, a labelled scale, a slider, or an NPS scale. Changing the display keeps the question identity. Publish reports when a display's rules are not met. Any number question can require a step. Rating, scale, and slider start empty. Optional questions answered with radios gain Clear answer, including the existing single-choice and boolean questions. NPS analytics report the promoter-minus-detractor score for versions that use that display. Rating, scale, and slider use the ordinary number summary. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A number question has one display setting: `input` (the default), `rating`, `scale`, `slider`, or `nps`. Changing the display keeps the question identity, so its answers keep combining across versions.
- [ ] Publish rejects a display whose rules are not met, in the same all-at-once result as the other publish problems. Rating is stars, whole numbers, minimum 1, maximum from 3 to 10. Scale is whole numbers, minimum 0 or 1, maximum from 2 to 10, with an optional label at each end. Slider needs a minimum, a maximum, and a step. NPS is fixed at whole numbers from 0 to 10, with end labels.
- [ ] Any number question may set a step: an optional positive decimal with at most 4 decimal places. A valid answer is the minimum plus a whole number of steps, or a whole multiple of the step when there is no minimum. The check scales both sides to integers. When the question accepts only whole numbers, the step is a whole number.
- [ ] Rating, scale, and slider start empty. The slider shows "Not answered" and no thumb until the respondent moves it. The respondent is never recorded as choosing a value they did not pick.
- [ ] Every optional question answered with radios has Clear answer. That includes the existing single-choice and boolean questions, and rating, scale, and NPS. Matrix rows are a later ticket.
- [ ] NPS analytics report promoter (9 or 10), passive, and detractor (0 to 6) counts and the score, promoters minus detractors. The score counts only versions whose snapshot uses the NPS display, per version and combined over those versions. A number question on another display does not get an NPS score.
- [ ] Rating, scale, and slider use the number summary: minimum, maximum, mean, and median.
- [ ] The advisory answer schema carries the step as an `x-fb-*` key. The server's check stays final. This ticket does not bump `info.version`.
- [ ] Tests cover the display publish rules, the step check, and display at the core entry point; the advisory schema and the NPS score through the HTTP API; the NPS score on both PGlite and Postgres; empty starts, the slider, and Clear answer in the renderer; and the display and step settings in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
