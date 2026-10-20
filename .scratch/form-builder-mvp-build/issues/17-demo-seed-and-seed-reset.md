# 17: Demo seed and `seed:reset`

**What to build:** A host-owned demo seed, used for manual demos and as a realistic e2e background, and a `seed:reset` task that drops the module's schema and reseeds. The seed works only through the public API, so it can never break an invariant. It builds its own `createFormModuleHandler`, calls `migrate()`, gives `@fb/api-client` the handler's `fetch`, and signs the same claims as `/token` with the dev secret.

**Sources:** [Spec, Seed data and the database lifecycle](../../form-builder-mvp/spec.md#seed-data-and-the-database-lifecycle); [ADR 0014](../../../docs/adr/0014-only-never-published-forms-can-be-deleted.md).

**Blocked by:** 11 (Save drafts and publish immutable versions), 15 (Reference host serves the API to dev users).

**Status:** ready-for-agent

- [ ] The dependency matrix gains one row, letting the reference host's seed import `http-api/web` and `api-client`, and dependency-cruiser enforces it.
- [ ] The seed creates and publishes the dev tenants' first forms in `acme` and `globex`, through the API only.
- [ ] `seed:reset` runs `DROP SCHEMA IF EXISTS form_management CASCADE` through `docker compose exec -T postgres psql`, then runs the seed, which re-migrates.
- [ ] The `e2e` task depends on `seed:reset`, locally and in CI.
- [ ] No test depends on the seed's data.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
