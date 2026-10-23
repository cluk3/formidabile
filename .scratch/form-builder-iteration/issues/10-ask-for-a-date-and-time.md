# 10: Ask for a date and time

**What to build:** A date-and-time question accepts a local wall-clock date and time, with no zone and no seconds, and optional bounds. Publish rejects an earliest bound after the latest. Conditions can test is at, before, and after. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `date_time`. The answer is a local `YYYY-MM-DDTHH:MM` with no zone and no seconds. It means that wall-clock time, not one instant. The respondent's time zone is not recorded. It compares as a string, the way a date does.
- [x] Earliest and latest bounds are optional. Publish rejects an earliest bound after the latest.
- [x] Conditions offer is at, is before, is after, is answered, and is not answered.
- [x] The respondent uses a native date-and-time input. Analytics are counts only, the same shape as text.
- [x] The advisory answer schema carries the date-and-time bounds as `x-fb-*` keys. The server's check stays final. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema, including the `x-fb-*` keys, through the HTTP API; the input in the renderer; and the editor in the builder.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

`date_time` stores a local wall-clock `YYYY-MM-DDTHH:MM` (no seconds, no offset) on the answer and on optional `config.min` / `config.max`. Both compare as strings. Publish reuses `rangeIssues`: an earliest bound after the latest is "The minimum is greater than the maximum" at `config.max`. Equal bounds are allowed.

Operators on `conditionOperators.date_time`: `is_at`, `is_before`, `is_after`, then `is_answered` and `is_not_answered`. The constant kind is `"date_time"`. `isLocalDateTime` in `packages/core/lib/definition/types/date-time.ts` is the check. A calendar date or a zoned instant does not fit. `z.iso.datetime({ local: true, precision: -1 })` still accepts a trailing `Z`, so the schema is Zod's calendar-date pattern plus `HH:MM`.

The advisory property pattern is that regex. Bounds JSON Schema cannot compare are `x-fb-minDateTime` and `x-fb-maxDateTime`, omitted when unset. `info.version` stays `1.0.0`. Analytics adds `date_time` to the counts-only summary arm (with text, email, and date). No new SQL.

Builder registry name is "Date and time". The editor labels are "Earliest date and time" and "Latest date and time". The answer display is a `<time datetime>` of the stored value. The condition editor uses `datetime-local` for this constant kind and keeps a previous constant only when it already matches `YYYY-MM-DDTHH:MM`.

`packages/core/tests/answers.test.ts` has one appended `date_time` case so "covers every question type" stays exhaustive. The rest of the coverage is in new test files. On a registry merge, spec order is phone, url, time_of_day, date_time, then the later types.
