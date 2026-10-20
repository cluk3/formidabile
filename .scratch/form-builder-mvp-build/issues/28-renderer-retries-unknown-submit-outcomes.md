# 28: Renderer retries submissions whose outcome is unknown

**What to build:** When the renderer can't tell whether a submit succeeded, the respondent's answers stay put and Retry resends exactly the same submission, so a dropped reply never creates a duplicate response. An edit with an unknown outcome offers to reload or stay.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 21 (Submissions are safe to retry), 27 (Renderer handles edits, version changes and refusals).

**Status:** ready-for-agent

- [ ] On an unknown submit outcome, the answers become read-only with "We couldn't confirm your response was received" and a Retry that resends the same key and body.
- [ ] On an unknown edit outcome, the respondent chooses to reload or stay.
- [ ] Component tests: a rejected `fetch` and a 503 each lock the answers and show Retry; Retry resends the same key; a 201 moves on to the confirmation; a 422 after Retry unlocks the form.
- [ ] Playwright, renderer project: route interception lets a submit reach the server and drops its reply, and Retry shows the confirmation with the same `responseId` the server sent the first time.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
