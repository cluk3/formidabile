# Effect v4 HTTP API and OpenAPI contract

Type: research
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

How is an HTTP API built with Effect v4, and can it publish a framework-neutral contract that host applications on any stack can consume (ADR 0001 §3.3)?

Find out:

- Effect v4 release status and package layout (what moved into `effect` core, what remains in `@effect/platform*` or other packages).
- The HTTP API building blocks (e.g. `HttpApi`, groups, endpoints, middleware), and how a Node server is run.
- OpenAPI generation from the API definition, and whether a typed client can be derived for TypeScript hosts.
- How authentication and authorization middleware is expressed (relevant to a host-supplied actor identity seam).
- How errors are modelled and mapped to HTTP responses.
- How the API is tested (in-process test clients, layers for test doubles).
- Whether request and response schemas must be Effect Schema, or whether Standard Schema or Zod can be used at the boundary.

## Answer

Yes: you define the API once as `HttpApi` → `HttpApiGroup` → `HttpApiEndpoint` with Effect Schemas, and `OpenApi.fromApi` turns it into an OpenAPI 3.1.0 contract that any host can consume, while TypeScript hosts that use Effect can also derive a typed client with `HttpApiClient.make`. `effect@4.0.0` became stable (LTS) on 2026-10-01 (`latest` is `4.0.5`), with all packages on one version and `@effect/platform` merged into `effect`, so the HTTP code is in `effect/http` and `effect/http-api`, served on Node by `@effect/platform-node` or exported as a Fetch handler with `HttpRouter.toWebHandler`. These modules are tagged `@stability unstable`, which allows breaking changes in minor releases, so versions must be pinned exactly. Authentication is an `HttpApiMiddleware.Service` with a `bearer`, `apiKey` or `basic` scheme that provides an `Actor` service through a swappable `Layer` (the host identity seam), and errors are `Schema.TaggedError`s with `httpApiStatus`: the compiler only allows declared errors, and a request that fails validation gets an empty 400 unless `layerSchemaErrorTransform` replaces it. Tests use `HttpApiTest.groups`, an in-memory typed client that runs the real encoding and routing, with in-memory layers and `@effect/vitest` (which requires Vitest 5). Endpoint schemas must be Effect Schema (the slots are typed `Schema.Top`, and Zod fails to compile); Standard Schema support only goes outward via `Schema.toStandardSchemaV1`, and both ways of bridging Zod lose either static types or the OpenAPI schema.

[Findings](../research/effect-v4-http-api.md)
