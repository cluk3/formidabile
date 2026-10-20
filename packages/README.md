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

## Browser-safe code

These paths run in the browser:

- `packages/core`
- `packages/api-client`
- `packages/renderer`
- `apps/builder`
- `apps/reference-host/src`

Browser-safe code never imports `effect` or `@effect/*`, `drizzle-orm`, `jose`, Node built-ins, `@fb/server` or `@fb/http-api`. Everything else is server code. A new package is server code until it's added to this list on purpose.

`@fb/core` runs in both: its tsconfig sets `lib: ["ES2024"]` and `types: []`, so DOM or Node usage fails to compile.
