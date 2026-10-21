# 22: Respondents edit their own response

**What to build:** An identified respondent reads and edits their own response. An edit stays on the response's original form version, overwrites the answers, and never changes the stored external references, whatever the editing token carries.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md).

**Blocked by:** 20 (Tracer bullet: an identified respondent loads and submits a response), 21 (Submissions are safe to retry).

**Status:** ready-for-agent

- [x] A respondent can read and replace their response through the `/respond` response endpoints. The edit body rejects unknown keys, so `externalRefs` gives 422, and it's limited to 1 MiB.
- [x] An edit checks `FormClosed`, then `RevisionConflict`.
- [x] Use case: editing a v1 response after v2 is published stays on v1.
- [x] Use case: an edit with different `refs` leaves the stored references unchanged.
- [x] Use case: replaying the original submit after an edit returns the same `responseId` with the current revision.
- [x] `http-api`: reading or editing another respondent's response gives 404, and an identified token bound to form A gets 404 on form B's responses.
- [x] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t22-edit-response`. The last box stays open until the PR's CI jobs report. Notes for later tickets (23, 26, 28 and 36 especially):

- `Submission` gains `read(actor, responseId)` → `RespondentResponse` (`{ response: { id, formId, versionId, revision, answers, submittedAt, editedAt }, version: { id, number, definition }, editable }`, `editable` = the form is open) and `edit(actor, responseId, { expectedRevision, answers })` → `EditedResponse` (`{ responseId, revision, editedAt }`). `@fb/server` exports both envelopes and the `EditResponse` input type.
- Both refuse an anonymous actor with 401 `identityRequired` before any read, so ticket 23 only needs the tests. Then `NotFound` covers an unknown id, another tenant, another respondent, and a form-bound actor whose `formId` isn't the response's form (the binding is checked after the lookup, since the path has no form id).
- Edit order: `NotFound`, `FormClosed`, `RevisionConflict`, then `ValidationFailed` against the response's own version (never the current one). It bumps `revision` by one, sets `edited_at` from `Clock`, deletes and reinserts the answer rows, and never touches `response_external_refs`.
- Locking (`lib/persistence/responses.ts` `findOwnResponse`): the response row is taken `FOR SHARE OF responses` on read and `FOR UPDATE OF responses` on edit, then the form row `FOR SHARE`. Racing edits from one revision serialize, and the loser gets `RevisionConflict` (`tests/submission-race.pg.test.ts`). The read's lock keeps its revision and answers from one edit.
- HTTP: `GET` and `PUT /respond/responses/{responseId}` in the `respond` group (`readResponse`, `editResponse`). The edit carries the 1 MiB `BodyLimit` and `onExcessProperty: "error"`; `responseId` is a UUID at the edge. Revisions are opaque strings: send back `response.revision` from the read as `expectedRevision`.
- The ticket 21 replay test that set `revision = 2` through SQL now edits through the use case (`a replay` › `after an edit …`).
- `answers.value` is now typed `jsonb().$type<Schema.Json>()` (type only, no migration).
