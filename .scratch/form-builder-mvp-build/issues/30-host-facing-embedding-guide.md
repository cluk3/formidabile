# 30: Host-facing embedding guide

**What to build:** `docs/embedding.md`, the one document a host application reads to embed the renderer or write its own. It contains every part listed in the spec's contents section except the two phase 4 additions, which tickets 36 and 37 write. Each part states what its sources decided and adds no rules of its own.

**Sources:** [Spec, `docs/embedding.md` contents](../../form-builder-mvp/spec.md#docsembeddingmd-contents) and its [Design envelope](../../form-builder-mvp/spec.md#design-envelope); the ADRs and tickets each part names.

**Blocked by:** 24 (Forms carry external references), 27 (Renderer handles edits, version changes and refusals), 28 (Renderer retries submissions whose outcome is unknown), 29 (Renderer accessibility and strict-CSP proof).

**Status:** ready-for-agent

- [x] **The element:** its inputs (`api-base-url`, `form-id`, an optional `response-id`, and the required `getToken({ formId })` property), the `submitted` and `error` events, and theming through `--form-renderer-*` custom properties and `::part()`. There is no references input.
- [x] **Tokens:** both claim sets, form binding, the `refs` claim and its limits, the `sub` and `tenant` caps, short-lived grants, keeping `refs` short to stay under header limits, and that a request with no token is a 401.
- [x] **The reference guarantee:** a response's external references are the `refs` of the token that submitted it, never anything from the browser, and anyone holding that token before `exp` can submit under them.
- [x] **Looking up forms by reference:** every matching form is returned, an unknown reference gives an empty list, and choosing among them is the host's job.
- [x] **Strict CSP and Trusted Types:** no `'unsafe-inline'`, `'unsafe-eval'`, hashes or nonces are needed, and Trusted Types hosts allow the `svelte-trusted-html` policy.
- [x] **The custom-renderer contract:** items 1, 2 and 4 to 7 from HTTP API surface (item 4 covering `FormNotPublished` and `PayloadTooLarge`), never sending `externalRefs`, and the idempotency rules (the key's lifetime, resending an unchanged body, what counts as an unknown outcome, and a replay after closing or republishing still returning 201).
- [x] **Host duties:** hosts rate-limit `/respond` (especially submit) and the endpoint that mints grants; under the Fetch handler the host owns connection and request timeouts; hosts run the exported migration; the body limits; and the design envelope as advisory.
- [x] **Personal data:** subjects are opaque and pseudonymous, tenants are opaque, form content holds no personal data, and the host owns retention.
- [x] Every statement is checked against its source ADR or ticket.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t30-embedding-guide`. The last box stays open until the PR's CI jobs report. Notes for later tickets (36 and 37 especially):

- `docs/embedding.md` is linked from the README. Every claim was checked against the merged code and tests as well as the ADRs: element attributes and events (`lib/FormRendererElement.svelte`, `lib/problems.ts`), custom properties and parts (grep of `lib/`), claims and limits (`http-api/lib/jwt.ts`, `server/lib/authorization/actor.ts`, `tests/token-claims.test.ts`), routes, bodies and tags (`http-api/lib/api.ts`, `server/lib/errors.ts`, `envelopes.ts`), answer values (`core/lib/definition/types/*`).
- The custom-renderer contract keeps the HTTP API surface numbering, so it jumps from "2. Answers" to "4. Errors": ticket 36 adds "### 3." between them (the answer-schema endpoint, with the date-range gap). The table of `/respond` endpoints above it lists four routes; 36 adds the answer-schema row.
- "Personal data" ends with "The host owns retention"; ticket 37 appends the erasure and access-request procedures there.
- When the renderer gains a `ProblemCode`, a custom property or a part, the tables in "The element" need a row.
