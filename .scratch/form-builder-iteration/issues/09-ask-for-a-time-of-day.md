# 09: Ask for a time of day

**What to build:** A time-of-day question accepts a 24-hour time, with optional earliest and latest bounds. Publish rejects a window whose earliest is after its latest. Conditions can test is at, before, and after. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `time_of_day`. The answer is `HH:MM` on a 24-hour clock, with no seconds. It compares as a string, the way a date does. The respondent's time zone is not recorded.
- [x] Earliest and latest bounds are optional. Publish rejects an earliest bound after the latest, so a window cannot cross midnight.
- [x] Conditions offer is at, is before, is after, is answered, and is not answered.
- [x] The respondent uses a native time input. Analytics are counts only, the same shape as text. The advisory answer schema expresses the time pattern. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish (including the bound order), the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the input in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

`time_of_day` is a string question. Config is `{ earliest?: HH:MM, latest?: HH:MM }` (not `min`/`max`). Publish uses `rangeIssues` on those bounds, so an earliest after the latest is an issue at `config.latest` with "The minimum is greater than the maximum". Equal bounds are allowed. `00:00` through `23:59` only: `z.iso.time({ precision: -1 })`, so `9:00`, `24:00`, and `17:00:00` do not parse. No time zone is stored. Display is the `HH:MM` string.

Operators, appended on `conditionOperators.time_of_day`: `is_at`, `is_before`, `is_after`, then `is_answered` and `is_not_answered`. Their constant kind is `"time"` (`ConstantKind` gained that member). `constantFits` accepts only `HH:MM`. Comparison is the string order, same as a date. A later type that needs `YYYY-MM-DDTHH:MM` should add its own kind rather than reuse `"time"`.

The advisory schema's pattern is `^(?:[01]\d|2[0-3]):[0-5]\d$` (also emitted by Zod). The window is not an `x-fb-*` key: JSON Schema cannot express it, and ADR-018 reserves those keys for date-and-time bounds, step, and date-range order. Counts-only analytics: `time_of_day` is on the `Schema.Literals(["text", "email", "date", "time_of_day"])` arm, so `merge.ts` `default` returns `{ type: "time_of_day" }`. `info.version` stays `1.0.0`. No migration.

`packages/core/tests/answers.test.ts` has one appended `time_of_day` case so "covers every question type" stays true. Other behaviour is in `packages/core/tests/time-of-day.test.ts`.

Registries append `time_of_day` after `boolean`. On a later merge, keep spec order among the new types: phone, url, time_of_day, date_time, date_range, ranking, single_choice_matrix, multiple_choice_matrix, address. The builder editor labels are "Earliest time" and "Latest time". The condition editor uses a native time input for constant kind `"time"`. The respondent input is `type="time"` with `min`/`max` set from the bounds.
