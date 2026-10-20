# 20: Tracer bullet: an identified respondent loads and submits a response

**What to build:** An identified respondent loads a form's current published version and submits a response to it through the `/respond` group. The external references the host signed into the token are stored with the response, atomically. A token bound to one form reaches only that form. Retries, edits and anonymous respondents build on this path in the next three tickets.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) (respondent rules), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md), [ADR 0016](../../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md).

**Blocked by:** 13 (Every token claim set is validated), 16 (Serving-mode parity test), 18 (Answer schemas for all seven question types), 19 (Response and external-reference tables).

**Status:** ready-for-agent

- [ ] The load returns the current published version and `respondent`, as HTTP API surface specifies.
- [ ] The submit body is `{ versionId, answers, idempotencyKey }` and rejects unknown keys, so `externalRefs` in the body gives 422 and nothing is stored. A missing or malformed `idempotencyKey` gives 422. The key is stored with the response; replay comes in ticket 21.
- [ ] Submit runs under `FOR SHARE` on the form row, checks `FormClosed`, `VersionSuperseded` and `AlreadyResponded` in that order, and stores the actor's `refs` atomically with the response.
- [ ] Respondent use cases check a form-bound actor's `formId` before any read, and give `NotFound` on a mismatch.
- [ ] The `AnyAnswers` bridge is in place, submit bodies are limited to 1 MiB, and the `FormClosed`, `VersionSuperseded` and `AlreadyResponded` errors exist.
- [ ] Use case: responses on v1 still point at v1 after v2 is published.
- [ ] Use case: submitting against a superseded version gives `VersionSuperseded` with `currentVersionId`.
- [ ] Use case: the submit check order is tested.
- [ ] Use case: the response limit gives `AlreadyResponded` with the most recent `responseId`.
- [ ] Use case: the stored references equal the actor's `refs`, and an empty `refs` stores none.
- [ ] `http-api`: a respondent from another tenant gets 404 on submit; a token with `form` and `refs` submits and the references are stored; an identified token bound to form A gets 404 on form B's load and submit; a custom resolver returning `refs` gets them stored; a submit declaring 1 MiB plus one byte gives 413.
- [ ] The parity table gains a submit row.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
