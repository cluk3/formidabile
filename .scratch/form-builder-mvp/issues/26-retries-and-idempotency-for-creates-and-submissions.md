# Retries and idempotency for creates and submissions

Type: grilling
Status: resolved
Blocked by: 19
Map: [Form builder MVP](../map.md)

## Question

What happens when a client retries a form creation or a submission whose first attempt committed, but whose response never arrived?

- `POST /forms` and `POST /respond/forms/{formId}/responses` take no idempotency key ([HTTP API surface](./16-http-api-surface.md)).
- Unlimited forms, including anonymous ones, accept any number of responses, so a retry becomes a second response.
- The renderer's error handling covers 401, the 409 conflicts and 422, but not a network failure after the write.

Options to weigh:

- A client-generated id (or an `Idempotency-Key` header) stored with a unique constraint, so a retry returns the first result.
- Accept duplicates: the renderer never retries by itself, and tells the respondent their answer may already be in.
- Single-use anonymous grants for submit, through a `jti` claim stored with a unique constraint. [Request limits and abuse controls](./25-request-limits-and-abuse-controls.md) (ADR 0015) left rate limiting to the host and handed this option here, because it is also an abuse control.

Decide also: the key's scope (per form, per respondent, and for anonymous respondents, who now hold a host-signed grant bound to one form with no subject, per [Anonymous respondent access and tenancy](./19-anonymous-respondent-access-and-tenancy.md)), how long keys are kept, what a reused key with a different body returns, the renderer's behaviour, and the tests.

## Answer

Recorded as [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md), which amends ADR 0007 and ADR 0010, and records the rejection of single-use grants handed over by ADR 0015. [Persistence model](./10-persistence-model.md) and [HTTP API surface](./16-http-api-surface.md) carry "Amended by" notes. No glossary changes: `idempotencyKey` is an implementation detail. It's deliberately not named `submissionKey`, because the glossary avoids "Submission" for **Response**.

- **Scope**: only submit gets a key.
  - Builder writes get none. Saves, discards and publishes are guarded by `expectedRevision`, settings are last-write-wins, and deletes repeat to the same result. A duplicate create leaves a never-published form the admin can delete ([Form lifecycle: deleting or archiving forms](./23-form-lifecycle-deleting-or-archiving-forms.md)). On an unknown outcome, the builder shows "couldn't confirm" and reloads the form list after a create, or the form's detail otherwise.
  - Response edits get none. Their revision guard means a retry can't duplicate anything. On an unknown outcome, the renderer offers the same reload or stay as `RevisionConflict`.
- **Unknown outcome**: a rejected `fetch` (network error, offline, aborted), any 5xx including a proxy's 502 or 504, or a 2xx or 4xx reply that doesn't decode into the contract. Every 4xx with a known `_tag` is definite, including ADR 0015's 411 and 413.
- **The key**: a required `idempotencyKey` UUID in the submit body, not an `Idempotency-Key` header, because revisions already travel in the body. Missing or malformed gives 422 `ValidationFailed`. It isn't the response id, because a client-chosen UUIDv7 could game the keyset ordering of the response list.
- **Storage**: a not-null `responses.idempotency_key` under `UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`. It's a fixed column under the response trigger.
  - A different identified respondent reusing a key creates a new response, so a replay never crosses respondents. Anonymous respondents share `respondent_id = null`, so among them it's unique per form. A copied key only returns an id its holder can't read.
  - It lives and dies with the response: no expiry, no cleanup job, and erasure removes it. A retry after erasure creates a new response.
- **Replay**: the lookup runs first under the `FOR SHARE` lock, before `FormClosed`, `VersionSuperseded` and `AlreadyResponded`. A match returns the same 201 `{ responseId, revision }` with the current revision. When two retries race, the loser's unique violation rolls back and the use case reruns once. The body isn't compared: the contract says a key's body is resent unchanged, and a custom renderer that breaks this gets the original response back.
  - Rejected: a stored body hash with a 409 on mismatch (canonicalised JSON, a column and another tag, for a mistake the renderer can't make).
- **Renderer**: no automatic retry. On an unknown submit, it keeps the answers read-only, shows "We couldn't confirm your response was received", and offers Retry with the same key and body. A 201 moves on to the confirmation, and a definite error unlocks the form. A key lives from the first Submit until a 201, so the next response gets a new key. It lives only in the mounted renderer, since carrying state over a reload is out of scope.
- **Custom-renderer contract** (`docs/embedding.md`): the key's lifetime, resending an unchanged body, the definition of an unknown outcome, and that a replay after closing or republishing still returns 201.
- **Single-use anonymous grants**: rejected, and grants stay reusable until `exp`. The renderer fetches a fresh grant before every request, so single use doesn't stop abuse. The real bounds are the host's rate limit on the endpoint that mints grants and short lifetimes (ADR 0015). It also wouldn't help retries, and it would need a `jti` table cleaned up by `exp`. A host that wants one submission per visit enforces it where it mints grants.
- **Accepting duplicates**: rejected. It's free, but unlimited forms would collect duplicates that the module's own analytics count.
- **Tests**:
  - **`server` use case, on PGlite**:
    - A replay returns the same `responseId` and inserts nothing.
    - A replay returns the original after the form closes, and after a new version is published.
    - A replay after an edit returns the current revision.
    - On a one-per-respondent form, a replay gives 201, not `AlreadyResponded`.
    - The same key from another identified respondent creates a second response.
    - An anonymous replay returns the original.
    - After erasure, the same key creates a new response.
  - **`test:pg`**: concurrent submits with the same key leave exactly one response.
  - **`@fb/http-api`**: a missing or malformed key gives 422, and a replay gives an identical 201 body.
  - **Renderer, in Vitest browser mode**: a rejected `fetch` and a 503 each lock the answers and show Retry. Retry resends the same key. A 201 moves on to the confirmation, and a 422 after Retry unlocks the form.
  - **Builder, in Vitest**: an unknown outcome on create reloads the form list.
  - **Playwright, renderer project (all three browsers)**: route interception lets the submit reach the server and drops its reply, then Retry. The form's response list shows exactly one response.
- **Map**: no new tickets. [Revise the phased plan and spec](./30-revise-the-phased-plan-and-spec.md) folds this into `spec.md`. A suggested placement: everything for submit in phase 2 (respond), and the builder's unknown-outcome reloads in phase 3 (builder).
