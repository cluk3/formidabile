# 14: Request body limits at the edge

**What to build:** The module's own edge middleware bounds request bodies before reading any of them. A body with no `Content-Length` gets 411 `LengthRequired`. A body over its limit gets 413 `PayloadTooLarge { limit }`: 1 MiB for create and draft-save bodies, and 16 KiB for every other body. Effect's `MaxBodySize` isn't used, because it's ignored on the web-handler path and resets the socket on Node.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its "Caveats" section; [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 12 (Delete never-published forms and change form settings).

**Status:** ready-for-agent

- [x] A draft save declaring 1 MiB plus one byte gives 413 with that endpoint's `limit`.
- [x] A `PATCH` on a form declaring 16 KiB plus one byte gives 413 with that endpoint's `limit`.
- [x] A definition body just under 1 MiB is accepted.
- [x] A chunked body with no `Content-Length` gives 411.
- [x] A test shows the rejection happens before any of the body is read.
- [x] `LengthRequired` and `PayloadTooLarge` appear in `openapi.json`, and the client is regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t14-body-limits`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `BodyLimits` (`packages/http-api/lib/api.ts`, live layer in `lib/middleware.ts`) is the edge middleware. Every group adds it last, after `.middleware(EdgeValidation).middleware(Authentication)`, so it runs first: an oversized or undeclared body gets 411/413 before the token is checked. New groups (the `/respond` group, responses, external references) must add `.middleware(BodyLimits)` the same way.
- The limit is the endpoint annotation `BodyLimit` (a `Context.Reference`, default 16 KiB). Create and draft save carry `.annotate(BodyLimit, largeBody)` (1 MiB); ticket 20's submit and ticket 22's edit must do the same. `largeBody` is module-private in `lib/api.ts`.
- A request has a body when its endpoint declares a payload or it carries `content-length` or `transfer-encoding`. Then a missing or non-decimal `Content-Length` is 411 `LengthRequired`, and over the limit is 413 `PayloadTooLarge { limit }` (bytes). Payload-less endpoints with no framing headers pass untouched, so node-fetch-server's empty body stream on a `DELETE` is fine.
- In-process callers must declare the length: `@fb/http-api/web` exports `declareLength(request)`, which buffers the body and sets `content-length`. `startApi().clientAs/clientWithToken` (http-api `tests/api.ts`), the demo seed (`seed/seed.ts`) and the reference-host test client use it; `startApi().fetch` stays raw so tests can send undeclared bodies. A new in-process test client that sends a body needs it, or it gets 411.
