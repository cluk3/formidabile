# 08: Ask for a URL

**What to build:** A URL question accepts only http and https links. Leaving out the scheme adds `https://` where the respondent can see it. The answer is shown as plain text in the response view. Conditions use the text operators. The email field gains email autocomplete alongside the URL field's own. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `url`. The stored answer is trimmed, never otherwise normalised, at most 2,048 code points, and must be an `http` or `https` URL that has a host.
- [ ] When the respondent leaves the field with no scheme, the input shows `https://` added. The respondent sees the scheme that will be stored.
- [ ] The builder's response view shows a URL answer as plain text, never as a link.
- [x] Conditions offer equals, does not equal, contains, does not contain, is answered, and is not answered.
- [ ] The URL field offers URL autocomplete. The existing email question offers email autocomplete.
- [ ] Analytics for a URL question are counts only, the same shape as text. The advisory answer schema expresses the URL constraint. This ticket does not bump `info.version`.
- [ ] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the visible scheme and the input in the renderer; and the editor plus the plain-text answer display in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

`url` is a question type with an empty config. The stored answer is trimmed and otherwise left as typed: `normalize` stays off, and a value Zod's URL check would rewrite (a tab or newline) is rejected. It must be `http` or `https` with a host, including localhost and an IP, and at most 2,048 code points. Conditions reuse the text operators. Analytics are the counts-only summary, the same shape as text. The advisory schema adds `pattern` `^(?i:https?):\/\/[^\s/?#]+[^\s]*$` and `maxLength` 2048; it does not set `format: uri`, which would reject a non-ASCII host the server accepts. `info.version` stays `1.0.0`.

The renderer input is `type="url"` and `autocomplete="url"`. On blur it shows `https://` when the text has no scheme (`example.com` and `localhost:3000` count; `http://` and `javascript:` do not). Email gains `autocomplete="email"`. The builder editor is the short required/optional sentence. The response view renders the URL as text, not a link.

Core structure, publish, answer, display, and operator tests passed, as did the counts-only analytics merge (90 tests in `url.test.ts`, `answers.test.ts`, and `url-analytics.test.ts`). The HTTP schema test, the renderer blur test, and the builder editor and plain-text tests are written and not yet confirmed: that run was interrupted. `vp check`, boundaries, svelte, `check:generated`, and `vp test` were not run as a set. `vp run ready` stays open.
