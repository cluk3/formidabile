# 19: Response and external-reference tables with their invariants

**What to build:** The second migration pair. It adds responses (with their own revision, the `limited` flag, a partial unique index on `(form_id, respondent_id)`, and a not-null idempotency key under `UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`), and answers (with composite foreign keys to the response's version and to its question keys, plus the `(version_id, question_id)` index ADR 0009 requires). It also adds external reference rows for forms (deleted by cascade from forms) and for responses, and triggers that reject changes to a response's fixed columns. Each invariant is proven directly against the database.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 09 (Authoring tables with immutability enforced by triggers).

**Status:** ready-for-agent

- [ ] The migrations are append-only: one new `generate` migration, plus a separate `--custom` migration generated in its own step. Earlier migrations are untouched, and `drizzle-kit check` passes.
- [ ] The composite foreign key rejects an answer to a question that isn't in that response's version.
- [ ] A trigger rejects changing a response's version, its idempotency key, or any other fixed column.
- [ ] The partial unique index enforces one response per respondent on limited forms.
- [ ] Deleting a never-published form removes its external references by cascade.
- [ ] Every test here runs on PGlite under `vp test`, and again under `test:pg`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
