# 14: Request body limits at the edge

**What to build:** The module's own edge middleware bounds request bodies before reading any of them. A body with no `Content-Length` gets 411 `LengthRequired`. A body over its limit gets 413 `PayloadTooLarge { limit }`: 1 MiB for create and draft-save bodies, and 16 KiB for every other body. Effect's `MaxBodySize` isn't used, because it's ignored on the web-handler path and resets the socket on Node.

**Sources:** [Spec, phase 1](../../form-builder-mvp/spec.md#phase-1-author-and-publish-through-the-api) and its "Caveats" section; [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [Request limits and abuse controls](../../form-builder-mvp/issues/25-request-limits-and-abuse-controls.md).

**Blocked by:** 12 (Delete never-published forms and change form settings).

**Status:** ready-for-agent

- [ ] A draft save declaring 1 MiB plus one byte gives 413 with that endpoint's `limit`.
- [ ] A `PATCH` on a form declaring 16 KiB plus one byte gives 413 with that endpoint's `limit`.
- [ ] A definition body just under 1 MiB is accepted.
- [ ] A chunked body with no `Content-Length` gives 411.
- [ ] A test shows the rejection happens before any of the body is read.
- [ ] `LengthRequired` and `PayloadTooLarge` appear in `openapi.json`, and the client is regenerated.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
