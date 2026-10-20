# Map: Form builder MVP

Label: wayfinder:map

## Destination

A hand-off spec at `.scratch/form-builder-mvp/spec.md` that locks how the chosen stack fits together, the repo and package layout, and a phased implementation plan (phase 0 is repo setup), ready for `/to-tickets`. The MVP bar is the "must demonstrate" list in [ADR 0001 §12](../../docs/adr/0001-modular-versioned-form-management.md).

## Notes

- **Domain**: [ADR 0001](../../docs/adr/0001-modular-versioned-form-management.md) is the authoritative spec; use the vocabulary in [GLOSSARY.md](../../GLOSSARY.md). Never weaken the ADR §5 invariants to fit a technology.
- **Planning only**: no production code inside this map. Repo scaffolding is phase 0 of the hand-off plan, not work done here.
- **Shape of the MVP**: a reusable form module (core domain, API, builder UI, renderer, analytics) plus a thin reference host app proving the §3 integration story, all in one repo.
- **Constraints**: solo personal project, free or self-hostable infrastructure only, local-first (deployable later).
- **Settled stack** (standing preferences, not up for re-decision):
  - TypeScript (strict) on Node LTS.
  - pnpm workspaces with **Vite+** as the toolchain (dev, build, test, lint, format, task running).
  - Packages are deep modules: only root files are public, enforced by dependency-cruiser (`setup-ts-deep-modules`).
  - Vitest for unit and integration tests; Playwright for end-to-end tests.
  - **Effect v4** for the backend.
  - **Postgres** with **Drizzle** for persistence.
  - **Zod 4** for validation.
- **Skills**: grilling tickets call `grilling` + `domain-modeling`; prototype tickets call `prototype`; research tickets call `research`.
- **Research findings** live at `.scratch/form-builder-mvp/research/<name>.md` (no git remote, so no research branches).

## Decisions so far

<!-- one line per closed ticket: [title](./issues/NN-slug.md): gist -->

- [Vite+ toolchain for a pnpm monorepo](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md): Vite+ 1.3 (MIT) covers dev, app build, library build (`vp pack`/tsdown), Vitest 5, Oxlint, Oxfmt, type checking (`vp check`) and cached workspace tasks (`vp run`), all from one root `vite.config.ts`. Its templates default to TypeScript `^7`, which dependency-cruiser 18.6 can't parse, so phase 0 must pin TypeScript 6.0.3. There's no Node-server command: the backend runs with `node --conditions=source --watch`, and workspace libraries are consumed from source through a `source` export condition. Playwright runs as a separate task.
- [Effect v4 HTTP API and OpenAPI contract](./issues/02-effect-v4-http-api-and-openapi-contract.md): an `effect/http-api` definition with Effect Schema at the boundary publishes an OpenAPI 3.1 contract and a derived TypeScript client. The HTTP modules are `@stability unstable`, so pin exact versions.
- [Effect v4 with Drizzle and Postgres](./issues/03-effect-v4-with-drizzle-and-postgres.md): use Drizzle's native `drizzle-orm/effect-postgres` on `@effect/sql-pg` (now a native driver, not `pg`). Pin the `rc5` build of `drizzle-orm` and `drizzle-kit`, because the `rc` tag crashes on stable Effect. Transactions are atomic, nest as savepoints, and are shared with raw `effect/sql`. Use PGlite for fast tests and real Postgres in CI. Enforce immutability with triggers in custom migrations.
- [Zod 4 alongside Effect Schema](./issues/04-zod-4-alongside-effect-schema.md): Effect HTTP API and SQL accept only Effect Schema, so Effect Schema owns those contracts. Zod 4 (authored in `zod/mini` for the renderer) owns the form definition and the per-version answer schemas. They cross the HTTP edge as `Schema.Json` plus a Zod parse, or through a small JSON-body adapter; no general converter.

## Not yet specified

- **CI pipeline**: what runs where (Vite+ tasks, dependency-cruiser, Playwright, a Postgres service) once the package layout and test-database approach are known.
- **How analytics queries are built**: in SQL or in application code, and how cross-version compatibility (ADR §8.2) is expressed. Depends on the persistence model.
- **Privacy and deletion mechanics for the MVP**: what ADR §9 needs in the MVP (respondent data deletion or anonymisation alongside immutable versions). Depends on the retention call in the MVP product calls.
- **Test data and seeding**: fixtures and seed forms for the reference host and for end-to-end tests.

## Out of scope

- Production deployment and hosting: the MVP is local-first.
- Integration events, webhooks, retries and duplicate notifications (ADR §13, last item).
- Sharing forms across multiple applications or tenants.
- Approval workflows for publication.
- Scheduled future activation of a published version.
- Manual normalisation of historical answers by administrators.
