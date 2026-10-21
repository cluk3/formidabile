# 20: Tracer bullet: an identified respondent loads and submits a response

**What to build:** An identified respondent loads a form's current published version and submits a response to it through the `/respond` group. The external references the host signed into the token are stored with the response, atomically. A token bound to one form reaches only that form. Retries, edits and anonymous respondents build on this path in the next three tickets.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) (respondent rules), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md).

**Blocked by:** 13 (Every token claim set is validated), 16 (Serving-mode parity test), 18 (Answer schemas for all seven question types), 19 (Response and external-reference tables).

**Status:** ready-for-agent

- [x] The load returns the current published version and `respondent`, as HTTP API surface specifies.
- [x] The submit body is `{ versionId, answers, idempotencyKey }` and rejects unknown keys, so `externalRefs` in the body gives 422 and nothing is stored. A missing or malformed `idempotencyKey` gives 422. The key is stored with the response; replay comes in ticket 21.
- [x] Submit runs under `FOR SHARE` on the form row, checks `FormClosed`, `VersionSuperseded` and `AlreadyResponded` in that order, and stores the actor's `refs` atomically with the response.
- [x] Respondent use cases check a form-bound actor's `formId` before any read, and give `NotFound` on a mismatch.
- [x] The `AnyAnswers` bridge is in place, submit bodies are limited to 1 MiB, and the `FormClosed`, `VersionSuperseded` and `AlreadyResponded` errors exist.
- [x] Use case: responses on v1 still point at v1 after v2 is published.
- [x] Use case: submitting against a superseded version gives `VersionSuperseded` with `currentVersionId`.
- [x] Use case: the submit check order is tested.
- [x] Use case: the response limit gives `AlreadyResponded` with the most recent `responseId`.
- [x] Use case: the stored references equal the actor's `refs`, and an empty `refs` stores none.
- [x] `http-api`: a respondent from another tenant gets 404 on submit; a token with `form` and `refs` submits and the references are stored; an identified token bound to form A gets 404 on form B's load and submit; a custom resolver returning `refs` gets them stored; a submit declaring 1 MiB plus one byte gives 413.
- [x] The parity table gains a submit row.
- [x] `openapi.json` and the client are regenerated.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t20-respondent-submit`. The last box stays open until the PR's CI jobs report. Notes for later tickets (21, 22, 23 and 26 especially):

- `@fb/server` exports the `Submission` service (in `FormModuleLive`, code in `lib/submission/submission.ts`): `load(actor, formId)` gives `RespondentForm` and `submit(actor, formId, { versionId, answers, idempotencyKey })` gives `SubmittedResponse` (`{ responseId, revision }`, revision an opaque string, `"1"` on submit). It also exports the errors `FormClosed`, `VersionSuperseded { currentVersionId }`, `AlreadyResponded { responseId }` (all 409), the `AnswersJson` bridge schema and the `SubmitResponse` input type.
- Both use cases first check the form binding (`reaches`: an anonymous grant's `formId`, or an identified actor's `Some(formId)`), giving `NotFound` before any read. Then they run in one `READ COMMITTED` transaction under `shareForm(tx, tenant, formId)` (`lib/persistence/forms.ts`, `SELECT … FOR SHARE`, branded `SharedForm`); response repositories in `lib/persistence/responses.ts` take a `SharedForm`.
- Load checks `NotFound`, then `FormNotPublished` (a never-published form is always closed, so it must come first), then `FormClosed`. `myResponseId` is the most recent response (by `submitted_at`, then `id`) of an identified respondent on a one-per-respondent form, whatever each response's `limited` flag.
- Submit checks `NotFound`, `FormClosed`, `VersionSuperseded`, `AlreadyResponded` (any earlier response by the subject, including ones collected while unlimited), then `ValidationFailed` from `validateAnswers` against the stored definition. It stores the validated (trimmed) answers, `limited` from the form's limit, and the actor's `refs`. Ticket 21's key lookup goes right after `shareForm`, before `FormClosed`.
- A 23505 on `responses_one_per_respondent` reruns the transaction once (the rerun gives `AlreadyResponded`); `tests/submission-race.pg.test.ts` proves it. `isUniqueViolation(error, constraint)` in `lib/persistence/database.ts` reads the constraint from either driver's `UniqueViolation`; ticket 21 adds `responses_idempotency_key_unique` to the same `catchIf`.
- Anonymous actors: load works and reports `respondent: "anonymous"`, but submit refuses every grant with 401 `identityRequired` before the transaction. Ticket 23 narrows that to limited forms (decided under the lock) and stores `respondentId: null`.
- HTTP: the `respond` group (`RespondGroup` in `packages/http-api/lib/api.ts`), `GET /respond/forms/{formId}` and `POST /respond/forms/{formId}/responses` (201). The submit endpoint carries `.annotate(BodyLimit, largeBody)` and `.annotate(HttpApi.PayloadParseOptions, { onExcessProperty: "error" })`, which is how unknown keys such as `externalRefs` give 422; ticket 22's edit endpoint needs both. `versionId` and `idempotencyKey` are UUIDs at the edge. The OpenAPI `transform` fills the `AnyAnswers` component from core's `AnyAnswers` (`documented(schema)` helper).
- `packages/http-api/tests/respond.test.ts` runs a JWT handler and a custom-resolver handler on one PGlite database (`ManagedRuntime.make(DatabaseTest)`), and reads stored rows through its `query` helper; later respondent tests can extend it.
- Parity: the `a respondent submits a response` row posts to an open form seeded in `beforeAll` (`openForm`). Rows marked `creates: true` compare bodies with every UUID replaced by `<id>`, since each send makes a new response. Ticket 21's replay row can compare exactly.
