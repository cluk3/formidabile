# 19: Response and external-reference tables with their invariants

**What to build:** The second migration pair. It adds responses (with their own revision, the `limited` flag, a partial unique index on `(form_id, respondent_id)`, and a not-null idempotency key under `UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`), and answers (with composite foreign keys to the response's version and to its question keys, plus the `(version_id, question_id)` index ADR 0009 requires). It also adds external reference rows for forms (deleted by cascade from forms) and for responses, and triggers that reject changes to a response's fixed columns. Each invariant is proven directly against the database.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0009](../../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 09 (Authoring tables with immutability enforced by triggers).

**Status:** ready-for-agent

- [x] The migrations are append-only: one new `generate` migration, plus a separate `--custom` migration generated in its own step. Earlier migrations are untouched, and `drizzle-kit check` passes.
- [x] The composite foreign key rejects an answer to a question that isn't in that response's version.
- [x] A trigger rejects changing a response's version, its idempotency key, or any other fixed column.
- [x] The partial unique index enforces one response per respondent on limited forms.
- [x] Deleting a never-published form removes its external references by cascade.
- [x] Every test here runs on PGlite under `vp test`, and again under `test:pg`.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t19-response-tables`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- Tables in `packages/server/lib/persistence/schema.ts`: `responses`, `answers`, `formExternalRefs`, `responseExternalRefs`. `responses.revision` is `integer` (starts at 1, `CHECK >= 1`), `respondent_id` is `text` (null when anonymous), `edited_at` is nullable, and every timestamp has no default, so the use case sets them from `Clock`.
- Constraint names a repository can map: `responses_one_per_respondent` (partial unique index `WHERE limited`, so 23505 means `AlreadyResponded`), `responses_idempotency_key_unique` (`UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`, 23505 means a racing retry, so rerun once), `responses_version_fkey` (`ON DELETE RESTRICT`), `answers_response_fkey` (to `responses (id, version_id)`, cascade) and `answers_question_fkey` (to `form_version_questions`).
- `responses_limited_needs_respondent_check` rejects a limited response with a null respondent (ADR 0006), because the partial index treats nulls as distinct and couldn't hold the limit for them.
- Reference shape `CHECK`s: `<table>_namespace_check` (at most 64 code points, `^[a-z][a-z0-9_.-]*$`) and `<table>_ref_id_check` (1 to 255 code points), on both reference tables, each with a `(namespace, ref_id)` index. The 100-per-form and 20-per-response counts stay in the application.
- Triggers raise 23001. `responses_fixed_columns` uses the generic `form_management.reject_fixed_column_change(<columns>...)`, which raises `responses.<column> never changes` for `id`, `form_id`, `version_id`, `respondent_id`, `limited`, `idempotency_key` and `submitted_at`. An edit may set only `revision` and `edited_at`, and deletes and reinserts the answer rows. `response_external_refs` rejects every `UPDATE` through `reject_change`, and deletes stay allowed so cascades work.
- `answers` now references `form_version_questions`, so a plain `TRUNCATE form_version_questions` fails with 0A000 before its trigger runs. Ticket 09's truncate test now uses `CASCADE`, like its siblings.
