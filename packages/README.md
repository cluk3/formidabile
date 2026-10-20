# Packages

Each folder here is a deep module named `@fb/<name>`: a lot of behaviour behind a few entry points. Apps live in `apps/` and import packages the same way.

```
packages/<name>/
  definition.ts   ← an entry point (public). Every root file is one.
  answers.ts      ← packages expose several small entry points, never one barrel.
  lib/            ← implementation, private to the package.
  tests/          ← tests, which import entry points only.
  package.json    ← "exports" lists the entry points.
```

- **Import only through entry points.** Code outside a package imports its root files through the package name (`@fb/core/definition`), never anything in a subfolder. A package's own files import each other freely. Tests go through the entry points too, including their own package's.
- **No barrels.** Don't add an `index.ts` that re-exports a subtree. Add another root file and list it in `exports`.
- **Root config files aren't public.** `vite.config.ts`, `drizzle.config.ts` and `tsconfig.json` at a package root belong to that package's tooling. Nothing imports them.

## Generated files

`packages/http-api/openapi.json` is generated from `FormApi`, and `packages/api-client/lib/schema.d.ts` from that file. Both are committed and never edited by hand. After changing the API, run `vp run @fb/api-client#generate` (it regenerates both) and commit the result. `vp run check:generated` regenerates them and fails if either differs from the committed copy, and CI runs it.

## The database

`@fb/server` owns everything in the `form_management` Postgres schema, including Drizzle's migrations table.

- **Migrations** live in `packages/server/lib/persistence/migrations/` and are append-only: a merged migration is never edited. Generate one per schema change with `vp exec drizzle-kit generate --name=<name>` in `packages/server`, and triggers or checks with `generate --custom` in a separate step, so the two folders never share a timestamp second. CI runs `vp run @fb/server#check:migrations` (`drizzle-kit check`).
- **`vp test` needs no Docker.** Tests get a fresh, migrated in-process PGlite database from `DatabaseTest` in `@fb/server/testing`, once per build of the layer.
- **`*.pg.test.ts` files run only under `vp run test:pg`**, against real Postgres 18. The task starts the `docker-compose.yml` service first and uses it unless `DATABASE_URL` points elsewhere. Races between connections, and anything that needs the production driver, belong there.
- **The Drizzle `SqlError` shim** in `tsconfig.server.json` stays until Drizzle publishes the fix for its `effect/unstable/sql` imports. `packages/server/tests/sql-error-shim.test.ts` fails once the shim is no longer needed.

## Browser-safe code

These paths run in the browser:

- `packages/core`
- `packages/api-client`
- `packages/renderer`
- `apps/builder`
- `apps/reference-host/src`

Browser-safe code never imports `effect` or `@effect/*`, `drizzle-orm`, `jose`, Node built-ins, `@fb/server` or `@fb/http-api`. Everything else is server code. A new package is server code until it's added to this list on purpose.

`@fb/core` runs in both: its tsconfig sets `lib: ["ES2024"]` and `types: []`, so DOM or Node usage fails to compile.
