# 17: Demo seed and `seed:reset`

**What to build:** A host-owned demo seed, used for manual demos and as a realistic e2e background, and a `seed:reset` task that drops the module's schema and reseeds. The seed works only through the public API, so it can never break an invariant. It builds its own `createFormModuleHandler`, calls `migrate()`, gives `@fb/api-client` the handler's `fetch`, and signs the same claims as `/token` with the dev secret.

**Sources:** [Spec, Seed data and the database lifecycle](../../form-builder-mvp/spec.md#seed-data-and-the-database-lifecycle); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md).

**Blocked by:** 11 (Save drafts and publish immutable versions), 15 (Reference host serves the API to dev users).

**Status:** ready-for-agent

- [x] The dependency matrix gains one row, letting the reference host's seed import `http-api/web` and `api-client`, and dependency-cruiser enforces it.
- [x] The seed creates and publishes the dev tenants' first forms in `acme` and `globex`, through the API only.
- [x] `seed:reset` runs `DROP SCHEMA IF EXISTS form_management CASCADE` through `docker compose exec -T postgres psql`, then runs the seed, which re-migrates.
- [x] The `e2e` task depends on `seed:reset`, locally and in CI.
- [x] No test depends on the seed's data.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `t17-demo-seed`. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `apps/reference-host/seed/seed.ts` exports `seed(fetch)`: it drives the module's (unprefixed) Fetch handler through `@fb/api-client`, signing with `mintDevToken` from `server/dev-users.ts`, and throws on any non-2xx. Today it creates and publishes "Customer feedback" in `acme` (as `acme-admin`) and "Event registration" in `globex` (as `globex-admin`). Later phases extend this function (projects and references in phase 2, responses with per-submit `idempotencyKey`, the multi-version analytics form in phase 5). `seed/main.ts` is the entrypoint: handler on `databaseUrl`, `migrate()`, `seed`, `dispose`.
- `apps/reference-host/server/database-url.ts` exports `databaseUrl` (`DATABASE_URL`, else the compose URL), shared by the plugin, the seed and the `seed:reset` command.
- Matrix row `dependency-matrix-reference-host-seed`: `seed/` may import `http-api/web` and `api-client` (and its own app's `server/`), never `src/` or other packages.
- `@fb/reference-host#seed:reset` (uncached, depends on `formidabile#postgres`) drops the schema in `DATABASE_URL`'s database through `docker compose exec -T postgres psql`, so it assumes that URL points at the compose container. Uncached Vite tasks inherit the whole environment. The root `e2e` task depends on it, so e2e specs start with those two forms and must assert only on data they create.
- `apps/reference-host/tests/seed.test.ts` runs the seed against a PGlite API and checks each tenant's admin sees one published form; it's the seed's own test, not a dependency on its data.
