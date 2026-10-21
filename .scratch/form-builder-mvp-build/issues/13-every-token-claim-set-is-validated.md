# 13: Every token claim set is validated

**What to build:** The JWT resolver accepts every token shape the module will ever accept, and rejects everything else with 401 `invalid`. That covers both claim sets (identified tokens and anonymous grants), the `refs` claim, and the `form` binding. Respondent endpoints rely on this from phase 2. In this ticket the proofs run against the admin endpoints that already exist.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its [Security cases](../../form-builder-mvp/spec.md#security-cases); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) as amended by [ADR 0011](../../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md), [ADR 0012](../../../docs/adr/0012-response-references-are-host-signed-claims.md), [ADR 0013](../../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md) and [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [Anonymous respondent access and tenancy](../../form-builder-mvp/issues/19-anonymous-respondent-access-and-tenancy.md), [Trust in response external references](../../form-builder-mvp/issues/20-trust-in-response-external-references.md), [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 10 (Tracer bullet: an admin creates, lists and reads forms over HTTP).

**Status:** ready-for-agent

- [x] Each of these gives 401 `invalid`: `anonymous` with `sub`; `anonymous` with `capabilities`; `anonymous` without `form`; neither `sub` nor `anonymous`; `refs` without `form`; more than 20 `refs`; a duplicate `refs` entry; a `refs` entry with a bad shape; a `refs` entry with an extra key; a 256-code-point `sub` or `tenant`; a non-UUID `form`.
- [x] A `sub` of 255 emoji passes, and one of 256 emoji fails.
- [x] A custom resolver whose `subject` is 256 code points is rejected by the post-resolver check.
- [x] An integration test proves a custom `resolveActor` produces the same `Identified` and `Anonymous` actors as the JWT resolver, and that they pass the same checks.
- [x] An anonymous grant on any admin endpoint gives 403.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t13-token-claims`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `JwtActorResolver` now accepts exactly two claim sets. Identified: `sub`, `tenant`, `capabilities`, optional `form`, optional `refs` (which requires `form`, even when empty), and no `anonymous` key (`anonymous: false` is refused too). Anonymous grant: `anonymous: true`, `tenant`, `form`, optional `refs`, and no `sub` or `capabilities`. Other top-level claims are ignored; a `refs` entry with any key besides `namespace` and `refId` is refused. Identified tokens map `form` to `formId: Option.some(...)`; a missing `refs` becomes `[]`.
- The limits live in `authenticate` (`packages/server/lib/authorization/actor.ts`), so custom resolvers are held to them too: `subject`/`tenant` 1 to 255 code points, `formId` a UUID, at most 20 unique `refs` with `namespace` 1 to 64 code points matching `^[a-z][a-z0-9_.-]*$` and `refId` 1 to 255 code points (the `*_external_refs` check constraints), and an `Identified` actor with `refs` must have a `formId`. The code-point filter (`codePoints(min, max)`) is the one shared check; reuse it for any later Effect Schema cap.
- Nothing enforces the form binding yet. Phase 2's respondent use cases must check `formId` (404 on another form) and refuse grants on responses (`identityRequired`). Admin endpoints already refuse grants with 403.
- Claim tests are in `packages/http-api/tests/token-claims.test.ts`; the custom-versus-JWT parity is in `tests/web.test.ts`.
