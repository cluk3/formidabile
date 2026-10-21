# 36: Hosts erase a respondent's responses

**What to build:** Admins with `responses:delete` delete one response, or erase every response by one respondent across the tenant. Erasure is a hard delete, and form versions stay immutable and readable afterwards. The embedding guide gains the erasure and access-request procedures.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) (deletion), [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md) (deleting by respondent), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md); [Personal data classification and erasure](../../form-builder-mvp/issues/22-personal-data-classification-and-erasure.md).

**Blocked by:** 30 (Host-facing embedding guide), 35 (Admins list and read responses against their versions).

**Status:** ready-for-agent

- [x] Deleting one response, and deleting by respondent across the whole tenant, both work. Delete by respondent returns `{ deleted: n }`, and `{ deleted: 0 }` when there's nothing to delete.
- [x] The `respondentId` path parameter uses the shared 1-to-255-code-point check.
- [x] Persistence (PGlite): deleting responses removes their answers and references by cascade without firing any immutability trigger, and updating a version's `published_by` is still rejected.
- [x] Use case: after erasure, the same idempotency key creates a new response.
- [x] Use case and `http-api`: after deleting by respondent, the version read still succeeds for every affected form, and no other respondent's response is touched.
- [x] Use case and `http-api`: after the last response of a version is deleted, that version and its question keys still read.
- [x] Use case and `http-api`: after deleting by respondent, the same identified respondent can submit again to a one-per-respondent form.
- [x] `http-api`: deleting without `responses:delete` gives 403, and another tenant's admin gets 404.
- [x] The embedding guide's personal-data part gains the erasure procedure (delete by respondent once per tenant, and anonymous responses through the references their grants asserted) and the access-request procedure (the `respondentId` list plus each response read).
- [x] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t36-erasure`. The last box stays open until the PR's CI jobs report. Notes for later tickets (38 and 40 especially):

- `Responses` gains `delete(actor, responseId)` (`void`, `NotFound` when it's gone or in another tenant) and `deleteByRespondent(actor, respondentId)` (`DeletedResponses`, `{ deleted: n }`, never `NotFound`). Both need `responses:delete`. Each is one `DELETE … RETURNING` scoped to the tenant through `form_id IN (SELECT id FROM forms WHERE tenant = …)`; answers and response references go by cascade, and no trigger fires.
- HTTP, in the `responses` group: `DELETE /responses/{responseId}` gives 204, and `DELETE /respondents/{respondentId}/responses` gives 200 `{ deleted }`, with `respondentId` checked by `RespondentId` (256 code points → 422). The builder's both-deletes UI (ticket 38) calls these.
- Effect's router 404s any path parameter longer than 100 UTF-16 units before its schema runs. `@fb/http-api` now exports `FormApiRouterConfig` (`maxParamLength: 16 * 1024`); every place that serves `FormApiLive` must pass it as `routerConfig` (`web.ts`, `apps/api-server/server.ts`, and both `tests/api.ts` helpers do).
- `docs/embedding.md`'s "Personal data" now ends with "### Erasing a person" and "### Answering an access request". Ticket 40's analytics erasure assertions extend the `delete` describe blocks in `packages/server/tests/responses.test.ts` and `packages/http-api/tests/responses.test.ts`.
