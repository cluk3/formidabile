# 10: Ask for a date and time

**What to build:** A date-and-time question accepts a local wall-clock date and time, with no zone and no seconds, and optional bounds. Publish rejects an earliest bound after the latest. Conditions can test is at, before, and after. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `date_time`. The answer is a local `YYYY-MM-DDTHH:MM` with no zone and no seconds. It means that wall-clock time, not one instant. The respondent's time zone is not recorded. It compares as a string, the way a date does.
- [ ] Earliest and latest bounds are optional. Publish rejects an earliest bound after the latest.
- [ ] Conditions offer is at, is before, is after, is answered, and is not answered.
- [ ] The respondent uses a native date-and-time input. Analytics are counts only, the same shape as text.
- [ ] The advisory answer schema carries the date-and-time bounds as `x-fb-*` keys. The server's check stays final. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema, including the `x-fb-*` keys, through the HTTP API; the input in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
