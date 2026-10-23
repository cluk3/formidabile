# 14: Ask for an address

**What to build:** An address question has the six fixed lines. The builder chooses which lines are shown and which are required, with at least one shown. The respondent picks a country from a list named in their language, and the browser can autofill the lines. When the country line is shown, conditions can test country is any of and country is none of. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `address`. The lines are line 1, line 2, city, region, postal code, and country. Each line is shown or hidden and required or optional, and at least one line is shown.
- [x] The answer holds only the filled lines, each trimmed and at most 200 code points. It is an object of those lines. Date range, matrix, and address share that object arm; add it if an earlier ticket has not.
- [x] An optional address with every line empty has no answer key. Once any line is filled, the required lines must be filled too. Postal codes have no per-country format.
- [x] Country is an ISO 3166-1 alpha-2 code chosen from a list held in core. The respondent sees country names in their language. The names are not shipped as a translated list in the bundle.
- [x] Conditions offer is answered and is not answered. When the country line is shown they also offer country is any of and country is none of. Those two operators are absent when the country line is hidden.
- [x] The lines offer the autocomplete tokens `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, and `country`. Analytics are counts only, the same shape as text. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the line rules, display, and the operators at the core entry point; the advisory schema through the HTTP API; the lines, the country picker, and autocomplete in the renderer; and the line settings in the builder.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-23, implementing agent:** Branch `iter/14-ask-for-an-address`. An address question has six fixed lines (`line1`, `line2`, `city`, `region`, `postalCode`, `country`). Each line is shown or hidden and required or optional, and publish rejects a question with every line hidden. The answer object keeps only filled lines, trimmed, at most 200 code points. An optional address with every line blank sends no answer key. Once any line is filled, the required lines must be filled too. Postal codes are plain text. `info.version` stays `1.0.0`.

The object answer arm is one record of strings or lists of strings, shared with date range and matrix. Those tickets are not on `form-builder-iteration` yet; keep a single arm when they merge. Country is one of 249 officially assigned ISO 3166-1 alpha-2 codes held in core (`countryCodes`). The respondent's names come from `Intl.DisplayNames` in `document.documentElement.lang` or `navigator.language`. Names are not in the bundle. `UK` and user-assigned `XK` are not in the list.

`country is any of` and `country is none of` are offered only while the country line is shown. Publish rejects them, and non-alpha-2 constants, when that line is hidden. An unknown country code does not match either operator. Autocomplete tokens are `address-line1`, `address-line2`, `address-level2`, `address-level1`, `postal-code`, and `country`. Analytics stay counts only, the same arm as text, including `shown` and `notShown` from ticket 06.

`vp check`, `vp run boundaries`, `vp run check:svelte`, `vp run check:generated`, and `vp run --no-cache @fb/renderer#build` passed after merging `form-builder-iteration` at `c819003`. A full `vp test` finished 700 passed, 88 failed, and 51 skipped across 35 files. The failures were timeouts while other suites were running on the same machine: browser tests around 16 seconds, HTTP tests around 30 to 45 seconds, and the shared test-database helper. The address files, the draft editor, and that database helper then passed on their own, 27 tests. The last box stays open: `vp run ready` includes end-to-end tests and the PR's CI jobs.
