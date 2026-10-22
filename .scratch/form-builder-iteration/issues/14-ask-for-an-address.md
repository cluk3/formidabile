# 14: Ask for an address

**What to build:** An address question has the six fixed lines. The builder chooses which lines are shown and which are required, with at least one shown. The respondent picks a country from a list named in their language, and the browser can autofill the lines. When the country line is shown, conditions can test country is any of and country is none of. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `address`. The lines are line 1, line 2, city, region, postal code, and country. Each line is shown or hidden and required or optional, and at least one line is shown.
- [ ] The answer holds only the filled lines, each trimmed and at most 200 code points. It is an object of those lines. Date range, matrix, and address share that object arm; add it if an earlier ticket has not.
- [ ] An optional address with every line empty has no answer key. Once any line is filled, the required lines must be filled too. Postal codes have no per-country format.
- [ ] Country is an ISO 3166-1 alpha-2 code chosen from a list held in core. The respondent sees country names in their language. The names are not shipped as a translated list in the bundle.
- [ ] Conditions offer is answered and is not answered. When the country line is shown they also offer country is any of and country is none of. Those two operators are absent when the country line is hidden.
- [ ] The lines offer the autocomplete tokens `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, and `country`. Analytics are counts only, the same shape as text. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the line rules, display, and the operators at the core entry point; the advisory schema through the HTTP API; the lines, the country picker, and autocomplete in the renderer; and the line settings in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
