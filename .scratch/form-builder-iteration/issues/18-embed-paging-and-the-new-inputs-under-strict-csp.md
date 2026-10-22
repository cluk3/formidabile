# 18: Embed paging and the new inputs under strict CSP

**What to build:** A host with a strict content security policy can embed a paged form that uses every new input. The built element still loads in Chromium, Firefox, and WebKit, and a page change still moves focus to the new heading. Follow ADR-008 and ADR-017. If this ticket and an ADR disagree, the ADR wins.

**Blocked by:** 02 (Build and answer page by page), 07 (Ask for a phone number), 08 (Ask for a URL), 09 (Ask for a time of day), 10 (Ask for a date and time), 11 (Ask for a date range), 12 (Ask for a ranking), 13 (Ask a matrix), 14 (Ask for an address), 15 (Rate with a number, and take an answer back), 16 (Collect consent with must-be-yes)

**Status:** ready-for-agent

- [ ] The strict-CSP check renders a paged form from the built element. The form uses phone, URL, time of day, date and time, date range, ranking, both matrices, address, rating, scale, slider, NPS, and the must-be-yes checkbox.
- [ ] That check passes in Chromium, Firefox, and WebKit.
- [ ] The element still ships no static `style` attribute and no inline script, and it still does not write the host document title, history, or URL.
- [ ] A page change moves focus to the new page's heading in the accessibility coverage.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
