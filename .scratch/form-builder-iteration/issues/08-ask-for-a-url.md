# 08: Ask for a URL

**What to build:** A URL question accepts only http and https links. Leaving out the scheme adds `https://` where the respondent can see it. The answer is shown as plain text in the response view. Conditions use the text operators. The email field gains email autocomplete alongside the URL field's own. Follow ADR-018. If this ticket and the ADR disagree, the ADR wins.

**Blocked by:** 03 (Show a question only when its condition holds)

**Status:** ready-for-agent

- [x] The question type is `url`. The stored answer is trimmed, never otherwise normalised, at most 2,048 code points, and must be an `http` or `https` URL that has a host.
- [x] When the respondent leaves the field with no scheme, the input shows `https://` added. The respondent sees the scheme that will be stored.
- [x] The builder's response view shows a URL answer as plain text, never as a link.
- [x] Conditions offer equals, does not equal, contains, does not contain, is answered, and is not answered.
- [x] The URL field offers URL autocomplete. The existing email question offers email autocomplete.
- [x] Analytics for a URL question are counts only, the same shape as text. The advisory answer schema expresses the URL constraint. This ticket does not bump `info.version`.
- [x] Tests cover structure, publish, the answer schema, display, and the operators at the core entry point; the advisory schema through the HTTP API; the visible scheme and the input in the renderer; and the editor plus the plain-text answer display in the builder.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

`url` is a question type with an empty config. The stored answer is trimmed and otherwise left as typed: `normalize` stays off, and a value Zod's URL check would rewrite (a tab or newline) is rejected. It must be `http` or `https` with a host, including localhost and an IP, and at most 2,048 code points. Conditions reuse the text operators. Analytics are the counts-only summary, the same shape as text. The advisory schema adds `pattern` `^(?i:https?):\/\/[^\s/?#]+[^\s]*$` and `maxLength` 2048; it does not set `format: uri`, which would reject a non-ASCII host the server accepts. `info.version` stays `1.0.0`.

The renderer input is `type="url"` and `autocomplete="url"`. On blur it shows `https://` when the text has no scheme (`example.com` and `localhost:3000` count; `http://` and `javascript:` do not). Email gains `autocomplete="email"`. The builder editor is the short required/optional sentence. The response view renders the URL as text, not a link.

The HTTP contract test compiles the answer schema the same way `answer-schema.test.ts` does: Ajv 2020 with `ajv-formats`, then `addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate"])`. Ajv counts code points, so a 2,048-code-point string that uses a surrogate pair is accepted by both the server and the advisory schema. The schema still cannot trim or reject `http:///path`, and those two cases stay browser-only gaps.

Core, analytics, renderer, builder, and the HTTP schema tests passed. Merging `form-builder-iteration` (ticket 06) adds `shown` and `notShown` beside answered and skipped. A URL question stays counts-only: its summary is still `{ type: "url" }`. `vp run ready` and CI stay open.
