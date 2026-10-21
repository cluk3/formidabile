# 28: Renderer retries submissions whose outcome is unknown

**What to build:** When the renderer can't tell whether a submit succeeded, the respondent's answers stay put and Retry resends exactly the same submission, so a dropped reply never creates a duplicate response. An edit with an unknown outcome offers to reload or stay.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [Retries and idempotency for creates and submissions](../../form-builder-mvp/issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Blocked by:** 21 (Submissions are safe to retry), 27 (Renderer handles edits, version changes and refusals).

**Status:** ready-for-agent

- [x] On an unknown submit outcome, the answers become read-only with "We couldn't confirm your response was received" and a Retry that resends the same key and body.
- [x] On an unknown edit outcome, the respondent chooses to reload or stay.
- [x] Component tests: a rejected `fetch` and a 503 each lock the answers and show Retry; Retry resends the same key; a 201 moves on to the confirmation; a 422 after Retry unlocks the form.
- [x] Playwright, renderer project: route interception lets a submit reach the server and drops its reply, and Retry shows the confirmation with the same `responseId` the server sent the first time.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t28-renderer-retries`. The last box stays open until the PR's CI jobs report. Notes for later tickets (29, 30 and the embedding docs especially):

- `FormRenderer.svelte`'s `settle` sorts every submit and edit reply (ADR 0016): a 2xx with a string `responseId` succeeds; a 413 is `tooLarge`; a rejected `fetch`, any 5xx, a 2xx without a `responseId` (or not JSON), and a 4xx whose `_tag` isn't one of the contract's (the `refusals` map, `satisfies Record<Refusal["_tag"], true>`) are unknown; every other tagged 4xx goes to `refuse` as before. A new tag in the contract must be added to `refusals` (type-check fails otherwise) and handled in `refuse`, or it lands on `sendFailed`.
- New `ProblemCode`s in `lib/problems.ts`, both fired through `onerror`/`error`: `submitUnconfirmed` ("We couldn't confirm your response was received. Retry to send the same answers again.") and `editUnconfirmed` (Reload and Stay, like `revisionConflict`; edits aren't locked). `sendFailed` now only shows for a `ValidationFailed` without question paths, a 411, or a host `getToken` that throws (the request was never sent, so the form stays editable and that isn't an unknown outcome).
- On `submitUnconfirmed` the questions sit in a `<fieldset class="answers" disabled>`, and the Submit button itself reads "Retry" and resends the stored `Submission` body (not one rebuilt from the drafts), so focus stays on it. Any definite refusal after a Retry clears the notice and unlocks the form; the key stays until a 201.
- Tests: `tests/form-renderer-retries.browser.test.ts` (component); ticket 26's "key resent until a 201" test moved there. e2e: `e2e/renderer/retries.spec.ts` stores the first submit through `route.fetch()` and then `route.abort("failed")`, `{ times: 1 }`, and reads the element's `submitted` event. There's no admin response list yet, so "exactly one response" is shown by the replay's `responseId`; ticket 35 can add the count.
