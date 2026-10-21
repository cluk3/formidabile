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

## The workspace

| Workspace             | Entry points                                                               | Runs in         |
| --------------------- | -------------------------------------------------------------------------- | --------------- |
| `@fb/core`            | `definition`, `answers`, `editing`                                         | browser, server |
| `@fb/api-client`      | `.`                                                                        | browser         |
| `@fb/renderer`        | `.` (Svelte component), `./element` (built `<form-renderer>`)              | browser         |
| `@fb/server`          | `.`, `actor`, `database`, `migrate`, `testing`                             | server          |
| `@fb/http-api`        | `.`, `web`                                                                 | server          |
| `apps/api-server`     | none: nothing imports an app                                               | server          |
| `apps/builder`        | none                                                                       | browser         |
| `apps/reference-host` | none. `src/` is the page, `server/` the Vite plugin, `seed/` the demo seed | browser, server |

## Boundaries

`vp run boundaries` runs dependency-cruiser with `.dependency-cruiser.cjs` over `packages/`, `apps/` and `e2e/`. It is part of `vp run ready` and the `static` CI job. A violation names its rule, and the rule's `comment` in the config says why it exists.

- **Deep imports.** `entrypoint-boundary-from-app`, `entrypoint-boundary-across-packages`, `tests-through-entrypoints` and `tests-folder-is-private` enforce the import rules above. A package's tests are held to them too.
- **No config imports.** `no-config-imports` bans importing any `*.config.ts`.
- **No cycles.** `no-circular` applies everywhere except shadcn-svelte's vendored `components/ui/`.
- **Browser-safe code.** The `browser-safe-*` rules apply the list below. Tests and `*.config.ts` files run in Node, so they are exempt.
- **Who may import whom.** One `dependency-matrix-*` rule per row. Any workspace dependency not in the table is forbidden, and tests may import any package.

  | From                         | May import                                                     |
  | ---------------------------- | -------------------------------------------------------------- |
  | `core`                       | no workspace packages                                          |
  | `api-client`                 | no workspace packages                                          |
  | `renderer`                   | `core` (`definition`, `answers`), `api-client`                 |
  | `server`                     | `core`                                                         |
  | `http-api`                   | `server`, `core`                                               |
  | `apps/api-server`            | `http-api`, `server`                                           |
  | `apps/builder`               | `core`, `api-client`, the `renderer` component (not `element`) |
  | `apps/reference-host/src`    | `renderer/element`, `api-client`                               |
  | `apps/reference-host/server` | `http-api/web` only                                            |
  | `apps/reference-host/seed`   | `http-api/web`, `api-client`                                   |

  Nothing imports from `apps/` (`no-import-of-apps-from-outside`, `no-import-between-apps`).

The rules are tested, not trusted. `boundaries/fixtures/` is a miniature of this layout with one forbidden import per rule and the allowed ones beside them, and `boundaries/boundaries.test.ts` asserts that exactly the expected rules fire on exactly the expected imports. Changing a rule means changing that list.

dependency-cruiser compiles a `.svelte` file before it reads it, which erases `import type`, so a type-only deep import in a `.svelte` file gets past it. Oxlint's `no-restricted-imports` backstops that for `@fb/<pkg>/<subfolder>` and `packages/` paths in `.svelte` files (see `vite.config.ts`). It cannot see a relative path into a sibling package that doesn't mention `packages/`, so import by package name.

## Generated files

`packages/http-api/openapi.json` is generated from `FormApi`, and `packages/api-client/lib/schema.d.ts` from that file. Both are committed and never edited by hand. After changing the API, run `vp run @fb/api-client#generate` (it regenerates both) and commit the result. `vp run check:generated` regenerates them and fails if either differs from the committed copy, and CI runs it.

## The database

`@fb/server` owns everything in the `form_management` Postgres schema, including Drizzle's migrations table.

- **Migrations** live in `packages/server/lib/persistence/migrations/` and are append-only: a merged migration is never edited. Generate one per schema change with `vp exec drizzle-kit generate --name=<name>` in `packages/server`, and triggers or checks with `generate --custom` in a separate step, so the two folders never share a timestamp second. CI runs `vp run @fb/server#check:migrations` (`drizzle-kit check`).
- **`vp test` needs no Docker.** Tests get a fresh, migrated in-process PGlite database from `DatabaseTest` in `@fb/server/testing`, once per build of the layer.
- **`*.pg.test.ts` files run only under `vp run test:pg`**, against real Postgres 18. The task starts the `docker-compose.yml` service first and uses it unless `DATABASE_URL` points elsewhere. Races between connections, and anything that needs the production driver, belong there. `DatabaseTestPostgres(databaseUrl)` gives each build a fresh, migrated database of its own, dropped on release.
- **One suite, both drivers.** A suite that must pass on PGlite and Postgres is a function taking the database layer, in a plain `.ts` file under `tests/`, called from a `.test.ts` with `DatabaseTest` and a `.pg.test.ts` with `DatabaseTestPostgres` (see `tests/authoring-tables.ts`).
- **Triggers make published data immutable**, even for the table owner (ADR 0007, ADR 0014): form versions, their question keys and question identities reject every update, delete and truncate, `forms` rejects truncate, a tenant change, and deleting a form that has a version. A response's columns other than `revision` and `edited_at` never change, and its external references reject every update. Tests reset with a fresh database, never by truncating.
- **The Drizzle `SqlError` shim** in `tsconfig.server.json` stays until Drizzle publishes the fix for its `effect/unstable/sql` imports. `packages/server/tests/sql-error-shim.test.ts` fails once the shim is no longer needed.

## The renderer element and strict CSPs

`@fb/renderer` has two entry points. `index.ts` is the Svelte component, consumed from source. `element.ts` defines `<form-renderer>`, and its `./element` export points only at the built `dist/form-renderer.js`, so build it with `vp run @fb/renderer#build` first. The wrapper is listed in `sideEffects`, because otherwise the bundler silently tree-shakes it out.

ADR 0008's mechanism lives in `packages/renderer/vite.config.ts` and `lib/FormRendererElement.svelte`. Only the wrapper is compiled as a custom element. In a build, inner components emit external CSS, a small plugin inlines it into the one bundled module, and the wrapper's `extend` hook adopts it as a shared constructable stylesheet. In dev and tests, Svelte injects `<style>` elements instead, so only a test against the built bundle covers the production path. Static `style="..."` attributes are banned in `lib/**/*.svelte` and enforced by a test.

The reference host serves the strict CSP in `vp preview` only, because the dev server injects CSS as `<style>` elements. The Playwright test in `e2e/renderer/` runs against it in Chromium, Firefox and WebKit.

Points the spike left unverified, settled in phase 0:

- **`svelte-check` and `vp check` on the per-file config.** Both are clean. `vp run check:svelte` runs `svelte-check` for the renderer, and `vp check` lints and formats `.svelte` files (Oxlint reads only their `<script>` blocks).
- **`:global()` styles in inner components.** They work. In a build they are emitted unscoped into the adopted sheet, which applies across the shadow root, and a test asserts it on the built bundle.
- **CSS hot reload in dev.** It works. Editing an inner component's CSS in the renderer's own `vp dev` server updated the computed style in the shadow root with no full reload. The reference host loads the built element, so a CSS change there needs `vp build --watch` in `packages/renderer`.

## The reference host's dev users

`apps/reference-host/server/` serves the module at `/api` (the prefix comes off before the handler sees the path, and the schema is migrated before the first API request), checking tokens with the public HS256 dev secret in `server/dev-users.ts`. `/login` is the dev user switcher: it sets the `dev-user` cookie for `acme-admin`, `acme-analyst`, `globex-admin`, `alice` or `bob`, clears it for anonymous, and returns to its `return` parameter. `GET /token` answers `{ token }`, a five-minute tenant-wide identified JWT for the signed-in user, or 401 for anonymous. Both `/api` and `/token` allow the builder's origin, `http://localhost:4174`, with credentials.

## The demo seed

`apps/reference-host/seed/` is the host's demo data, for manual demos and as e2e's background. It needs no running server: it builds its own `createFormModuleHandler` on `DATABASE_URL` (else the compose database), migrates it, and creates and publishes one form in `acme` and one in `globex` through `@fb/api-client`, signed as each tenant's dev admin with `server/dev-users.ts`. It never inserts rows directly, so it can't break an invariant. No transport sits between it and the handler, so it passes each request through `declareLength` from `@fb/http-api/web`: the module answers a body with no `Content-Length` with 411 (ADR 0015).

`vp run @fb/reference-host#seed:reset` drops the `form_management` schema through `docker compose exec -T postgres psql`, then runs the seed, which migrates it again. Published forms can't be deleted, so a reset is the only way back to a clean demo. `vp run e2e` depends on it, so every Playwright run starts from the demo seed; no test may rely on the seed's data.

## The builder

`apps/builder` is a SvelteKit 3 static SPA (`adapter-static`, `fallback: "index.html"`, `ssr = false`). Kit's options live in the `sveltekit()` plugin in its `vite.config.ts`, and there is no `svelte.config.js`. App-internal imports use `#lib/...`, declared in its `package.json` `imports`. It starts by fetching `/config.json` (`apiBaseUrl`, `tokenUrl`, `loginUrl`) from `static/`, so one build runs against any host.

Every API call goes through `createBuilderClient(config)` and `outcome(call)` in `src/lib/api.ts`. The client fetches a fresh token from `tokenUrl` (with `credentials: "include"`) before each call. `outcome` sorts the result into `ok`, `rejected` (a tagged 4xx), `tooLarge` (the edge's 413, "This form is too large to save"), `signIn` (a 401, or a token or 403 without `forms:manage`: show the "Sign in" link from `signInUrl`), `tokenUnavailable` (the call was never sent) and `unknown` (a rejected `fetch`, a 5xx, or a reply outside the contract). On `unknown` a page says it couldn't confirm the action and reloads what it affected (ADR 0016). Components take the client as a prop, so the `builder-browser` Vitest project (`tests/*.browser.test.ts`, Chromium) renders them against a fake `fetch`.

The draft editor (`/forms/[formId]`, `src/lib/DraftEditor.svelte`) edits the draft, or the current version's definition when there's no draft (the first save then sends `expectedRevision: null`). Every change to the question list, a question's identity or type, or a choice question's options goes through `@fb/core/editing` with the Web Crypto id source in `src/lib/ids.ts`; labels, descriptions, the required flag and type-specific config are set directly. Each question type's editor is registered in `src/lib/editors/editors.ts`, checked with `satisfies` against core's type names, and gets `EditorProps` (`src/lib/editors/props.ts`). Save is explicit; `RevisionConflict` and `NoDraft` offer reload or stay.

shadcn-svelte is initialised (`components.json`, Tailwind 4 theme in `src/routes/layout.css`) and `vp exec shadcn-svelte add <component>` writes into `src/lib/components/ui/`, which is vendored: Oxlint ignores it. `vp run @fb/builder#check:svelte` runs `svelte-check` with `--fail-on-warnings`, and the e2e `builder-chromium` project runs against `vp preview` on port 4174.

## Browser-safe code

These paths run in the browser:

- `packages/core`
- `packages/api-client`
- `packages/renderer`
- `apps/builder`
- `apps/reference-host/src`

Browser-safe code never imports `effect` or `@effect/*`, `drizzle-orm`, `jose`, Node built-ins, `@fb/server` or `@fb/http-api`. Everything else is server code. A new package is server code until it's added to this list on purpose: add it to `BROWSER_SAFE` in `.dependency-cruiser.cjs` and to the list here.

`@fb/core` runs in both: its tsconfig sets `lib: ["ES2024"]` and `types: []`, so DOM or Node usage fails to compile.
