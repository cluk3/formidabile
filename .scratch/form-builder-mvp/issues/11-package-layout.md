# Package layout

Type: grilling
Status: resolved
Blocked by: 06, 07, 13
Map: [Form builder MVP](../map.md)

## Question

How is the monorepo split into workspace packages and apps so that the ADR 0001 §10 logical boundaries hold, and which package may depend on which?

Decide:

- The packages (e.g. core domain, persistence, API server, API client, renderer, analytics) and the apps (e.g. API server app, SvelteKit builder app, plain TypeScript reference host). [Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md) fixed the renderer as one Svelte component tree with two build outputs (the Svelte component and a self-contained custom element), built on shared validation code with no framework dependency. Decide whether those outputs are one package or two.
- The entry points each package exposes, under the deep-module rule.
- The dependency direction between packages (the dependency-cruiser layering rules), e.g. core depends on nothing framework-specific.
- Where shared Zod schemas and the canonical definition live so the builder, renderer and server cannot drift.
- Where the server-only pieces from [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md) live. These are the `HttpApi` contract module (it generates JSON Schema from the core's Zod, so it must never be imported by browser code), the committed `openapi.json`, and the `openapi-typescript` + `openapi-fetch` client. Decide whether the client is one shared package or generated in each consumer, and where the Fetch-handler export sits.
- Where the `ActorResolver` port and its built-in JWT adapter live ([Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md)). Also how the reference host gets the server side it needs, both to mount the API in-process and to serve `/login` and `/token`, given that it's a plain TypeScript Vite app.
- The dependency-cruiser rule that browser packages never import `effect`, and how a package is classed as browser or server.

## Answer

No ADR. The layout is documented by the packages README that phase 0 writes, and by the dependency-cruiser config that enforces it.

- **Top level**:
  - `packages/` holds the deep modules (`PACKAGES_ROOT = "packages"`).
  - `apps/` holds runnable apps. They aren't deep modules, but they import packages only through entry points.
  - `e2e/` is one Playwright project, and `docker-compose.yml` runs Postgres 18. Both sit at the root.
  - Every workspace package is named `@fb/<name>`, `private: true`, and depends on siblings through `workspace:*`.
- **Packages**:
  - **`@fb/core`**, which runs in the browser and on the server:
    - It depends only on `zod`, and its tsconfig sets `lib: ["ES2024"]` and `types: []`, so DOM or Node usage fails to compile.
    - Entry points, with no `index.ts` barrel:
      - `definition.ts`: the definition schema, question-type modules, `parseDefinition` and `validateForPublish`.
      - `answers.ts`: `buildAnswerSchema`, `validateAnswers`, `AnyAnswers` and `interpretAnswers`.
      - `editing.ts`: the builder's editing rules as pure functions, unit-tested in core. These are `addQuestion` (mints a UUID), `changeQuestionType` (mints a new identity and drops config that no longer applies), `moveQuestion`, `addOption` (mints an opaque value), `removeOption` and `draftFrom`. The renderer never imports it.
        - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): `draftFrom` is removed. `addQuestion`, `changeQuestionType`, `addOption` and `reidentifyQuestion` take an id source `{ questionId(): string; optionValue(): string }`, because core's `lib` and `types` give it no `crypto`. The builder implements the id source in `apps/builder` with `crypto.randomUUID()` and `crypto.getRandomValues`, and the option values it mints fit the 1–64 character limit.
    - Core declares no envelope types (amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md)).
    - Core never calls `z.toJSONSchema`; that stays in `@fb/http-api` (ADR 0004).
  - **`@fb/server`**: use cases, authorization and tenancy, persistence and analytics.
    - Folders: `lib/drafts`, `lib/publication`, `lib/submission`, `lib/responses`, `lib/analytics`, `lib/authorization` and `lib/persistence`. Persistence and analytics are deliberately folders, not packages: a separate persistence package would need repository ports with only one implementation, or use-case logic pushed into SQL functions.
    - Rules inside the package: only `lib/persistence/` imports `drizzle-orm` or `@effect/sql*`, and nothing in `@fb/server` imports Effect's HTTP modules.
    - Entry points:
      - `index.ts`: the use-case services, the `FormModuleLive` layer and the domain errors.
        - Amended by [Definition and persistence defects](./27-definition-and-persistence-defects.md): it also exports the envelope Effect Schemas, the only declaration of forms, drafts, versions and responses. `@fb/http-api` uses them directly, and `openapi.json` and `api-client` are generated from them. `lib/persistence` maps rows to them with functions typed from Drizzle's `$inferSelect` to the schema's `Type`, so a mismatched type, or a schema stricter than its column, fails to compile. A schema looser than its column, such as a nullable field over a `NOT NULL` column, isn't caught, and that's accepted.
      - `actor.ts`: `Actor`, `Capability`, branded `TenantId` and the `ActorResolver` port.
      - `database.ts`: the Postgres layer, built from a URL.
      - `migrate.ts`: the migration Effect.
      - `testing.ts`: a fresh-PGlite layer for other packages' tests.
    - Drizzle config sits at the package root, and migrations live under `lib/persistence/`.
  - **`@fb/http-api`**:
    - `index.ts`, for Effect consumers: the `FormApi` `HttpApi` definition, the `FormApiLive` layer and the `JwtActorResolver` layer.
    - `web.ts`, a plain Promise API for any host: `createFormModuleHandler({ databaseUrl, jwt, resolveActor?, cors? })`, which returns `{ fetch(request), migrate(), dispose() }`. `resolveActor` is a plain `(request) => Promise<Actor | null>`, adapted internally into the `ActorResolver` layer, so a non-Effect host never touches Effect. `cors` takes an origin list, with credentials allowed.
    - `openapi.json` sits at the package root and is written by an `openapi` task that runs a script in `scripts/`.
  - **`@fb/api-client`**:
    - `createFormApiClient({ baseUrl, getToken })` is an `openapi-fetch` client whose middleware calls `getToken()` before every request and sets `Authorization: Bearer …` when the result isn't null. It's the only client, used by the renderer, the builder and the reference host.
    - A `generate` task reads `../http-api/openapi.json` as a file (never as an import) and writes `lib/schema.d.ts`. It depends on `@fb/http-api#openapi`.
    - Both generated files are committed, and the drift check regenerates both and fails on any difference.
  - **`@fb/renderer`**: one package, two root entry points.
    - `index.ts` is the Svelte component, consumed from source through the `source`, `svelte` and `default` conditions.
    - `element.ts` defines `<form-renderer>`. Its `./element` export points only at `dist/form-renderer.js`, with no `source` condition, so every consumer of the element loads the built bundle.
- **Apps**:
  - **`apps/api-server`**: the standalone `@effect/platform-node` server, built from `@fb/http-api` and `@fb/server`. It migrates at startup.
  - **`apps/builder`**: the SvelteKit static single-page app. It's an app, not a package, because nothing imports it and hosts don't embed it (ADR 0003). It holds only rune state and UI, and calls `@fb/core/editing` for every change to the definition.
  - **`apps/reference-host`**: plain TypeScript.
    - `src/` is the browser page that embeds `<form-renderer>`.
    - `server/` is a Vite plugin that adds the same Node middleware to `configureServer` (for `vp dev`) and `configurePreviewServer` (for `vp preview`). It serves `/api/*` through a small Node-to-Fetch adapter onto `@fb/http-api/web` (the adapter library is a phase 0 pick), `/login` (the dev user switcher, which sets a cookie) and `/token` (an HS256 JWT minted with `jose`).
    - It's one process with no separate server. Its tasks depend on `@fb/renderer#build`, which `vp run` caches.
- **How the apps connect in development and e2e**:
  - One docker compose Postgres.
  - The reference host's in-process API is the API the builder and the renderer use.
  - The builder runs on its own port, and its `config.json` points `apiBaseUrl` and `tokenUrl` at the reference host and `loginUrl` at its `/login`. The handler's CORS list allows the builder's origin.
  - Playwright runs against `vp preview` of both apps.
  - `apps/api-server` gets a startup smoke test (migrates, serves, answers one authenticated request) in `test:pg` only.
- **Browser and server classes** in `.dependency-cruiser.cjs`:
  - An explicit browser-safe list: `packages/core`, `packages/api-client`, `packages/renderer`, `apps/builder` and `apps/reference-host/src`.
  - Code on the list may not import:
    - `effect` and `@effect/*`
    - `drizzle-orm`
    - `jose`
    - Node built-ins (dependency type `core`)
    - `@fb/server` and `@fb/http-api`
  - Everything else is server code. A new package must be added to the list deliberately, and the packages README says so.
- **Which code may depend on which** (dependency-cruiser forbids every other workspace dependency):

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

  Nothing imports from `apps/`.

- **Config files at a package root** (`vite.config.ts`, `drizzle.config.ts`, `tsconfig.json`) aren't public. A rule forbids importing any `*.config.ts`, and the packages README says root config files aren't part of the public surface.
- **A question type spans three packages**:
  - a module in core: the schema, answer builder, publish rules and display
  - an input component in the renderer
  - an editor component in the builder

  The renderer and the builder each keep a registry declared with `satisfies { [T in QuestionTypeName]: Component<…> }`, so a type added to core without its components is a compile error in both.

- **tsconfig layering**:
  - `tsconfig.base.json` holds repo-wide settings only: strict mode, `erasableSyntaxOnly`, `skipLibCheck`, `customConditions: ["source"]` and no `baseUrl`.
  - `tsconfig.server.json` extends the base and adds `"types": ["node"]` plus the Drizzle `SqlError` `paths` shim. `@fb/server`, `@fb/http-api`, `apps/api-server` and `apps/reference-host/server` extend it, and the shim's type test lives in `@fb/server`.
  - The builder uses `extends: ["$app/tsconfig", "../../tsconfig.base.json"]`, with the base last so repo-wide rules win.
  - Core and the other browser packages extend the base and set their own `lib`.
- **Conflicts handed over from [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md)**: none found. Svelte 5 handles only erasable TypeScript in `<script>` blocks, so `erasableSyntaxOnly` holds there. The `source` condition works with `resolve.conditions: ["source", ...defaultClientConditions]`, as found in [Svelte 5 with Vite+ and the deep-module toolchain](./13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md).
