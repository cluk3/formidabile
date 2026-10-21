# 21: Submissions are safe to retry

**What to build:** Retrying a submission never creates a second response. Submit looks up the idempotency key before any other check, and a match returns the original `{ responseId, revision }` with the current revision. When two requests race on the same key, the losing one reruns the use case once.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 20 (Tracer bullet: an identified respondent loads and submits a response).

**Status:** ready-for-agent

- [x] Use case: a replay returns the same `responseId` and inserts nothing, including after the form closes and after a new version is published.
- [x] Use case: a replay on a form limited to one response per respondent gives 201, not `AlreadyResponded`.
- [x] Use case: the same key from another identified respondent creates a second response.
- [x] `test:pg`: concurrent submits with the same key leave exactly one response.
- [x] `http-api`: a replay gives a 201 body identical to the original.
- [x] The parity table gains a replay row.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t21-idempotent-submit`. The last box stays open until the PR's CI jobs report. Notes for later tickets (22, 23, 28 and 36 especially):

- `Submission.submit` calls `findByIdempotencyKey(tx, form, respondentId, key)` (`lib/persistence/responses.ts`) right after `shareForm`, before `FormClosed`. A match returns `{ responseId, revision: String(revision) }` read from the row, so after ticket 22's edits a replay carries the current revision with no further work. The body isn't compared and the answers aren't validated on a replay.
- `respondentId` is `string | null`, and `null` matches `respondent_id IS NULL`, the `NULLS NOT DISTINCT` scope. Ticket 23 passes `null` for anonymous grants (the spec's "an anonymous replay returns the original" test is its). An anonymous response can't exist on a limited form, so where its `identityRequired` check sits relative to the lookup doesn't change outcomes.
- The once-only rerun now catches 23505 on either `responses_one_per_respondent` or `responses_idempotency_key_unique`; the rerun finds the winner through the key lookup. `tests/submission-race.pg.test.ts` has both races.
- Use-case tests in `tests/submission.test.ts` (`describe("a replay")`) set `revision = 2` through SQL to prove the current revision is returned; ticket 22 can add the "after an edit" case through its real edit use case.
- Parity: the `a respondent replays a submit` row uses one module-level key, so the server's send stores the response and the Fetch handler's send replays it, and the bodies compare exactly.
