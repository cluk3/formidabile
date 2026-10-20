# 10: Tracer bullet: an admin creates, lists and reads forms over HTTP

**What to build:** An admin holding `forms:manage` creates a form, with its first draft, and lists and reads forms through the HTTP API, using a host-signed identified token. Every request runs under tenancy and capabilities. This first path cuts through the actor, authorization, persistence, the `HttpApi`, the generated client and both serving modes. Later phase 1 tickets widen it.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) (identified claims), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`forms` group); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 02 (HTTP API and generated client shells), 07 (Form definitions and publish rules), 09 (Authoring tables with immutability enforced by triggers).

**Status:** ready-for-agent

- [ ] The actor model is `Identified { subject, tenant, capabilities, formId: Option, refs } | Anonymous { tenant, formId, refs }`, with `Capability`, a branded `TenantId`, and the `ActorResolver` port.
- [ ] Every resolver's actor, custom ones included, is checked after the resolver runs: `subject` and `tenant` must be 1 to 255 code points. One shared code-point check does this, not Effect Schema's UTF-16 length.
- [ ] The `Form` envelope and the form summary are declared once, as Effect Schemas in `@fb/server`. Revisions are opaque strings above persistence.
- [ ] Authorization has three capabilities. Admin reads accept `forms:manage` or `responses:read`, anonymous actors are refused on every admin use case, and another tenant's form is a 404.
- [ ] Repository functions take a branded `TenantId` and join through forms. Typed row mappers link Drizzle to the Effect Schemas, ids are UUIDv7, and timestamps come from Effect `Clock`.
- [ ] The JWT bearer middleware (HS256 or JWKS) accepts the identified claim set. No token gives 401 `missing`, and an expired, wrongly signed or wrong-audience token gives 401 `invalid`.
- [ ] The `forms` group has create, list and detail. The `Schema.Json` Zod bridge carries `FormDefinition`, and edge decode failures map onto `ValidationFailed`.
- [ ] `createFormModuleHandler` takes `resolveActor` and `cors`. `FormModuleLive` is exported, and `openapi.json` and the client are regenerated.
- [ ] `http-api` tests cover: no token gives 401 `missing`; expired, wrongly signed and wrong-audience tokens give 401 `invalid`; creating without `forms:manage` gives 403; `acme-analyst` reads forms; another tenant's admin gets 404.
- [ ] The `apps/api-server` smoke test also answers one authenticated request.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
