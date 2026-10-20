# 13: Every token claim set is validated

**What to build:** The JWT resolver accepts every token shape the module will ever accept, and rejects everything else with 401 `invalid`. That covers both claim sets (identified tokens and anonymous grants), the `refs` claim, and the `form` binding. Respondent endpoints rely on this from phase 2. In this ticket the proofs run against the admin endpoints that already exist.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) as amended by [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md) and [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md), [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [ ] Each of these gives 401 `invalid`: `anonymous` with `sub`; `anonymous` with `capabilities`; `anonymous` without `form`; neither `sub` nor `anonymous`; `refs` without `form`; more than 20 `refs`; a duplicate `refs` entry; a `refs` entry with a bad shape; a `refs` entry with an extra key; a 256-code-point `sub` or `tenant`; a non-UUID `form`.
- [ ] A `sub` of 255 emoji passes, and one of 256 emoji fails.
- [ ] A custom resolver whose `subject` is 256 code points is rejected by the post-resolver check.
- [ ] An integration test proves a custom `resolveActor` produces the same `Identified` and `Anonymous` actors as the JWT resolver, and that they pass the same checks.
- [ ] An anonymous grant on any admin endpoint gives 403.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
