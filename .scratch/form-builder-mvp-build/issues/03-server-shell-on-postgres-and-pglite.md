# 03: Server shell on Postgres and PGlite, plus `apps/api-server`

**What to build:** `@fb/server` as a shell that migrates and talks to Postgres 18 and PGlite, and `apps/api-server` as the second way of serving the (still empty) API, with the `test-pg` CI job real and green. This lands ADR 0015's timeouts and the Drizzle-on-Effect wiring before any table exists.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [ADR 0007](../../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md), [ADR 0015](../../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md); [Effect v4 with Drizzle](../../form-builder-mvp/issues/03-effect-v4-with-drizzle-and-postgres.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md), [CI pipeline](../../form-builder-mvp/issues/17-ci-pipeline.md); the spec's "Settled before hand-off" and "Caveats" sections.

**Blocked by:** 02 (HTTP API and generated client shells, with the drift check).

**Status:** ready-for-agent

- [x] `@fb/server` exposes the `index`, `actor`, `database`, `migrate` and `testing` entry points.
- [x] An empty Drizzle schema lives in the `form_management` `pgSchema`, with the drizzle-kit config, and the migration Effect uses Drizzle's Effect migrator with `migrationsSchema: "form_management"`.
- [x] A fresh-PGlite test layer exists, and `vp test` needs no Docker.
- [x] The `SqlError` shim's type test exists, and fails once a Drizzle build makes the shim unnecessary.
- [x] Every connection built from `databaseUrl` sets `statement_timeout` to 30 s through `@effect/sql-pg`'s startup parameters, in both serving modes.
- [x] `docker-compose.yml` uses one exact `postgres:18.x` tag. The opt-in `test:pg` task has `DATABASE_URL` in its `cache.env`.
- [x] `drizzle-kit check` runs in the `static` job.
- [x] `apps/api-server` runs on `@effect/platform-node`, migrates at startup, and runs with `node --conditions=source --watch`. It builds its own `createServer(...)` with `headersTimeout` 10 s and `requestTimeout` 30 s.
- [x] A smoke test under `test:pg` migrates, serves, and checks that `SHOW statement_timeout` on a module connection returns `30s`.
- [x] The `test-pg` CI job gets Postgres from `docker compose up --wait postgres`.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.
