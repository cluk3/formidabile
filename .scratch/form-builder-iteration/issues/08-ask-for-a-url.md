# 08: Ask for a URL

**What to build:** A URL question accepts only http and https links. Leaving out the scheme adds `https://` where the respondent can see it. The answer is shown as plain text in the response view. Conditions use the text operators. The email field gains email autocomplete alongside the URL field's own. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [ ] The question type is `url`. The stored answer is trimmed, never otherwise normalised, at most 2,048 code points, and must be an `http` or `https` URL that has a host.
- [ ] When the respondent leaves the field with no scheme, the input shows `https://` added. The respondent sees the scheme that will be stored.
- [ ] The builder's response view shows a URL answer as plain text, never as a link.
- [ ] Conditions offer equals, does not equal, contains, does not contain, is answered, and is not answered.
- [ ] The URL field offers URL autocomplete. The existing email question offers email autocomplete.
- [ ] Analytics for a URL question are counts only, the same shape as text. The advisory answer schema expresses the URL constraint. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the visible scheme and the input in the renderer; and the editor plus the plain-text answer display in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
