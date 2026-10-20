# 35: Admins list and read responses against their versions

**What to build:** Admins with `responses:read` list their tenant's responses and read each one against the form version it was submitted under. Historical answers stay interpretable after later versions change the questions.

**Sources:** [Spec, phase 4](../../form-builder-mvp/spec.md#phase-4-responses-and-history); ADR 0001 §8.1 in [ADR 0001](../../../docs/adr/0001-modular-versioned-form-management.md), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`responses` group), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md) (access requests); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 21 (Submissions are safe to retry), 22 (Respondents edit their own response), 24 (Forms carry external references).

**Status:** ready-for-agent

- [ ] The list is newest first, with keyset pagination on `id`, and a `limit` of 50 by default and 200 at most. Every filter is optional: form, version, external reference and respondent.
- [ ] Reading a response embeds its form version.
- [ ] A `respondentId` must be 1 to 255 code points, using the shared check: a 256-code-point `respondentId` gives 422.
- [ ] Use case and `http-api`: reading a v1 response after v2 dropped one of its questions and relabelled an option returns v1's snapshots and the raw answers.
- [ ] Use case and `http-api`: pagination is stable across edits.
- [ ] Use case and `http-api`: filtering by `respondentId` with no `formId` lists that respondent's responses across every form in the tenant, and none from another tenant.
- [ ] Use case and `http-api`: listing by reference finds a response submitted under that `refs` claim.
- [ ] `http-api`: reading responses without `responses:read` gives 403, and another tenant's admin gets 404.
- [ ] `openapi.json` and the client are regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
