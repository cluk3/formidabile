# Revise the phased plan and spec

Type: grilling
Status: resolved
Blocked by: 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29
Map: [Form builder MVP](../map.md)

## Question

With the reopened decisions resolved, what changes in [`spec.md`](../spec.md) so that it again leaves nothing to decide before `/to-tickets`?

Fold in every decision from the reopened tickets: phase contents, deliverables, the seed, and the §12 proof table. Also close the acceptance-criteria gaps the readiness audit found:

- **Accessibility**: axe can't prove full keyboard use or focus moving to the first error ([Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md)). Name the tests that do.
- **Concurrent save and publish**: phase 1 says the race gives `RevisionConflict` and exactly one new version, but not which interleaving wins, or when the loser should get `NoDraft` instead.
- **Security cases**: malformed and oversized tokens and bodies, forged references and retried submissions, according to how the reopened tickets resolved them.
- **The embedding contract as a whole**: [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md) and [Trust in response external references](./20-trust-in-response-external-references.md) both moved it. Re-read the element's inputs, `getToken`, the reference guarantee and custom-renderer items 1 to 7 together, and state in one place what phase 2's `docs/embedding.md` contains.
- **The standalone server**: `apps/api-server` is covered by one startup request. Decide whether that's enough for the second way of serving the API.

Then check the map's **Not yet specified** section is empty before handing off.

## Answer

[`spec.md`](../spec.md) is revised and no longer under revision, so `/to-tickets` can run on it. No new ADR and no glossary change. Amendment notes were added to [Persistence model](./10-persistence-model.md) (the lock rule), [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (where the 413 check lives), [HTTP API surface](./16-http-api-surface.md) (custom-renderer item 4), [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md) (`/token` without `project`) and [Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md) (the accessibility tests). The map's **Not yet specified** section is empty.

- **Folded in**: ADRs 0011 to 0016 and the reopened tickets, a "Before phase 0 (done)" section for the repo, and a "Design envelope" section. Removed: `gh repo create`, `draftFrom`, both per-version caches, and "forms can't be deleted" as the seed's reason.
- **Placement** (the tickets' suggestions, filled in where they were silent):
  - Phase 0: the server timeouts and `statement_timeout`, and the ruleset once the four checks have reported.
  - Phase 1: the core id source, the satisfiability rules and the email cap; the server envelopes, row mappers, the new `UNIQUE`, the conditional delete trigger and cascades, and the delete use case; `DELETE /forms`, `FormPublished`, `FormNotPublished` on discard, and the 411/413 edge middleware.
  - Phase 2: grants, `refs`, form binding, idempotency, `resolveProjectForm` and its pages, and the renderer's `getToken({ formId })`, `reason` messages, 413 message and Retry.
  - Phase 3: "Delete form", the 413 message, unknown-outcome reloads and the Web Crypto id source.
  - Phase 4: the erasure tests, the `respondentId` cap and the email contract case.
  - Tests that need the response list (listing by reference, the dropped-reply count) get their list assertions in phase 4. Races go to `test:pg`, because PGlite has one connection.
- **Claim validation**: `JwtActorResolver` and the `Actor` union ship complete in phase 1, tested on admin endpoints. Phase 2 adds only the respondent use cases' form-binding checks.
- **Concurrent save and publish**: every draft write (save, discard, publish, delete) takes `FOR UPDATE` on the form row first. If publish wins, a stale save or discard gets `NoDraft`, and a save with `expectedRevision: null` creates a new draft on the new version. If save wins, publish gets `RevisionConflict`. This fixes a lost update: before, a save could commit between publish's revision check and its draft delete. Proven by two sequential use-case tests and a `test:pg` race asserting that no acknowledged save is lost.
- **Accessibility**: axe stays. Renderer component tests check focus moving to the first error, `aria-invalid` and `aria-describedby` for all seven types, and a three-browser Playwright keyboard-only run submits all seven types. The builder gets one component test for focus following a moved question. If WebKit's Tab order can't reach every control, the keyboard run alone falls back to Chromium and Firefox, decided by the first ticket that writes it.
- **Security cases**: a new table after the §12 table, with each case, its phase, its test layer and its source ticket. The §12 table stays a 1:1 map of ADR 0001's list. Bullet 7 gains the races, bullet 8 the grant and form-binding cases, and bullet 10 the `refs` tests.
- **`docs/embedding.md`**: one spec section lists its eight parts with their sources: the element, tokens, the reference guarantee, lookup by reference, CSP and Trusted Types, the custom-renderer contract, host duties, and personal data. Phase 2 writes all of it except item 3 of the custom-renderer contract and the erasure and access-request procedures, which come in phase 4. Custom-renderer item 4 gains `FormNotPublished` and `PayloadTooLarge`.
- **The standalone server**: the `test:pg` smoke test keeps startup, migration, one authenticated request and `statement_timeout`. A new serving-mode parity test in `apps/api-server`, under `vp test` on PGlite, sends one table of requests through both the server on an ephemeral port and `createFormModuleHandler`, and asserts equal status, `content-type` and body. The table covers a success, each 401 `reason`, 403, 404, a 409, a 422, 411 sent chunked over a raw socket, and 413. It lands in phase 1 and gains submit rows in phase 2. The 413 check moves there from the smoke test.
- **Erasure and analytics**: phase 4 asserts the version reads after erasure, and phase 5 adds the analytics assertions to the same tests.
- **`/token` for the anonymous dev user without `project`** gives 401, which the builder already maps to "Sign in".
