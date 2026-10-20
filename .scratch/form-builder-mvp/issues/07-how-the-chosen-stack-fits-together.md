# How the chosen stack fits together

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04
Map: [Form builder MVP](../map.md)

## Question

Given the research on [Vite+ toolchain for a pnpm monorepo](./01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [Effect v4 HTTP API and OpenAPI contract](./02-effect-v4-http-api-and-openapi-contract.md), [Effect v4 with Drizzle and Postgres](./03-effect-v4-with-drizzle-and-postgres.md) and [Zod 4 alongside Effect Schema](./04-zod-4-alongside-effect-schema.md), lock the integration choices:

- Where Zod 4 is used and where Effect Schema is used, and how the canonical definition crosses the HTTP boundary.
- Which Effect plus Drizzle integration path and Postgres driver.
- How the API contract is published to hosts (OpenAPI, typed client, or both).
- The test-database approach for integration tests.
- Any Vite+ caveats that shape the repo setup.

## Answer

The schema split and browser client are recorded as [ADR 0004](../../../docs/adr/0004-two-schema-libraries-and-a-generated-browser-client.md).

Two fact checks ran during the session as throwaway experiments in `/tmp/oa-client` and `/tmp/drz-types`, with the pinned versions below. Their results are folded in and marked "(observed)".

- **Schema ownership**:
  - Effect Schema owns every HTTP and SQL contract: path params, query, headers, response envelopes and error bodies.
  - Zod 4, written only in `zod/mini`, owns the form definition (draft and form version content) and the answer schema built for each version. The core uses it, the server uses it, and the renderer bundles it.
  - There's no general converter in either direction.
- **Crossing the HTTP edge** (option c, a documentation-only bridge):
  - Bodies that carry a definition or answers are `Schema.Json` with a filter whose `toJsonSchema` hook returns the core's `z.toJSONSchema(…, { target: "draft-2020-12", io: "input" })`, annotated with an `identifier` such as `FormDefinition`. Nothing decodes through Zod at the edge. The core runs the Zod parse inside the use case, which is where the lenient draft-save rules and the strict publish rules are applied.
  - Observed: the hook shows up in `openapi.json` as a named component and generates a precise discriminated union on the client.
  - Answer bodies use the same hook with a fixed "any answer" schema from the core, never `Schema.Record(String, Json)`. That form generates `Record<string, never>` on the client, so valid payloads fail to type-check (observed). The core still runs the strict check for each version.
  - Code that generates JSON Schema from Zod stays on the server.
- **Validation errors**: one 422 `ValidationFailed { issues: [{ path, message }] }` body. Zod failures in the core produce it, and `HttpApiMiddleware.layerSchemaErrorTransform` maps Effect Schema decode failures at the edge onto the same shape, so clients handle one format.
- **Published contract**:
  - An OpenAPI 3.1 document generated from the `HttpApi` definition with `OpenApi.fromApi`, by a cached `vp run` task.
  - `openapi.json` is committed. A check task regenerates it and fails if the committed copy is out of date, and that check runs in CI.
  - HTTP schemas use `Schema.NullOr` instead of `Schema.optional`: optional fields are emitted as both optional and nullable, so clients see `field?: T | null` (observed).
- **Clients**:
  - Every TypeScript consumer (the renderer, the builder and the reference host) uses types generated from `openapi.json` by `openapi-typescript`, with `openapi-fetch` making the calls.
  - Observed with `openapi-typescript` 7.13.0 and `openapi-fetch` 0.17.0: they processed Effect's output with no errors, everything type-checked under strict TypeScript 6.0.3, and the client is 2.7 kB gzipped. `HttpApiClient` for the same call is 72.8 kB.
  - Effect is server-only. Dependency-cruiser enforces that browser packages never import `effect`. `HttpApiClient` and `HttpApiTest` are used only in server tests.
- **Serving**: the standalone API server app runs on `@effect/platform-node`. The API package also exports the same router as a Fetch handler through `HttpRouter.toWebHandler`, so a host can mount it in-process (ADR 0001 §3.3, "embedded"). The MVP exercises only the standalone server.
- **Effect plus Drizzle**:
  - The production driver is `drizzle-orm/effect-postgres` on `@effect/sql-pg`; tests use `drizzle-orm/effect-pglite` on `@effect/sql-pglite`.
  - Repositories depend on one `Db` service typed `EffectPgDatabase<typeof relations>` (from `drizzle-orm/effect-postgres`). Observed: it accepts the PGlite database with no casts, so the driver is chosen by the Layer you provide.
  - Pin the `rc5` build of `drizzle-orm` and `drizzle-kit`.
  - Keep the tsconfig `paths` shim (`"effect/unstable/sql/*": ["./node_modules/effect/dist/sql/*.d.ts"]`). Without it, every Drizzle error type quietly becomes `any` and the type check still passes (observed). A type-level test assigns a repository's error to a narrower type under `@ts-expect-error`, which guards the shim and signals when it can be removed.
  - `drizzle-kit` is used only for `generate` and `generate --custom`. Drizzle's Effect migrator applies migrations at server startup and in test setup, so there's no `pg` dev dependency and no `drizzle-kit migrate` or `push`.
- **Test database**:
  - The default `vp test` runs integration tests on in-process PGlite and needs no Docker.
  - A separate opt-in `test:pg` task runs a smaller suite on real PostgreSQL 18 through `@effect/sql-pg`. It covers concurrent publishing, lock waits, serialization failures, and the production driver and pool.
  - Real Postgres comes from a docker compose service, which is also the local development database and becomes the CI service container.
- **Pinning**: these are pinned exactly in the pnpm catalog, and upgrades are deliberate catalog edits.
  - `effect` and `@effect/*` at 4.0.5
  - `drizzle-orm` and `drizzle-kit` at 1.0.0-rc.5-5935859
  - `vite-plus`
  - `typescript` at 6.0.3
  - `@types/node`
- **Base tsconfig, repo-wide**:
  - `erasableSyntaxOnly: true`, because Node strips types from every package the server consumes through the `source` condition.
  - No `baseUrl`.
  - `skipLibCheck: true`: with it off, Drizzle's MySQL and Cockroach typings fail under strict options (observed).
  - `"types": ["node"]` set explicitly where Node types are used, since TypeScript 6 defaults `types` to empty (observed).
- **Svelte toolchain**: not part of this ticket. [Svelte 5 with Vite+ and the deep-module toolchain](./13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md) feeds [Package layout](./11-package-layout.md) and [Phased implementation plan and spec](./12-phased-implementation-plan-and-spec.md) directly. Any conflict it finds with the choices above, such as `erasableSyntaxOnly` or the `source` condition in `.svelte` files, gets resolved in Package layout.
