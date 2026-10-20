# 27: Renderer handles edits, version changes and refusals

**What to build:** The renderer handles everything after the first submit, and every way the module can refuse. That means editing an existing response, a new version being published mid-session, closed and unavailable forms, sign-in prompts, and a clear message for each error.

**Sources:** [Spec, phase 2](../../form-builder-mvp/spec.md#phase-2-respond) (`@fb/renderer`); [ADR 0002](../../../docs/adr/0002-mvp-product-calls.md), [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md), [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md).

**Blocked by:** 22 (Respondents edit their own response), 23 (Anonymous respondents submit under a form-bound grant), 26 (Renderer fills in and submits all seven question types).

**Status:** ready-for-agent

- [ ] The renderer goes straight to editing through `myResponseId`, and edits a given response through `response-id`.
- [ ] On `RevisionConflict` the respondent chooses to reload or stay. On `VersionSuperseded` the renderer prompts a reload.
- [ ] The closed state shows for a closed form, and the unavailable state for `FormNotPublished`.
- [ ] The sign-in prompt is driven by `respondent` and `responseLimit`. A component test shows it follows `respondent: "anonymous"`.
- [ ] Component test: each 401 `reason` maps to its message.
- [ ] Component test: a 413 shows "Your answers are too long to send".
- [ ] Playwright, renderer project (three browsers): load, submit and edit; publish v2 behind an open form, submit, see the reload prompt, then submit on v2.
- [ ] Playwright, renderer project: the anonymous dev user submits to an unlimited form, and is prompted to sign in on a form limited to one response per respondent.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
