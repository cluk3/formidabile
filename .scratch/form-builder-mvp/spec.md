# Spec: Form builder MVP

Map: [Form builder MVP](./map.md). Plan decided in [Phased implementation plan and spec](./issues/12-phased-implementation-plan-and-spec.md).

> **Under revision.** The map was reopened on 2026-10-20 after a readiness audit. Don't run `/to-tickets` on this spec until [Revise the phased plan and spec](./issues/30-revise-the-phased-plan-and-spec.md) is resolved.

## What this is

The hand-off for implementing the form builder MVP, ready for `/to-tickets`. It fixes the order of work (phase 0 for repo setup, then five vertical slices), what each phase delivers, and the automated tests that close each phase. The MVP is done when every bullet of the "must demonstrate" list in [ADR 0001 §12](../../docs/adr/0001-modular-versioned-form-management.md) has its tests (see [Proof of the §12 bar](#proof-of-the-12-bar)).

This spec is an **index plus plan**. It doesn't restate decisions: the ADRs are authoritative, and the resolved tickets hold the detail the ADRs leave out. Each phase lists the ADRs and tickets it implements, so a ticket writer zooms into those for the detail. If this spec and an ADR disagree, the ADR wins and this spec is wrong.

Use the vocabulary in [GLOSSARY.md](../../GLOSSARY.md). Never weaken the ADR 0001 §5 invariants to fit a technology.

## Sources of truth

**ADRs** (`docs/adr/`):

- [0001 Modular, versioned form management](../../docs/adr/0001-modular-versioned-form-management.md): the domain and architecture spec, including the §5 invariants and the §12 bar.
- [0002 MVP product calls](../../docs/adr/0002-mvp-product-calls.md): what the MVP does and doesn't do on each ADR 0001 open question.
- [0003 Svelte renderer with two outputs](../../docs/adr/0003-svelte-renderer-with-two-outputs.md): Svelte 5, the standalone SvelteKit builder, the renderer as a component and a `<form-renderer>` custom element.
- [0004 Two schema libraries and a generated browser client](../../docs/adr/0004-two-schema-libraries-and-a-generated-browser-client.md): Effect Schema for HTTP and SQL, `zod/mini` for definitions and answers, and the `openapi-fetch` client.
- [0005 Form definition model](../../docs/adr/0005-form-definition-model.md): the canonical definition, the seven question types and the validation levels.
- [0006 Host-signed bearer tokens and module-enforced capabilities](../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md), as amended by ADR 0010: actors, capabilities and tenancy.
- [0007 Answer rows and trigger-enforced persistence invariants](../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md): the Postgres model.
- [0008 Renderer element adopts constructable stylesheets](../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md): the element under strict host CSPs.
- [0009 Question identity is the analytics compatibility claim](../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md): analytics semantics.
- [0010 Respondent API split and host-owned lookups](../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md): the HTTP surface.

**Resolved tickets** that hold detail the ADRs don't (all under `./issues/`):

- Stack: [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [Effect v4 HTTP API](./issues/02-effect-v4-http-api-and-openapi-contract.md), [Effect v4 with Drizzle](./issues/03-effect-v4-with-drizzle-and-postgres.md), [Zod 4 alongside Effect Schema](./issues/04-zod-4-alongside-effect-schema.md), [How the chosen stack fits together](./issues/07-how-the-chosen-stack-fits-together.md), [Svelte 5 with Vite+](./issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md).
- Layout and pipeline: [Package layout](./issues/11-package-layout.md), [CI pipeline](./issues/17-ci-pipeline.md).
- Domain and contracts: [Canonical form definition model](./issues/08-canonical-form-definition-model.md) (with its [`zod/mini` prototype](./prototypes/canonical-form-definition/)), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](./issues/10-persistence-model.md), [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md), [Analytics queries and cross-version compatibility](./issues/15-analytics-queries-and-cross-version-compatibility.md), [HTTP API surface](./issues/16-http-api-surface.md) (the full endpoint and error tables).
- Research findings: [`./research/`](./research/).

## The shape in one paragraph

A pnpm workspace on Vite+ holds five deep-module packages (`@fb/core`, `@fb/server`, `@fb/http-api`, `@fb/api-client`, `@fb/renderer`) and three apps (`api-server`, `builder`, `reference-host`), plus a root `e2e/` Playwright project and a `docker-compose.yml` Postgres 18. `core` is browser-and-server `zod/mini` domain code. `server` holds the Effect use cases, authorization, persistence (Drizzle on `@effect/sql-pg`, PGlite in tests) and analytics. `http-api` is the Effect `HttpApi` with a committed `openapi.json` and a plain Promise Fetch handler. `api-client` is the one generated `openapi-fetch` client. The renderer is one Svelte tree shipped as a component and a `<form-renderer>` bundle. The reference host is plain TypeScript and mounts the API in-process; it's the API the builder and e2e use. [Package layout](./issues/11-package-layout.md) has the entry points, the dependency matrix and the browser-safe list.

## Rules for every phase

- **Vertical slices.** After phase 0, each phase cuts through every layer it needs and closes at least one §12 bullet.
- **Final pipeline from day one.** Phase 0 makes every CI job real and green. Later phases add content, never pipeline.
- **Done means automated.** A phase is done when every §12 item assigned to it has its tests at the assigned level, `vp run ready` is green locally, and the four CI jobs are green on the PR. There's no manual demo script.
- **Prove each invariant at the lowest layer that could break it**, and exercise it once from above:
  - trigger-enforced rules in `@fb/server` `lib/persistence` tests, on PGlite and again under `test:pg`;
  - use-case rules (atomic publish, the superseded-version reject, the response limit, tenancy as 404) in `@fb/server` use-case tests;
  - status codes and capabilities in `@fb/http-api` tests through the Fetch handler, using the JWT adapter with a test secret;
  - Playwright only for flows that cross components, plus the CSP and axe checks.
- **All seven question types at once per layer**: core in phase 1, the renderer in phase 2, the builder in phase 3. Registries are never loosened temporarily.
- **Migrations are append-only** from the first one. Each schema change is one `drizzle-kit generate` migration, plus a separate `generate --custom` migration for triggers and checks. A merged migration is never edited and nothing is squashed. `drizzle-kit check` runs in CI.
- **Tests seed themselves.** Every test creates the forms and responses it needs through `@fb/api-client` or the use cases. No test depends on the demo seed. e2e tests assert only on what they created (found by title or id), never on global counts or empty lists.
- **This spec doesn't fix ticket boundaries.** It lists each phase's deliverables by package or app, and the tests they need. `/to-tickets` decides the slicing, with one rule: every ticket leaves `ready` green.

## Phase 0: repo setup

**Goal**: the final repo, toolchain and pipeline shape, with placeholder content and no domain code.

**Implements**: [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [How the chosen stack fits together](./issues/07-how-the-chosen-stack-fits-together.md), [Svelte 5 with Vite+](./issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), [Package layout](./issues/11-package-layout.md), [CI pipeline](./issues/17-ci-pipeline.md), ADR 0008's build mechanism.

**Deliverables**:

- **Repo and remote**:
  - `.gitignore` before the first push (the list is in [CI pipeline](./issues/17-ci-pipeline.md)).
  - A public GitHub repo under `cluk3` created with `gh repo create`, with the whole history pushed, including `.scratch/`, `.agents/`, `.claude/`, the ADRs and `GLOSSARY.md`.
  - The `main` ruleset: a PR plus all four jobs required, no force-pushes, no deleting `main`, and no bypass list.
- **Workspace and toolchain**:
  - `.node-version` with `24.20.0`, `devEngines.packageManager` with pnpm 12.14.0 (`onFail: download`), and a root `vite.config.ts` on Vite+ 1.3.
  - The pnpm catalog with exact pins: `effect` and `@effect/*` at 4.0.5, `drizzle-orm` and `drizzle-kit` at `1.0.0-rc.5-5935859`, `typescript` at 6.0.3, `vite-plus`, `@types/node`, `playwright`, `zod`, `svelte`, `@sveltejs/kit` 3, `@remix-run/node-fetch-server` 1.0.0, `jose`, `openapi-typescript`, `openapi-fetch`, `@electric-sql/pglite`, and the rest. The Effect HTTP modules are `@stability unstable`, so exact pins matter.
  - `tsconfig.base.json` and `tsconfig.server.json` as laid out in [Package layout](./issues/11-package-layout.md), including the Drizzle `SqlError` `paths` shim.
  - Oxfmt with `fmt.svelte`, and Oxlint with the `no-restricted-imports` backstop for type-only deep imports in `.svelte` files. Generated files (`openapi.json`, `lib/schema.d.ts`) are in both tools' ignore patterns.
  - Vitest's include excludes `e2e/`.
- **The eight workspaces as shells**, with their real names, entry points, tsconfigs and `package.json` exports, and a packages README that states the layout, the browser-safe list, and that root config files aren't public:
  - `@fb/core`: `definition.ts`, `answers.ts`, `editing.ts` (empty exports), `lib: ["ES2024"]`, `types: []`.
  - `@fb/server`: `index.ts`, `actor.ts`, `database.ts`, `migrate.ts`, `testing.ts`. Includes the `SqlError` shim's type test, an empty Drizzle schema in the `form_management` `pgSchema`, `drizzle.config.ts`, the migration Effect wired to Drizzle's Effect migrator with `migrationsSchema: "form_management"`, and the fresh-PGlite test layer.
  - `@fb/http-api`: an empty `FormApi`, the `web.ts` `createFormModuleHandler` stub, the `openapi` task, and a committed `openapi.json`.
  - `@fb/api-client`: `createFormApiClient({ baseUrl, getToken })`, the `generate` task, and a committed `lib/schema.d.ts`.
  - `@fb/renderer`: a placeholder component tree, both entry points (`index.ts` from source, `element.ts` to `dist/form-renderer.js`), the wrapper listed in `sideEffects`, Rolldown `output.minify`, and the constructable-stylesheet Vite plugin with the wrapper's `extend` hook (ADR 0008).
  - `apps/api-server`: an `@effect/platform-node` server that migrates at startup, run with `node --conditions=source --watch`.
  - `apps/builder`: a SvelteKit 3 static SPA shell (config in `vite.config.ts`, `#lib`, Tailwind 4, shadcn-svelte initialised) that reads the runtime `config.json`.
  - `apps/reference-host`: the `src/` page mounting the placeholder `<form-renderer>`, and the `server/` Vite plugin on `configureServer` and `configurePreviewServer`. The plugin serves `/api/*` through `@remix-run/node-fetch-server` (`createRequest` and `sendResponse` inside the middleware, so other paths fall through to `next()`), and serves the strict CSP in `vp preview`. `/login` and `/token` come in phase 1.
  - Vite `resolve.conditions: ["source", ...defaultClientConditions]` wherever source consumption runs in the browser.
- **Boundaries**: `.dependency-cruiser.cjs` with the full browser-safe list, the full dependency matrix, the deep-import rule, the `*.config.ts` import ban, and `no-circular` scoped to exclude `components/ui/`. The committed fixture tree with one violation per rule family, the test that asserts each fails with its rule name, and the manual pass, fail, pass sequence from `setup-ts-deep-modules`, done once.
- **Databases**: `docker-compose.yml` with one exact `postgres:18.x` tag, the opt-in `test:pg` task (with `DATABASE_URL` in the task's `cache.env`), and `vp test` on PGlite with no Docker.
- **Tests and checks that run from day one**: the drift check (regenerate `openapi.json` and `lib/schema.d.ts`, then `git diff --exit-code`), `drizzle-kit check`, `check:svelte` for the builder and the renderer, Vitest browser mode in Chromium, the renderer's Vitest test against `dist/form-renderer.js`, the `apps/api-server` startup smoke test in `test:pg`, and the root `e2e/` Playwright project with its two projects (the renderer in Chromium, Firefox and WebKit; the builder in Chromium). Playwright runs against `vp preview` of the reference host and the builder.
- **The strict-CSP proof on the placeholder**: the three-browser Playwright test and the Vitest test against the built bundle from [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md). Phase 0 also settles that ticket's unverified points (svelte-check and `vp check` on the per-file config, `:global()` styles in inner components, CSS hot reload in dev) and records the outcome in the packages README.
- **CI**: `.github/workflows/` with the four parallel jobs (`static`, `test`, `test-pg`, `e2e`) exactly as in [CI pipeline](./issues/17-ci-pipeline.md), `setup-vp` pinned by SHA with `cache: true`, the Playwright browser cache, Postgres from `docker compose up --wait postgres`, `permissions: contents: read`, and `.github/dependabot.yml` for `github-actions` only. A root `ready` task runs the same `vp run` task names.

**Exit**: `ready` and all four CI jobs are green on the first PR. Every check named above runs against real (if empty) artifacts. The dependency-cruiser fixture test proves every rule family fires.

## Phase 1: author and publish through the API

**Goal**: an admin can create a form, save drafts and publish immutable versions through the HTTP API, under tenancy and capabilities. There's no UI yet.

**Implements**: ADR 0005, ADR 0006 (with the ADR 0010 read rules), ADR 0007 for the authoring tables, ADR 0010's `forms`, `drafts` and `versions` groups; [Canonical form definition model](./issues/08-canonical-form-definition-model.md), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](./issues/10-persistence-model.md), [HTTP API surface](./issues/16-http-api-surface.md).

**Deliverables**:

- **`@fb/core`**:
  - `definition`: the `format: 1` definition schema, all seven question-type modules (snapshot schema, answer builder, publish rules, display), `parseDefinition` (structure only, for draft save and reads) and `validateForPublish` (completeness, reporting every problem at once).
  - `editing`: `addQuestion`, `changeQuestionType`, `moveQuestion`, `addOption`, `removeOption`, `draftFrom` and `reidentifyQuestion` (ADR 0009), as pure functions with unit tests.
- **`@fb/server`**:
  - `actor.ts`: `Actor`, `Capability`, branded `TenantId` and the `ActorResolver` port.
  - `lib/authorization`: the three capabilities and the cross-tenant-is-404 rule.
  - `lib/persistence`: the first migration pair, with `forms`, `drafts`, `form_versions`, `form_version_questions`, `question_identities`, the draft revision sequence, and the triggers that reject any update, delete or truncate of versions, question keys and identities, and any form deletion. Repository functions take a branded `TenantId` and join through forms. UUIDv7 ids, and `timestamptz` from Effect `Clock`.
  - `lib/drafts` and `lib/publication`: create a form with its first draft, read, save with `expectedRevision`, discard, publish (one `READ COMMITTED` transaction under `FOR UPDATE` on the form row, which inserts the version and its question keys, moves `forms.current_version_id` and deletes the draft), the settings update (availability, response limit) and the versions reads.
  - `FormModuleLive` in `index.ts`.
- **`@fb/http-api`**: the `forms` (create, list, detail, `PATCH`), `drafts` and `versions` groups. Leave out the form external-reference endpoints and the `refNamespace` filter, which come in phase 2. Also: the `JwtActorResolver` bearer middleware (HS256 or JWKS, strict claims), the error tags this phase can raise (`Unauthenticated`, `Forbidden`, `NotFound`, `ValidationFailed`, `RevisionConflict`, `NoDraft`, `FormNotPublished`), the `Schema.Json` Zod bridge for `FormDefinition`, the edge-decode transform onto `ValidationFailed`, `createFormModuleHandler` with `resolveActor` and `cors`, and the regenerated `openapi.json`.
- **`@fb/api-client`**: the regenerated client.
- **`apps/api-server`**: serves the API, and its smoke test answers one authenticated request.
- **`apps/reference-host`**: mounts the handler at `/api` with the HS256 dev secret, plus `/login` (the dev user switcher, which sets a cookie) and `/token` (mints the JWT with `jose`) for the fixed users `acme-admin`, `acme-analyst`, `globex-admin`, `alice`, `bob` and anonymous. The CORS list allows the builder's origin. Add the `seed:reset` task (see [Seed data and the database lifecycle](#seed-data-and-the-database-lifecycle)), seeding the dev tenants' first published forms.

**Tests that close this phase**:

- Core unit tests for every question-type module, both validation levels, and every editing function.
- Persistence tests (PGlite, and `test:pg`):
  - each trigger rejects its forbidden operation;
  - one type per question identity is enforced in the database;
  - `timestamptz` and `jsonb` round-trip on both drivers (the Drizzle research didn't exercise timestamp codecs).
- Use-case tests:
  - publish creates v1; editing the draft afterwards leaves v1 unchanged; publish again creates v2 with v1 unchanged and the current version moved;
  - publishing an incomplete draft returns every problem, and leaves the current version and the draft unchanged;
  - a failure injected after the version row is inserted rolls back everything: no version row, the current version unchanged, the draft kept;
  - draft revisions never repeat, and a stale `expectedRevision` gives `RevisionConflict`.
- `test:pg`: a concurrent save and publish gives `RevisionConflict` and exactly one new version.
- `http-api` tests for the forms half of the unauthorized list in [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md):
  - no token, or an expired, wrongly signed or wrong-audience token, gives 401;
  - without `forms:manage`, creating, saving, publishing or changing settings gives 403;
  - an `acme-analyst` reads forms and versions but not the draft;
  - another tenant's admin gets 404.
- An integration test proving a custom `resolveActor` produces the same `Actor`.

**Exit**: closes §12 bullets 2, 3 (API) and 7, partly closes 1 (create, draft and publish without UI), and closes the forms part of 8.

## Phase 2: respond

**Goal**: respondents load, submit and edit responses through the renderer, in both of its outputs, embedded in the reference host under a strict CSP. Forms carry external references, and the host resolves "the form for project X" by reference.

**Implements**: ADR 0002 (submission, edits, response limit, references), ADR 0003 (renderer), ADR 0006 (respondent rules), ADR 0007 (responses and answers), ADR 0008, ADR 0010's `/respond` group and form references; [HTTP API surface](./issues/16-http-api-surface.md), [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md), [Frontend framework and renderer embedding strategy](./issues/06-frontend-framework-and-renderer-embedding-strategy.md).

**Deliverables**:

- **`@fb/core`** `answers`: `buildAnswerSchema` (strict, cached per version), `validateAnswers`, `AnyAnswers` and `interpretAnswers`, with unit tests for all seven types. An unanswered optional question has no key, and values are untagged.
- **`@fb/server`**:
  - the second migration pair: `responses` (with their own revision, the `limited` flag, and the partial unique index on `(form_id, respondent_id)`), `answers` (composite foreign keys to the response's version and to `form_version_questions`, with the `(version_id, question_id)` index ADR 0009 requires), and the external reference rows for forms and responses. Triggers reject changes to fixed response columns.
  - `lib/submission`: load, submit and edit under `FOR SHARE` on the form row, with the check order `FormClosed`, then `VersionSuperseded`, then `AlreadyResponded` on submit, and `FormClosed`, then `RevisionConflict` on edit. An edit stays on the response's original version and overwrites the answers. Includes the anonymous and identified respondent rules.
  - form external references: add (idempotent, with the 100-reference limit), remove (a no-op if missing), and the lookup of forms by reference. Responses take up to 20 references at submission.
- **`@fb/http-api`**: the `/respond` group except the answer-schema endpoint, the form external-reference endpoints, the `refNamespace` and `refId` filter on `GET /forms`, the `AnyAnswers` bridge, and the error tags `FormClosed`, `VersionSuperseded`, `AlreadyResponded` and `ExternalRefLimitReached`.
- **`@fb/renderer`**: all seven input components, registered with `satisfies` against core's question types. Load, submit, edit and reload by itself. `getToken()` before every request. The sign-in prompt for limited forms, straight-to-edit through `myResponseId`, reload or stay on `RevisionConflict`, reload on `VersionSuperseded`, the closed state, the 401 messages, and refusing a form with an unknown question type. Gated on WCAG 2.2 AA: labelled inputs, errors linked with `aria-describedby`, focus moving to the first error, and full keyboard use. A preview mode that never calls the API, ready for the builder. The `<form-renderer>` element wraps the same tree, with no static `style` attributes in its markup.
- **`apps/reference-host`**:
  - `server/`: the "form for project X" route mints a service JWT (subject `reference-host`, the project's tenant, `responses:read` only), calls `GET /forms?refNamespace=…` on the in-process handler, and serves the page that mounts `<form-renderer>` with that form id.
  - demo projects in `acme` and `globex`, and a seed that attaches each project to its form through the API.
- **`docs/embedding.md`**: the host-facing contract, covering the element's attributes and `getToken`, the strict-CSP guarantee and the Trusted Types requirement (`svelte-trusted-html`) from ADR 0008, and items 1, 2, 4, 5, 6 and 7 of the custom-renderer contract in [HTTP API surface](./issues/16-http-api-surface.md). Item 3 comes with the answer-schema endpoint in phase 4.

**Tests that close this phase**:

- Persistence: the composite foreign key rejects an answer to a question that isn't in that response's version; a trigger rejects changing a response's version or other fixed columns; the partial unique index enforces one response per respondent on limited forms.
- Use case:
  - responses on v1 still point at v1 after v2 is published, and editing a v1 response stays on v1;
  - submitting against a superseded version gives `VersionSuperseded` with `currentVersionId`;
  - the check order on submit and edit;
  - the response limit gives `AlreadyResponded` with the most recent `responseId`;
  - external references are opaque `{ namespace, refId }`, tested with arbitrary namespaces, and the 101st form reference gives `ExternalRefLimitReached`.
- `http-api` tests for the respondent half of the unauthorized list: an anonymous edit, or an anonymous submission to a limited form, gives 401; reading or editing another respondent's response gives 404; a respondent from another tenant gets 404 on submit; changing references without `forms:manage` gives 403.
- Renderer component tests in Vitest browser mode.
- Playwright, renderer project (Chromium, Firefox, WebKit) in the reference host: load, submit, edit; publish v2 behind an open form, submit, see the reload prompt, then submit on v2; the axe checks; the strict-CSP test on the real renderer; and the "form for project X" route.

**Exit**: closes §12 bullets 4, 6 and 10 (host side), the composite-key half of 5, and the respondent part of 8.

## Phase 3: builder

**Goal**: an editor creates, drafts, previews and publishes forms in the builder UI, and sees each form's publication history.

**Implements**: ADR 0003 (builder), ADR 0005 (editing rules), ADR 0009 (`reidentifyQuestion`); [Frontend framework and renderer embedding strategy](./issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Package layout](./issues/11-package-layout.md), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md) (the builder admin actor).

**Deliverables** (`apps/builder`):

- The admin actor from `config.json`: `GET <tokenUrl>` with `credentials: "include"` before each call, and a "Sign in" link to `<loginUrl>` on 401 or a missing `forms:manage`.
- The form list, and creating a form.
- The draft editor: all seven editor components, registered with `satisfies` against core's question types. Every definition change goes through `@fb/core/editing`, including `reidentifyQuestion`. Explicit Save, and on `RevisionConflict` the choice to reload or stay. Discarding the draft.
- Preview through the renderer component's preview mode, which never calls the API.
- Publishing, with every `ValidationFailed` problem shown at once.
- Form settings: the availability toggle and the response limit.
- Publication history: the versions list, reading one version, and the indicator for the current version against the outstanding draft.
- A form's external references, read-only.

**Tests that close this phase**: builder component tests where the logic isn't already covered by core, and the Playwright builder project (Chromium): create, edit, preview (asserting that no `/respond` request is made), save, publish v1, edit and publish v2, and see both versions in the history.

**Exit**: closes §12 bullet 1 end to end, and bullet 3 through the UI.

## Phase 4: responses and history

**Goal**: authorized admins inspect, filter and delete responses, each shown against the version it was submitted under. The host's admin page manages references and finds responses by reference.

**Implements**: ADR 0001 §8.1, ADR 0002 (deletion), ADR 0007 (deleting by respondent), ADR 0010's `responses` group and answer-schema endpoint; [HTTP API surface](./issues/16-http-api-surface.md).

**Deliverables**:

- **`@fb/server`** `lib/responses`: the list (newest first, keyset pagination on `id`, `limit` 50 by default and 200 at most, with filters for form, version, reference and respondent), the read with its version embedded, delete one, and delete by respondent across the whole tenant.
- **`@fb/http-api`**: the `responses` group, and `GET /respond/forms/{formId}/versions/{versionId}/answer-schema`, generated with `z.toJSONSchema` and cached per version, with the three generator fixes (`pattern: "\\S"`, `uniqueItems`, and `x-fb-minDate`/`x-fb-maxDate`), `x-fb-authoritative: false` and the authority `description`.
- **`apps/builder`**:
  - the response list, with keyset paging and filters;
  - response detail, rebuilt from the embedded version as a read-only question-and-answer list driven by each type's display part in the builder registry, through `interpretAnswers`, not by reusing the renderer;
  - both deletes, behind `responses:delete`.
- **`apps/reference-host`** `src/`: signed in as `acme-admin` or `globex-admin`, add and remove form references and list responses by reference for each demo project.
- **`docs/embedding.md`**: item 3 of the custom-renderer contract (optional browser validation through the answer-schema endpoint, with the date-range gap listed).

**Tests that close this phase**:

- Use-case and `http-api` tests: reading a v1 response after v2 dropped one of its questions and relabelled an option returns v1's snapshots and the raw answers; pagination is stable across edits; delete by respondent covers the whole tenant and returns `{ deleted: 0 }` when there's nothing to delete.
- `http-api` tests for the responses half of the unauthorized list: without `responses:read`, reading responses gives 403; without `responses:delete`, deleting gives 403; another tenant's admin gets 404.
- The table-driven answer-schema contract test, running every case through Zod and through ajv (2020-12 with formats). They may differ only on the date-range case.
- Playwright builder project: open a v1 response after v2 is published and see v1's questions; the `acme-analyst` user reads responses but can't publish or delete.

**Exit**: closes §12 bullet 5, the protected-responses part of 8, and the lookup half of 10.

## Phase 5: analytics

**Goal**: authorized admins see a form's analytics as one combined view per question plus a per-version breakdown, handling questions that differ between versions correctly.

**Implements**: ADR 0001 §8.2, ADR 0009; [Analytics queries and cross-version compatibility](./issues/15-analytics-queries-and-cross-version-compatibility.md).

**Deliverables**:

- **`@fb/server`** `lib/analytics`: the six fixed per-form queries in one `REPEATABLE READ READ ONLY` transaction, and the pure merge functions that combine the results with the version definitions:
  - every snapshot of one question identity combines, and changed options, labels and constraints are reported as structured data;
  - a question is "present" in a version (with responses, answered and skipped counts) or "absent", never zero-filled;
  - an option's share is measured against the versions that offered it;
  - views: option counts, boolean splits, number count, min, max, mean and median, and answered and skipped counts only for text, email and date.
  - No schema change.
- **`@fb/http-api`**: the `analytics` group, returning the `FormAnalytics` body with no prose. A never-published form returns empty, not 404.
- **`apps/builder`**: the analytics view, with the combined result and the per-version breakdown as tables with plain CSS bars and no chart library.
- **`apps/reference-host`**: the seed adds the multi-version analytics form (see below).

**Tests that close this phase**:

- Unit tests of the merge functions on fixtures covering a dropped question, an added option, a relabelled option, a changed number range and a reidentified question, plus absent against skipped, and option shares against only the versions that offered the option.
- Query tests on PGlite; the empty-form test in `http-api`; `responses:read` and cross-tenant tests on the analytics endpoint.
- Playwright builder project: on a multi-version form the test builds for itself, the analytics view shows counts by version and keeps an absent question out of that version's totals.

**Exit**: closes §12 bullet 9. With it, every §12 bullet is closed.

## Proof of the §12 bar

Each phase's "Tests that close this phase" list is the detail. This is the checklist.

| §12 bullet                                             | Closed in       | Main proof                                                      |
| ------------------------------------------------------ | --------------- | --------------------------------------------------------------- |
| 1. Created, drafted, previewed, published              | 1 (API), 3 (UI) | Use-case and `http-api` tests; builder e2e with preview         |
| 2. Publishing produces an immutable version            | 1               | Trigger tests on PGlite and `test:pg`; draft edit after publish |
| 3. Later edits and publication create a new version    | 1, 3            | Publish, edit, publish use-case test; builder e2e               |
| 4. Responses stay with their original versions         | 2               | Republish and edit use-case tests; fixed-column trigger         |
| 5. Historical questions and answers stay interpretable | 2, 4            | Composite foreign key; v1 read after v2 changes; builder e2e    |
| 6. New submissions use the intended version            | 2               | `VersionSuperseded` test; three-browser reload e2e              |
| 7. Failed publication changes nothing                  | 1               | Incomplete draft, injected failure, concurrent publish          |
| 8. Unauthorized users are refused                      | 1, 2, 4         | The `http-api` unauthorized list; analyst builder e2e           |
| 9. Analytics by version, differing questions handled   | 5               | Merge-function fixtures; query tests; builder e2e               |
| 10. External references stay host-agnostic             | 2, 4            | Dependency matrix; arbitrary namespaces; project route e2e      |

## Seed data and the database lifecycle

- **Tests seed themselves** (see [Rules for every phase](#rules-for-every-phase)). The demo seed exists only for manual demos and to give e2e a realistic background.
- **The demo seed is host-owned.** A seed script in `apps/reference-host/seed/` owns the dev users (from phase 1) and the demo projects in `acme` and `globex` (from phase 2). It creates forms, versions, references and responses only through the public API with dev-user tokens, never by direct inserts, so a seed can never break an invariant. It needs no running server: it builds its own `createFormModuleHandler`, calls `migrate()`, and gives `@fb/api-client` the handler's `fetch`. The dependency matrix gains one row in phase 1: `apps/reference-host/seed` may import `http-api/web` and `api-client`. Each phase extends the seed with what that phase makes possible.
- **The multi-version analytics form** joins the seed in phase 5: one form in `acme` with versions that drop a question, add an option, relabel an option, change a number range and reidentify a question, with responses from `alice`, `bob` and anonymous respondents.
- **Resetting**: forms can't be deleted (a trigger blocks it), so nothing tries to make the seed idempotent.
  - `seed:reset` in `apps/reference-host` runs `DROP SCHEMA IF EXISTS form_management CASCADE` through `docker compose exec -T postgres psql`, then the seed script, which re-migrates and seeds. Dropping the schema is DDL, which the row triggers don't block. The same compose service backs local development and CI, so the task works in both.
  - The `e2e` task depends on `seed:reset`, so every Playwright run starts from a fresh schema plus the demo seed. It's also the manual reset for local demos.

## Settled before hand-off

These were left for phase 0 by earlier tickets and are now decided:

- **Drizzle's migrations table** lives in `form_management`, as ADR 0007 says. The Effect migrator in `drizzle-orm@1.0.0-rc.5-5935859` reads `migrationsSchema` from its config (it defaults to `drizzle`), verified in the published tarball.
- **The reference host's Node-to-Fetch adapter** is `@remix-run/node-fetch-server` 1.0.0 (MIT, no dependencies), using `createRequest` and `sendResponse` inside the Vite middleware. `srvx` was the alternative, and does more than this needs.

## Caveats carried into implementation

- **TypeScript 6.0.3** is required by dependency-cruiser 18.6, SvelteKit 3 and svelte-check. Vite+ templates default to `^7`.
- **Drizzle `rc5`**: the published `rc` tag crashes on stable Effect. The `SqlError` `paths` shim stays until a newer build ships the fix from Drizzle PR #6429, and its type test flags when it can go.
- **Drizzle migrations generated in the same second** apply in the wrong order, so generate the `--custom` migration in a separate step.
- **dependency-cruiser misses type-only imports in `.svelte`**, so the Oxlint `no-restricted-imports` backstop is load-bearing.
- **tsgolint doesn't type `.svelte` files**: svelte-check stays a cached task, and shadcn-svelte's `components/ui/**` is ignored in lint.
- **A bare `resolve.conditions: ["source"]` loads Svelte's server build in the browser**. Always spread `defaultClientConditions`.
- **The element wrapper must be listed in `sideEffects`**, or it's silently tree-shaken out.
- **`vp run` gives tasks a clean environment**, so `DATABASE_URL` goes in each task's `cache.env` or `cache.untrackedEnv`.
- **Open upstream Vite+ issues** that may surface in phase 0 are listed in [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md).

## Out of scope

See the map's [Out of scope](./map.md#out-of-scope) section. Nothing in this spec reaches past it.
