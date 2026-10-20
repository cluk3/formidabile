# 21: Submissions are safe to retry

**What to build:** Retrying a submission never creates a second response. Submit looks up the idempotency key before any other check, and a match returns the original `{ responseId, revision }` with the current revision. When two requests race on the same key, the losing one reruns the use case once.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 20 (Tracer bullet: an identified respondent loads and submits a response).

**Status:** ready-for-agent

- [ ] Use case: a replay returns the same `responseId` and inserts nothing, including after the form closes and after a new version is published.
- [ ] Use case: a replay on a form limited to one response per respondent gives 201, not `AlreadyResponded`.
- [ ] Use case: the same key from another identified respondent creates a second response.
- [ ] `test:pg`: concurrent submits with the same key leave exactly one response.
- [ ] `http-api`: a replay gives a 201 body identical to the original.
- [ ] The parity table gains a replay row.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
