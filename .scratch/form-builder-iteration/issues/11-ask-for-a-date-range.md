# 11: Ask for a date range

**What to build:** A date-range question accepts a start and an end, both or neither, start on or before end, both inside the optional bounds. Conditions can test the start and the end separately. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `date_range`. The answer is an object `{ start, end }` of dates, not a list. Date range, matrix, and address share the object answer arm; add that arm if an earlier ticket has not.
- [ ] The respondent fills in both dates or neither. Start is on or before end, so a single day is allowed. Both dates fall inside the optional bounds. Half a range is rejected.
- [ ] An optional date range with both dates empty has no answer key.
- [ ] Conditions offer starts before, starts on, starts after, ends before, ends on, ends after, is answered, and is not answered.
- [ ] The control is two native date inputs, labelled From and To, in one group. Analytics are counts only, the same shape as text.
- [ ] The advisory answer schema carries the start-on-or-before-end rule as an `x-fb-*` key. The server's check stays final. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the From / To group in the renderer; and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
