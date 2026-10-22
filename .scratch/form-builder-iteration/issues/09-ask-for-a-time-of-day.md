# 09: Ask for a time of day

**What to build:** A time-of-day question accepts a 24-hour time, with optional earliest and latest bounds. Publish rejects a window whose earliest is after its latest. Conditions can test is at, before, and after. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `time_of_day`. The answer is `HH:MM` on a 24-hour clock, with no seconds. It compares as a string, the way a date does. The respondent's time zone is not recorded.
- [ ] Earliest and latest bounds are optional. Publish rejects an earliest bound after the latest, so a window cannot cross midnight.
- [ ] Conditions offer is at, is before, is after, is answered, and is not answered.
- [ ] The respondent uses a native time input. Analytics are counts only, the same shape as text. The advisory answer schema expresses the time pattern. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish (including the bound order), the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the input in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
