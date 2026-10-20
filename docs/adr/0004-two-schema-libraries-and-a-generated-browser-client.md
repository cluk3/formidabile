# ADR-004: Two schema libraries, and a generated client so Effect stays off the browser

- **Status:** Accepted
- **Date:** 2026-10-19

The backend is Effect v4, and its HTTP and SQL layers accept only Effect Schema. The form definition and the answer schema for each version, though, have to run inside the renderer, which every host embeds. So the repo deliberately uses two validation libraries. Effect Schema owns the HTTP and SQL contracts (params, headers, envelopes and error bodies). Zod 4, written in `zod/mini`, owns the form definition and answers in the framework-free core, and the server, the builder and the renderer all share it. The two never convert into each other. Definition and answer bodies cross the HTTP edge as `Schema.Json` with Zod's JSON Schema attached, for OpenAPI documentation only, and the core does the actual parse. That keeps the difference between draft-save and publish rules (ADR-001 §5) in the domain rather than in the HTTP layer.

For the same reason, no browser package imports `effect`, and dependency-cruiser enforces it. Browser consumers call the API through a client generated from the committed `openapi.json` with `openapi-typescript` and `openapi-fetch`, the same path any non-Effect host would take (ADR-001 §3.3).

## Considered options

- **Effect Schema everywhere, including the renderer.** Rejected: `effect/Schema` is about 26 KB gzipped, against about 9 KB for `zod/mini` validating the same schema, and the settled stack names Zod 4 for validation.
- **Zod everywhere, bridged into Effect's HTTP layer.** Rejected: Effect's HTTP slots don't accept Standard Schema. Both bridges examined lose either the static types or the OpenAPI schema, and JSON Schema conversions are lossy in both directions.
- **Decoding through Zod at the HTTP edge** (a full adapter). Rejected: it puts domain validation in the HTTP layer, and failed decodes need extra mapping to produce field errors.
- **Effect's `HttpApiClient` in the browser.** Rejected: 72.8 KB gzipped for one call, against 2.7 kB for `openapi-fetch`, and it would ship inside the self-contained custom element.

## Consequences

- HTTP schemas use `Schema.NullOr` rather than `Schema.optional`, because optional fields are emitted as nullable as well and generated clients lose precision.
- Code that generates JSON Schema from Zod lives only on the server, so the HTTP contract module must never be imported by browser code.
