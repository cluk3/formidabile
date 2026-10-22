# 07: Ask for a phone number

**What to build:** A phone question stores an international number. The respondent can type spaces, dashes, dots, or parentheses, and gets a clear message when the country code is missing. Conditions can test equals, does not equal, starts with, and does not start with. The field offers telephone autocomplete. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `phone`. The stored answer is E.164: `+` followed by at most 15 digits. There is no default country and no phone-number library.
- [ ] The shared answer check strips spaces, dashes, dots, and parentheses before validating, so the browser and the server accept the same input. A number with no country code fails with a message that tells the respondent to include one.
- [ ] Conditions offer equals, does not equal, starts with, does not start with, is answered, and is not answered.
- [ ] The input is a telephone field with telephone autocomplete. The builder can add the question and shows the stored number in the response.
- [ ] Analytics for a phone question are counts only, the same shape as text. No raw values or samples are returned.
- [ ] The advisory answer schema expresses the phone pattern. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the answer schema (including normalisation), display, and the operators at the core entry point; the advisory schema through the HTTP API; and the input in the renderer and the editor in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
