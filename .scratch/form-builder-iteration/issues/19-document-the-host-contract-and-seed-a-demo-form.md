# 19: Document the host contract and seed a demo form

**What to build:** The embedding guide describes pages, focus, `pagechange`, format 2, the path rules, the new answer shapes, and autocomplete. The reference host's demo data includes one paged form that uses conditions, jumps, and the new question types. Follow ADR-017, ADR-018, and ADR-019. If this ticket and an ADR disagree, the ADR wins.

**Blocked by:** 02 (Build and answer page by page), 03 (Show a question only when its condition holds), 04 (Keep broken show conditions and preview them), 05 (Jump to a later page or to the end), 07 (Ask for a phone number), 08 (Ask for a URL), 09 (Ask for a time of day), 10 (Ask for a date and time), 11 (Ask for a date range), 12 (Ask for a ranking), 13 (Ask a matrix), 14 (Ask for an address), 15 (Rate with a number, and take an answer back), 16 (Collect consent with must-be-yes), 17 (Duplicate a form and restore a draft)

**Status:** ready-for-agent

- [ ] The embedding guide covers pages and focus behaviour, the `pagechange` event, and the rule that the element never writes the host document title, history, or URL.
- [ ] The guide covers format 2, the path rules (use the exported path function; an answer off the path is 422), and preview of a draft whose logic is broken.
- [ ] The guide covers the new question types' answer shapes, the number displays, the step constraint, must-be-yes, and the autocomplete tokens.
- [ ] The guide covers duplicate and restore as reads plus the existing create and draft-save calls, and a host posting a template definition as a new form. The module stores no templates.
- [ ] The reference host's demo seed creates one paged form through the API, the same way the other seed forms are created. That form uses show conditions, jumps, and each new question type.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
