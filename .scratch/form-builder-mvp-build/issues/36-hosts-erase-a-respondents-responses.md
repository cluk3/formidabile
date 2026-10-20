# 36: Hosts erase a respondent's responses

**What to build:** Admins with `responses:delete` delete one response, or erase every response by one respondent across the tenant. Erasure is a hard delete, and form versions stay immutable and readable afterwards. The embedding guide gains the erasure and access-request procedures.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md) (deletion), [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md) (deleting by respondent), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md); [Personal data classification and erasure](../../form-builder-mvp/issues/22-personal-data-classification-and-erasure.md).

**Blocked by:** 30 (Host-facing embedding guide), 35 (Admins list and read responses against their versions).

**Status:** ready-for-agent

- [ ] Deleting one response, and deleting by respondent across the whole tenant, both work. Delete by respondent returns `{ deleted: n }`, and `{ deleted: 0 }` when there's nothing to delete.
- [ ] The `respondentId` path parameter uses the shared 1-to-255-code-point check.
- [ ] Persistence (PGlite): deleting responses removes their answers and references by cascade without firing any immutability trigger, and updating a version's `published_by` is still rejected.
- [ ] Use case: after erasure, the same idempotency key creates a new response.
- [ ] Use case and `http-api`: after deleting by respondent, the version read still succeeds for every affected form, and no other respondent's response is touched.
- [ ] Use case and `http-api`: after the last response of a version is deleted, that version and its question keys still read.
- [ ] Use case and `http-api`: after deleting by respondent, the same identified respondent can submit again to a one-per-respondent form.
- [ ] `http-api`: deleting without `responses:delete` gives 403, and another tenant's admin gets 404.
- [ ] The embedding guide's personal-data part gains the erasure procedure (delete by respondent once per tenant, and anonymous responses through the references their grants asserted) and the access-request procedure (the `respondentId` list plus each response read).
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
