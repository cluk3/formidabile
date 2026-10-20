# 22: Respondents edit their own response

**What to build:** An identified respondent reads and edits their own response. An edit stays on the response's original form version, overwrites the answers, and never changes the stored external references, whatever the editing token carries.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md).

**Blocked by:** 20 (Tracer bullet: an identified respondent loads and submits a response), 21 (Submissions are safe to retry).

**Status:** ready-for-agent

- [ ] A respondent can read and replace their response through the `/respond` response endpoints. The edit body rejects unknown keys, so `externalRefs` gives 422, and it's limited to 1 MiB.
- [ ] An edit checks `FormClosed`, then `RevisionConflict`.
- [ ] Use case: editing a v1 response after v2 is published stays on v1.
- [ ] Use case: an edit with different `refs` leaves the stored references unchanged.
- [ ] Use case: replaying the original submit after an edit returns the same `responseId` with the current revision.
- [ ] `http-api`: reading or editing another respondent's response gives 404, and an identified token bound to form A gets 404 on form B's responses.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
