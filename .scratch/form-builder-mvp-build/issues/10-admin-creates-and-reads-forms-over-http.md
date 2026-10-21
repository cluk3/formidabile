# 10: Tracer bullet: an admin creates, lists and reads forms over HTTP

**What to build:** An admin holding `forms:manage` creates a form, with its first draft, and lists and reads forms through the HTTP API, using a host-signed identified token. Every request runs under tenancy and capabilities. This first path cuts through the actor, authorization, persistence, the `HttpApi`, the generated client and both serving modes. Later phase 1 tickets widen it.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api); [ADR 0006](../../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md) (identified claims), [ADR 0010](../../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md) (`forms` group); [Identity, authorization and tenancy seam](../../form-builder-mvp/issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](../../form-builder-mvp/issues/10-persistence-model.md), [HTTP API surface](../../form-builder-mvp/issues/16-http-api-surface.md).

**Blocked by:** 02 (HTTP API and generated client shells), 07 (Form definitions and publish rules), 09 (Authoring tables with immutability enforced by triggers).

**Status:** ready-for-agent

- [x] The actor model is `Identified { subject, tenant, capabilities, formId: Option, refs } | Anonymous { tenant, formId, refs }`, with `Capability`, a branded `TenantId`, and the `ActorResolver` port.
- [x] Every resolver's actor, custom ones included, is checked after the resolver runs: `subject` and `tenant` must be 1 to 255 code points. One shared code-point check does this, not Effect Schema's UTF-16 length.
- [x] The `Form` envelope and the form summary are declared once, as Effect Schemas in `@fb/server`. Revisions are opaque strings above persistence.
- [x] Authorization has three capabilities. Admin reads accept `forms:manage` or `responses:read`, anonymous actors are refused on every admin use case, and another tenant's form is a 404.
- [x] Repository functions take a branded `TenantId` and join through forms. Typed row mappers link Drizzle to the Effect Schemas, ids are UUIDv7, and timestamps come from Effect `Clock`.
- [x] The JWT bearer middleware (HS256 or JWKS) accepts the identified claim set. No token gives 401 `missing`, and an expired, wrongly signed or wrong-audience token gives 401 `invalid`.
- [x] The `forms` group has create, list and detail. The `Schema.Json` Zod bridge carries `FormDefinition`, and edge decode failures map onto `ValidationFailed`.
- [x] `createFormModuleHandler` takes `resolveActor` and `cors`. `FormModuleLive` is exported, and `openapi.json` and the client are regenerated.
- [x] `http-api` tests cover: no token gives 401 `missing`; expired, wrongly signed and wrong-audience tokens give 401 `invalid`; creating without `forms:manage` gives 403; `acme-analyst` reads forms; another tenant's admin gets 404.
- [x] The `apps/api-server` smoke test also answers one authenticated request.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t10-forms-over-http`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `@fb/server/actor` exports `Actor` (a `Data.TaggedEnum`: `Actor.Identified({...})`, `Actor.Anonymous({...})`), `Capability`, `TenantId` (a brand with no check of its own), `ExternalRef`, `Unauthenticated`, the `ActorResolver` port and `authenticate(request)`. A resolver gets an `ActorRequest` (`headers`, plus `source`, the platform request: the Fetch `Request` under `createFormModuleHandler`). `authenticate` runs the resolver and then the one code-point check on `subject` and `tenant`, so every resolver is held to it. Ticket 13 adds claim shapes in `packages/http-api/lib/jwt.ts`; the post-resolver check already exists.
- `JwtActorResolver(options)` in `@fb/http-api` returns the layer. It accepts only the identified claim set (`sub`, `tenant`, `capabilities`, required `exp`, checked `iss`/`aud`), and always yields `formId: Option.none()` and `refs: []`. No `Authorization` header is `missing`; anything else wrong is `invalid`.
- `@fb/server` (`index.ts`) exports the envelopes (`Form`, `FormSummary`, `FormDetail`, `Draft`, `DraftSummary`, `VersionSummary`, `FormDefinitionJson`), the errors (`Forbidden`, `NotFound`, `ValidationFailed`, `Issue`), the `Forms` use-case service and `FormModuleLive`. `Draft` and `VersionSummary` are declared here because create returns a draft and the list shows the current version; ticket 11 reuses them and adds `FormVersion`.
- The Zod bridge: `FormDefinitionJson` is `Schema.Json` with the identifier `FormDefinition`, and `FormApi`'s OpenAPI `transform` fills that component with `z.toJSONSchema(FormDefinition)`. Any envelope that uses `FormDefinitionJson` is documented with no more work. `@fb/core`'s `parseDefinition` does the real parse in the use case.
- Every admin group needs `.middleware(EdgeValidation).middleware(Authentication)` (see `FormsGroup` in `packages/http-api/lib/api.ts`). Handlers read the actor with `CurrentActor`. Authorization is `requireCapability` / `requireAdminRead` in `packages/server/lib/authorization/authorization.ts`; both refuse anonymous actors with `Forbidden`.
- Repositories live in `packages/server/lib/persistence/forms.ts`, take a `TenantId` and filter on `forms.tenant`. `newId` (UUIDv7) and `currentInstant` (from `Clock`) are in `lib/persistence/ids.ts`. Both `definition` columns are typed `$type<Schema.Json>()`, a type-only change with no migration.
- `createFormModuleHandler({ databaseUrl, cors?, jwt } | { databaseUrl, cors?, resolveActor })`: `resolveActor(request)` returning `null` gives 401 `missing`. `migrate()` and the handler share one pool through a memo map. The Effect web handler is built on the first `fetch`, because `toWebHandler` builds its layer at once, and the open pool kept the reference host's `vite build` alive (`tests/web.pg.test.ts` guards this). The pool connects lazily, so requests refused before the database (401, 403, CORS preflight) work with an unreachable `databaseUrl`, and `tests/web.test.ts` relies on that.
- Routes have no prefix. The reference host still forwards `/api/...` unchanged; ticket 15 must strip the mount prefix. `apps/reference-host/server/plugin.ts` got a placeholder `devJwt` only so it compiles.
- `apps/api-server` now needs `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_SECRET` or `JWT_JWKS_URL` (README updated). `ServerLive` requires an `ActorResolver`.
- `FormDetail` has no `externalRefs` yet; ticket 24 adds it with the reference table. A non-UUID `formId` gives 422 from the edge.
