# Spec: Form builder MVP

Map: [Form builder MVP](./map.md). Plan decided in [Phased implementation plan and spec](./issues/12-phased-implementation-plan-and-spec.md), revised in [Revise the phased plan and spec](./issues/30-revise-the-phased-plan-and-spec.md) after the 2026-10-20 readiness audit.

## What this is

The hand-off for implementing the form builder MVP, ready for `/to-tickets`. It fixes the order of work (phase 0 for repo setup, then five vertical slices), what each phase delivers, and the automated tests that close each phase. The MVP is done when every bullet of the "must demonstrate" list in [ADR 0001 §12](../../docs/adr/0001-modular-versioned-form-management.md) has its tests (see [Proof of the §12 bar](#proof-of-the-12-bar)), and every row of [Security cases](#security-cases) has its tests.

This spec is an **index plus plan**. It doesn't restate decisions: the ADRs are authoritative, and the resolved tickets hold the detail the ADRs leave out. Each phase lists the ADRs and tickets it implements, so a ticket writer zooms into those for the detail. If this spec and an ADR disagree, the ADR wins and this spec is wrong. Where an ADR and a ticket disagree, the later amendment wins, and every amendment names its source.

Use the vocabulary in [GLOSSARY.md](../../GLOSSARY.md). Never weaken the ADR 0001 §5 invariants to fit a technology.

## Sources of truth

**ADRs** (`docs/adr/`). ADR 0001 is the accepted baseline. Each later ADR amends it, each amended clause carries an inline `(amended …, see ADR-00N)` note, and the later ADR wins.

- [0001 Modular, versioned form management](../../docs/adr/0001-modular-versioned-form-management.md): the domain and architecture spec, including the §5 invariants and the §12 bar.
- [0002 MVP product calls](../../docs/adr/0002-mvp-product-calls.md): what the MVP does and doesn't do on each ADR 0001 open question.
- [0003 Svelte renderer with two outputs](../../docs/adr/0003-svelte-renderer-with-two-outputs.md): Svelte 5, the standalone SvelteKit builder, the renderer as a component and a `<form-renderer>` custom element.
- [0004 Two schema libraries and a generated browser client](../../docs/adr/0004-two-schema-libraries-and-a-generated-browser-client.md): Effect Schema for HTTP and SQL, `zod/mini` for definitions and answers, and the `openapi-fetch` client.
- [0005 Form definition model](../../docs/adr/0005-form-definition-model.md): the canonical definition, the seven question types, the validation levels, and publish's satisfiability guarantee.
- [0006 Host-signed bearer tokens and module-enforced capabilities](../../docs/adr/0006-host-signed-bearer-tokens-and-module-enforced-capabilities.md), as amended by ADRs 0010, 0011, 0012, 0013 and 0015: actors, capabilities and tenancy.
- [0007 Answer rows and trigger-enforced persistence invariants](../../docs/adr/0007-answer-rows-and-trigger-enforced-persistence-invariants.md): the Postgres model.
- [0008 Renderer element adopts constructable stylesheets](../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md): the element under strict host CSPs.
- [0009 Question identity is the analytics compatibility claim](../../docs/adr/0009-question-identity-is-the-analytics-compatibility-claim.md): analytics semantics.
- [0010 Respondent API split and host-owned lookups](../../docs/adr/0010-respondent-api-split-and-host-owned-lookups.md): the HTTP surface.
- [0011 Anonymous respondents hold host-signed form-bound grants](../../docs/adr/0011-anonymous-respondents-hold-host-signed-form-bound-grants.md): anonymous means a grant, never "no token".
- [0012 Response references are host-signed claims](../../docs/adr/0012-response-references-are-host-signed-claims.md): the `refs` claim and form binding.
- [0013 Personal data is erased by hard deletion under pseudonymous subjects](../../docs/adr/0013-personal-data-is-erased-by-hard-deletion-under-pseudonymous-subjects.md): classification, erasure and access requests.
- [0014 Only never-published forms can be deleted](../../docs/adr/0014-only-never-published-forms-can-be-deleted.md): the form lifecycle.
- [0015 The module bounds request sizes and hosts bound rates](../../docs/adr/0015-the-module-bounds-request-sizes-and-hosts-bound-rates.md): body limits, claim caps and timeouts.
- [0016 Submissions carry a client-minted idempotency key](../../docs/adr/0016-submissions-carry-a-client-minted-idempotency-key.md): retries and unknown outcomes.

**Resolved tickets** that hold detail the ADRs don't (all under `./issues/`):

- Stack: [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [Effect v4 HTTP API](./issues/02-effect-v4-http-api-and-openapi-contract.md), [Effect v4 with Drizzle](./issues/03-effect-v4-with-drizzle-and-postgres.md), [Zod 4 alongside Effect Schema](./issues/04-zod-4-alongside-effect-schema.md), [How the chosen stack fits together](./issues/07-how-the-chosen-stack-fits-together.md), [Svelte 5 with Vite+](./issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md).
- Layout and pipeline: [Package layout](./issues/11-package-layout.md), [CI pipeline](./issues/17-ci-pipeline.md), [Repository hosting and visibility](./issues/29-repository-hosting-and-visibility.md).
- Domain and contracts: [Canonical form definition model](./issues/08-canonical-form-definition-model.md) (with its [`zod/mini` prototype](./prototypes/canonical-form-definition/)), [Definition and persistence defects](./issues/27-definition-and-persistence-defects.md), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](./issues/10-persistence-model.md), [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md), [Analytics queries and cross-version compatibility](./issues/15-analytics-queries-and-cross-version-compatibility.md), [HTTP API surface](./issues/16-http-api-surface.md) (the full endpoint and error tables).
- Reopened after the audit: [Anonymous respondent access and tenancy](./issues/19-anonymous-respondent-access-and-tenancy.md), [Trust in response external references](./issues/20-trust-in-response-external-references.md), [Lookup cardinality for form external references](./issues/21-lookup-cardinality-for-form-external-references.md), [Personal data classification and erasure](./issues/22-personal-data-classification-and-erasure.md), [Form lifecycle: deleting or archiving forms](./issues/23-form-lifecycle-deleting-or-archiving-forms.md), [Expected load and data volumes](./issues/24-expected-load-and-data-volumes.md), [Request limits and abuse controls](./issues/25-request-limits-and-abuse-controls.md), [Retries and idempotency for creates and submissions](./issues/26-retries-and-idempotency-for-creates-and-submissions.md).
- Research findings: [`./research/`](./research/).

## The shape in one paragraph

A pnpm workspace on Vite+ holds five deep-module packages (`@fb/core`, `@fb/server`, `@fb/http-api`, `@fb/api-client`, `@fb/renderer`) and three apps (`api-server`, `builder`, `reference-host`), plus a root `e2e/` Playwright project and a `docker-compose.yml` Postgres 18. `core` is browser-and-server `zod/mini` domain code that owns only the definition and the answers. `server` holds the Effect use cases, authorization, persistence (Drizzle on `@effect/sql-pg`, PGlite in tests), analytics, and the Effect Schema envelopes. `http-api` is the Effect `HttpApi` with a committed `openapi.json` and a plain Promise Fetch handler. `api-client` is the one generated `openapi-fetch` client. The renderer is one Svelte tree shipped as a component and a `<form-renderer>` bundle. The reference host is plain TypeScript and mounts the API in-process; it's the API the builder and e2e use. `apps/api-server` is the second way of serving the same API. [Package layout](./issues/11-package-layout.md) has the entry points, the dependency matrix and the browser-safe list.

## Design envelope

Demo scale only, from [Expected load and data volumes](./issues/24-expected-load-and-data-volumes.md). These are recorded assumptions, not enforced and not tested, and `docs/embedding.md` repeats them:

- At most 10 tenants, 100 forms per tenant, 50 versions per form, 10,000 responses per form, and 20 people submitting at once across the instance.
- Going past the envelope is unsupported, not refused. There's no error for it.
- No per-version caches: the answer schema and its JSON Schema are built on every request.
- Analytics are computed on read, with an estimated budget of about 1 second for 20 questions × 10,000 responses. The 200-question worst case may take several seconds.

## Rules for every phase

- **Vertical slices.** After phase 0, each phase cuts through every layer it needs and closes at least one §12 bullet.
- **Final pipeline from day one.** Phase 0 makes every CI job real and green. Later phases add content, never pipeline.
- **Done means automated.** A phase is done when every §12 item and security case assigned to it has its tests at the assigned level, `vp run ready` is green locally, and the four CI jobs are green on the PR. There's no manual demo script.
- **Prove each invariant at the lowest layer that could break it**, and exercise it once from above:
  - trigger-enforced rules in `@fb/server` `lib/persistence` tests, on PGlite and again under `test:pg`;
  - use-case rules (atomic publish, the superseded-version reject, the response limit, idempotent replay, tenancy and form binding as 404) in `@fb/server` use-case tests;
  - races between connections (save and publish, delete and publish, concurrent submits) in `test:pg` only, because PGlite has one connection;
  - status codes, capabilities and claim validation in `@fb/http-api` tests through the Fetch handler, using the JWT adapter with a test secret;
  - serving-mode differences in the `apps/api-server` parity test;
  - Playwright only for flows that cross components, plus the CSP, axe and keyboard checks.
- **All seven question types at once per layer**: core in phase 1, the renderer in phase 2, the builder in phase 3. Registries are never loosened temporarily.
- **Migrations are append-only** from the first one. Each schema change is one `drizzle-kit generate` migration, plus a separate `generate --custom` migration for triggers and checks. A merged migration is never edited and nothing is squashed. `drizzle-kit check` runs in CI.
- **Tests seed themselves.** Every test creates the forms and responses it needs through `@fb/api-client` or the use cases. No test depends on the demo seed. e2e tests assert only on what they created (found by title or id), never on global counts or empty lists.
- **This spec doesn't fix ticket boundaries.** It lists each phase's deliverables by package or app, and the tests they need. `/to-tickets` decides the slicing, with one rule: every ticket leaves `ready` green.

## Before phase 0 (done)

Done by hand on 2026-10-20, per [Repository hosting and visibility](./issues/29-repository-hosting-and-visibility.md): the public repo [`cluk3/formidabile`](https://github.com/cluk3/formidabile) exists, `main` is pushed and tracks `origin/main`, history is authored as the GitHub noreply address, and the MIT `LICENSE` and `.agents/skills/THIRD_PARTY_NOTICES.md` are committed. Phase 0 starts from that remote and never runs `gh repo create`.

## Phase 0: repo setup

**Goal**: the final repo, toolchain and pipeline shape, with placeholder content and no domain code.

**Implements**: [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [How the chosen stack fits together](./issues/07-how-the-chosen-stack-fits-together.md), [Svelte 5 with Vite+](./issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), [Package layout](./issues/11-package-layout.md), [CI pipeline](./issues/17-ci-pipeline.md) as amended by [Repository hosting and visibility](./issues/29-repository-hosting-and-visibility.md), ADR 0008's build mechanism (kept in phase 0 by [Strict-CSP scope for the renderer element](./issues/28-strict-csp-scope-for-the-renderer-element.md)), and ADR 0015's timeouts.

**Deliverables**:

- **Repo**:
  - `.gitignore` (the list is in [CI pipeline](./issues/17-ci-pipeline.md)), committed on the first PR.
  - The `main` ruleset, created with `gh api` once the four jobs have reported on that PR: a PR plus all four jobs required, no force-pushes, no deleting `main`, and no bypass list.
- **Workspace and toolchain**:
  - `.node-version` with `24.20.0`, `devEngines.packageManager` with pnpm 12.14.0 (`onFail: download`), and a root `vite.config.ts` on Vite+ 1.3.
  - The pnpm catalog with exact pins: `effect` and `@effect/*` at 4.0.5, `drizzle-orm` and `drizzle-kit` at `1.0.0-rc.5-5935859`, `typescript` at 6.0.3, `vite-plus`, `@types/node`, `playwright`, `zod`, `svelte`, `@sveltejs/kit` 3, `@remix-run/node-fetch-server` 1.0.0, `jose`, `openapi-typescript`, `openapi-fetch`, `@electric-sql/pglite`, and the rest. The Effect HTTP modules are `@stability unstable`, so exact pins matter.
  - `tsconfig.base.json` and `tsconfig.server.json` as laid out in [Package layout](./issues/11-package-layout.md), including the Drizzle `SqlError` `paths` shim.
  - Oxfmt with `fmt.svelte`, and Oxlint with the `no-restricted-imports` backstop for type-only deep imports in `.svelte` files. Generated files (`openapi.json`, `lib/schema.d.ts`) are in both tools' ignore patterns.
  - Vitest's include excludes `e2e/`.
- **The eight workspaces as shells**, with their real names, entry points, tsconfigs and `package.json` exports, and a packages README that states the layout, the browser-safe list, and that root config files aren't public:
  - `@fb/core`: `definition.ts`, `answers.ts`, `editing.ts` (empty exports), `lib: ["ES2024"]`, `types: []`.
  - `@fb/server`: `index.ts`, `actor.ts`, `database.ts`, `migrate.ts`, `testing.ts`. Includes the `SqlError` shim's type test, an empty Drizzle schema in the `form_management` `pgSchema`, `drizzle.config.ts`, the migration Effect wired to Drizzle's Effect migrator with `migrationsSchema: "form_management"`, and the fresh-PGlite test layer. `database.ts` sets `statement_timeout` to 30 s through `@effect/sql-pg`'s `startupParameters`, for every connection built from `databaseUrl` in both serving modes.
  - `@fb/http-api`: an empty `FormApi`, the `web.ts` `createFormModuleHandler` stub, the `openapi` task, and a committed `openapi.json`.
  - `@fb/api-client`: `createFormApiClient({ baseUrl, getToken })`, the `generate` task, and a committed `lib/schema.d.ts`.
  - `@fb/renderer`: a placeholder component tree, both entry points (`index.ts` from source, `element.ts` to `dist/form-renderer.js`), the wrapper listed in `sideEffects`, Rolldown `output.minify`, and the constructable-stylesheet Vite plugin with the wrapper's `extend` hook (ADR 0008).
  - `apps/api-server`: an `@effect/platform-node` server that migrates at startup, run with `node --conditions=source --watch`. It builds its own `createServer(...)` with `headersTimeout` 10 s and `requestTimeout` 30 s, because `NodeHttpServer.layer`'s options only reach `listen`.
  - `apps/builder`: a SvelteKit 3 static SPA shell (config in `vite.config.ts`, `#lib`, Tailwind 4, shadcn-svelte initialised) that reads the runtime `config.json`.
  - `apps/reference-host`: the `src/` page mounting the placeholder `<form-renderer>`, and the `server/` Vite plugin on `configureServer` and `configurePreviewServer`. The plugin serves `/api/*` through `@remix-run/node-fetch-server` (`createRequest` and `sendResponse` inside the middleware, so other paths fall through to `next()`), and serves the strict CSP in `vp preview`. `/login` and `/token` come in phase 1.
  - Vite `resolve.conditions: ["source", ...defaultClientConditions]` wherever source consumption runs in the browser.
- **Boundaries**: `.dependency-cruiser.cjs` with the full browser-safe list, the full dependency matrix, the deep-import rule, the `*.config.ts` import ban, and `no-circular` scoped to exclude `components/ui/`. The committed fixture tree with one violation per rule family, the test that asserts each fails with its rule name, and the manual pass, fail, pass sequence from `setup-ts-deep-modules`, done once.
- **Databases**: `docker-compose.yml` with one exact `postgres:18.x` tag, the opt-in `test:pg` task (with `DATABASE_URL` in the task's `cache.env`), and `vp test` on PGlite with no Docker.
- **Tests and checks that run from day one**: the drift check (regenerate `openapi.json` and `lib/schema.d.ts`, then `git diff --exit-code`), `drizzle-kit check`, `check:svelte` for the builder and the renderer, Vitest browser mode in Chromium, the renderer's Vitest test against `dist/form-renderer.js`, and the root `e2e/` Playwright project with its two projects (the renderer in Chromium, Firefox and WebKit; the builder in Chromium). Playwright runs against `vp preview` of the reference host and the builder.
- **The `apps/api-server` smoke test** in `test:pg`: it migrates, serves, and `SHOW statement_timeout` on a module connection returns `30s`. Phase 1 adds one authenticated request.
- **The strict-CSP proof on the placeholder**: the three-browser Playwright test and the Vitest test against the built bundle from [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md). Phase 0 also settles that ticket's unverified points (svelte-check and `vp check` on the per-file config, `:global()` styles in inner components, CSS hot reload in dev) and records the outcome in the packages README.
- **CI**: `.github/workflows/` with the four parallel jobs (`static`, `test`, `test-pg`, `e2e`) exactly as in [CI pipeline](./issues/17-ci-pipeline.md), `setup-vp` pinned by SHA with `cache: true`, the Playwright browser cache, Postgres from `docker compose up --wait postgres`, `permissions: contents: read`, and `.github/dependabot.yml` for `github-actions` only. A root `ready` task runs the same `vp run` task names.

**Exit**: `ready` and all four CI jobs are green on the first PR, and the ruleset is in place. Every check named above runs against real (if empty) artifacts. The dependency-cruiser fixture test proves every rule family fires.

## Phase 1: author and publish through the API

**Goal**: an admin can create, delete (while never published), save drafts of and publish forms as immutable versions through the HTTP API, under tenancy and capabilities. Every token the module will ever accept is validated. There's no UI yet.

**Implements**: ADR 0005, ADR 0006 with every amendment to its claims (ADRs 0010, 0011, 0012, 0013, 0015), ADR 0007 for the authoring tables, ADR 0010's `forms`, `drafts` and `versions` groups, ADR 0014, ADR 0015's body limits and claim caps; [Canonical form definition model](./issues/08-canonical-form-definition-model.md), [Definition and persistence defects](./issues/27-definition-and-persistence-defects.md), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md), [Persistence model](./issues/10-persistence-model.md), [HTTP API surface](./issues/16-http-api-surface.md), [Form lifecycle: deleting or archiving forms](./issues/23-form-lifecycle-deleting-or-archiving-forms.md), [Request limits and abuse controls](./issues/25-request-limits-and-abuse-controls.md).

**Deliverables**:

- **`@fb/core`**:
  - `definition`: the `format: 1` definition schema, all seven question-type modules (snapshot schema, answer builder, publish rules, display), `parseDefinition` (structure only, for draft save and reads) and `validateForPublish` (completeness, reporting every problem at once).
    - Publish guarantees every question accepts some answer: multiple-choice `minSelected` and `maxSelected` are structurally whole numbers from 1 to 100, publish adds `minSelected` ≤ the number of options, and integer number questions need whole-number bounds.
    - The email type caps answers at 254 code points.
  - `editing`: `addQuestion`, `changeQuestionType`, `moveQuestion`, `addOption`, `removeOption` and `reidentifyQuestion` (ADR 0009), as pure functions. The minting functions take an id source `{ questionId(): string; optionValue(): string }`. Core has no envelope types and no `draftFrom`.
- **`@fb/server`**:
  - `actor.ts`: `Actor` as `Identified { subject, tenant, capabilities, formId: Option, refs } | Anonymous { tenant, formId, refs }`, `Capability`, branded `TenantId`, and the `ActorResolver` port. Every resolver's actor, custom ones included, is checked after it runs: `subject` and `tenant` 1 to 255 code points, through one shared code-point check rather than Effect Schema's UTF-16 length.
  - The envelopes (`Form`, `Draft`, `FormVersion` and the summaries) as Effect Schemas, declared once here. Revisions are opaque strings above persistence.
  - `lib/authorization`: the three capabilities, admin reads accepting `forms:manage` or `responses:read`, anonymous actors refused on every admin use case, and the cross-tenant-is-404 rule.
  - `lib/persistence`: the first migration pair, with `forms`, `drafts` (`ON DELETE CASCADE` from forms), `form_versions`, `form_version_questions`, `question_identities` (with `UNIQUE (form_id, question_id, type)` as the foreign key's target), and the draft revision sequence. The triggers reject any update, delete or truncate of versions, question keys and identities, any `TRUNCATE` of forms, and deleting a form that has any version. Repository functions take a branded `TenantId` and join through forms. Typed row mappers link Drizzle to the Effect Schemas. UUIDv7 ids, and `timestamptz` from Effect `Clock`.
  - `lib/drafts` and `lib/publication`: create a form with its first draft, read, save with `expectedRevision`, discard (`FormNotPublished` on a never-published form), publish (one `READ COMMITTED` transaction that inserts the version and its question keys, moves `forms.current_version_id` and deletes the draft), delete a never-published form (`NotFound`, then `FormPublished`, then `RevisionConflict`), the settings update (availability, response limit) and the versions reads. Every draft write takes `FOR UPDATE` on the form row first, as [Persistence model](./issues/10-persistence-model.md) now requires.
  - `FormModuleLive` in `index.ts`.
- **`@fb/http-api`**:
  - The `forms` (create, list, detail, `PATCH`, `DELETE`), `drafts` and `versions` groups. Leave out the form external-reference endpoints and the `refNamespace` filter, which come in phase 2.
  - The `JwtActorResolver` bearer middleware (HS256 or JWKS), complete in this phase: both claim sets, the `refs` shape (at most 20 entries, the persistence shape limits, no duplicates or extra keys), `refs` requiring `form`, `form` as a UUID, and the `sub` and `tenant` caps. Each failure gives 401 with its `reason`.
  - The edge middleware: 411 `LengthRequired` for a body with no `Content-Length`, and 413 `PayloadTooLarge { limit }` over 1 MiB for create and draft-save bodies and 16 KiB for every other body, before any of the body is read. Effect's `MaxBodySize` isn't used.
  - The error tags this phase can raise: `Unauthenticated` (with `reason`), `Forbidden`, `NotFound`, `ValidationFailed`, `RevisionConflict`, `NoDraft`, `FormNotPublished`, `FormPublished`, `LengthRequired` and `PayloadTooLarge`.
  - The `Schema.Json` Zod bridge for `FormDefinition`, the edge-decode transform onto `ValidationFailed`, `createFormModuleHandler` with `resolveActor` and `cors`, and the regenerated `openapi.json`.
- **`@fb/api-client`**: the regenerated client.
- **`apps/api-server`**: serves the API. Its smoke test also answers one authenticated request.
- **`apps/reference-host`**: mounts the handler at `/api` with the HS256 dev secret, plus `/login` (the dev user switcher, which sets a cookie) and `/token` (mints the JWT with `jose`) for the fixed users `acme-admin`, `acme-analyst`, `globex-admin`, `alice`, `bob` and anonymous. In this phase `/token` mints tenant-wide identified tokens, and gives 401 for the anonymous user, because a grant needs `form`. The `project` parameter comes in phase 2. The CORS list allows the builder's origin. Add the `seed:reset` task (see [Seed data and the database lifecycle](#seed-data-and-the-database-lifecycle)), seeding the dev tenants' first published forms.

**Tests that close this phase**:

- Core unit tests:
  - every question-type module, both validation levels, and every editing function, with a deterministic id source;
  - one test per satisfiability rule: `minSelected` above the number of options, `maxSelected: 0`, and an integer question with fractional bounds are each rejected;
  - a 254-code-point email answer passes, and a 255-code-point one fails.
- Persistence tests (PGlite, and `test:pg`):
  - each trigger rejects its forbidden operation;
  - a raw SQL `DELETE` of a published form fails even as the table owner, `TRUNCATE` on `forms` fails, and deleting a never-published form removes its draft by cascade;
  - one type per question identity is enforced in the database;
  - `timestamptz` and `jsonb` round-trip on both drivers (the Drizzle research didn't exercise timestamp codecs).
- Use-case tests:
  - publish creates v1; editing the draft afterwards leaves v1 unchanged; publish again creates v2 with v1 unchanged and the current version moved;
  - publishing an incomplete draft returns every problem, and leaves the current version and the draft unchanged;
  - a failure injected after the version row is inserted rolls back everything: no version row, the current version unchanged, the draft kept;
  - draft revisions never repeat, and a stale `expectedRevision` gives `RevisionConflict`;
  - publish then a stale save gives `NoDraft`, and a save with `expectedRevision: null` after publish creates a draft based on the new version; save then a stale publish gives `RevisionConflict` and no new version;
  - deleting a published form gives `FormPublished`, a stale revision gives `RevisionConflict`, and discarding a never-published form's draft gives `FormNotPublished`.
- `test:pg` races:
  - a save and a publish fired at once end in one of the two states above. There's exactly one new version, it holds the definition publish expected, and a save that got a 200 is never lost;
  - a delete racing a publish ends with either the form gone and no version, or the version published and `FormPublished`, never both.
- `http-api` tests:
  - the forms half of the unauthorized list in [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md): no token gives 401 `missing`; an expired, wrongly signed or wrong-audience token gives 401 `invalid`; without `forms:manage`, creating, saving, publishing, deleting or changing settings gives 403; an `acme-analyst` reads forms and versions but not the draft; another tenant's admin gets 404;
  - an anonymous grant on an admin endpoint gives 403;
  - each of these gives 401 `invalid`: `anonymous` with `sub`, `anonymous` with `capabilities`, `anonymous` without `form`, neither `sub` nor `anonymous`, `refs` without `form`, more than 20 `refs`, a duplicate entry, a bad shape, an extra key, a 256-code-point `sub` or `tenant`, a non-UUID `form`, and a custom resolver whose `subject` is 256 code points. A `sub` of 255 emoji passes, and one of 256 emoji fails;
  - a draft save declaring 1 MiB plus one byte and a `PATCH /forms` declaring 16 KiB plus one byte each give 413 with the endpoint's `limit`; a definition body just under 1 MiB is accepted; a chunked body with no `Content-Length` gives 411.
- An integration test proving a custom `resolveActor` produces the same `Identified` and `Anonymous` actors, which pass the same checks.
- The `apps/api-server` serving-mode parity test, under `vp test` on PGlite. One fixed table of requests goes through both the server's layer on an ephemeral port and `createFormModuleHandler`, and each must give equal status, `content-type` and body. The rows are one success, 401 with each `reason` this phase can raise, 403, 404, a 409, a 422, a 411 sent chunked over a raw socket, and a 413.

**Exit**: closes §12 bullets 2, 3 (API) and 7, partly closes 1 (create, draft and publish without UI), and closes the forms part of 8. Closes the phase 1 rows of [Security cases](#security-cases).

## Phase 2: respond

**Goal**: identified and anonymous respondents load, submit and edit responses through the renderer, in both of its outputs, embedded in the reference host under a strict CSP. Submissions are safe to retry. Forms carry external references, responses carry the references the host signed, and the host resolves "the form for project X" by reference.

**Implements**: ADR 0002 (submission, edits, response limit, references), ADR 0003 (renderer), ADR 0006 (respondent rules), ADR 0007 (responses and answers), ADR 0008, ADR 0010's `/respond` group and form references, ADR 0011, ADR 0012, ADR 0015 (submit and edit limits), ADR 0016; [HTTP API surface](./issues/16-http-api-surface.md), [Renderer styles under strict host CSPs](./issues/14-renderer-styles-under-strict-host-csps.md), [Frontend framework and renderer embedding strategy](./issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Anonymous respondent access and tenancy](./issues/19-anonymous-respondent-access-and-tenancy.md), [Trust in response external references](./issues/20-trust-in-response-external-references.md), [Lookup cardinality for form external references](./issues/21-lookup-cardinality-for-form-external-references.md), [Retries and idempotency for creates and submissions](./issues/26-retries-and-idempotency-for-creates-and-submissions.md).

**Deliverables**:

- **`@fb/core`** `answers`: `buildAnswerSchema` (strict, built on every call), `validateAnswers`, `AnyAnswers` and `interpretAnswers`. An unanswered optional question has no key, and values are untagged.
- **`@fb/server`**:
  - the second migration pair:
    - `responses`, with their own revision, the `limited` flag, the partial unique index on `(form_id, respondent_id)`, and a not-null `idempotency_key` under `UNIQUE NULLS NOT DISTINCT (form_id, respondent_id, idempotency_key)`;
    - `answers`, with composite foreign keys to the response's version and to `form_version_questions`, and the `(version_id, question_id)` index ADR 0009 requires;
    - the external reference rows for forms (`ON DELETE CASCADE` from forms) and responses;
    - triggers that reject changes to fixed response columns, the idempotency key included.
  - `lib/submission`: load, submit and edit under `FOR SHARE` on the form row.
    - Respondent use cases check a form-bound actor's `formId` before any read, and return `NotFound` on a mismatch.
    - Submit looks up the idempotency key first, and a match returns the original `{ responseId, revision }` with the current revision. Then it checks `FormClosed`, `VersionSuperseded` and `AlreadyResponded`, in that order. A race on the key reruns the use case once. The actor's `refs` are stored atomically with the response.
    - Edit checks `FormClosed`, then `RevisionConflict`, stays on the response's original version, overwrites the answers, and never changes the stored references.
    - The anonymous rules: a grant reaches only load, the answer schema and submit, for its bound form; a limited form or a response read or edit gives `identityRequired`.
  - form external references: add (idempotent, with the 100-reference limit), remove (a no-op if missing), and the lookup of every form in the tenant carrying a reference, sorted by `updatedAt` descending.
- **`@fb/http-api`**:
  - The `/respond` group except the answer-schema endpoint. The load returns `respondent`. The submit body is `{ versionId, answers, idempotencyKey }`, and the submit and edit bodies reject unknown keys, so `externalRefs` gives 422.
  - The form external-reference endpoints, and the `refNamespace` and `refId` filter on `GET /forms` (an unknown reference gives 200 with an empty list).
  - The `AnyAnswers` bridge, the 1 MiB limit for submit and edit bodies, and the error tags `FormClosed`, `VersionSuperseded`, `AlreadyResponded` and `ExternalRefLimitReached`.
- **`@fb/renderer`**:
  - All seven input components, registered with `satisfies` against core's question types.
  - Load, submit, edit and reload by itself. `getToken({ formId })` is required and called before every request. There's no references input.
  - The sign-in prompt driven by `respondent` and `responseLimit`, straight-to-edit through `myResponseId`, reload or stay on `RevisionConflict`, reload on `VersionSuperseded`, the closed state, the unavailable state on `FormNotPublished`, the 401 messages chosen by `reason`, "Your answers are too long to send" on 413, and refusing a form with an unknown question type.
  - The idempotency key minted at the first Submit and kept until a 201. On an unknown submit outcome, the answers stay read-only with "We couldn't confirm your response was received" and a Retry that resends the same key and body. On an unknown edit outcome, reload or stay.
  - Gated on WCAG 2.2 AA: labelled inputs, errors linked with `aria-describedby` and marked `aria-invalid`, focus moving to the first error, and full keyboard use.
  - A preview mode that never calls the API, ready for the builder.
  - The `<form-renderer>` element wraps the same tree, with no static `style` attributes in its markup.
- **`apps/reference-host`**:
  - `server/`: `resolveProjectForm(tenant, projectId)` mints a service JWT (subject `reference-host`, the project's tenant, `responses:read` only), calls `GET /forms?refNamespace=project&refId=…` on the in-process handler, and keeps the candidates (published and open).
    - The "form for project X" route mounts `<form-renderer>` for exactly one candidate. It shows a static "No open form for this project" page for none, and an "ambiguous" page listing the candidates' titles for several.
  - `/token?project=<id>` checks the project is in the signed-in dev user's tenant, then calls the same `resolveProjectForm`. For exactly one candidate it mints `form` and `refs: [{ namespace: "project", refId: <id> }]` for every dev user, as an anonymous grant expiring after 5 minutes for the anonymous user. For none or several it gives 404.
  - The page's `getToken` calls `/token?project=<id>`, and `{ formId }` never picks the form.
  - demo projects in `acme` and `globex`, and a seed that attaches each project to its form through the API and creates identified and anonymous responses under the project's `refs`.
- **`docs/embedding.md`**: every part listed in [`docs/embedding.md` contents](#docsembeddingmd-contents) except the two marked for phase 4.

**Tests that close this phase**:

- Core unit tests for `buildAnswerSchema` and `interpretAnswers` across all seven types.
- Persistence (PGlite, and `test:pg`): the composite foreign key rejects an answer to a question that isn't in that response's version; a trigger rejects changing a response's version, idempotency key or other fixed columns; the partial unique index enforces one response per respondent on limited forms; deleting a never-published form removes its references by cascade.
- Use case:
  - responses on v1 still point at v1 after v2 is published, and editing a v1 response stays on v1;
  - submitting against a superseded version gives `VersionSuperseded` with `currentVersionId`;
  - the check order on submit and edit;
  - the response limit gives `AlreadyResponded` with the most recent `responseId`;
  - external references are opaque `{ namespace, refId }`, tested with arbitrary namespaces, and the 101st form reference gives `ExternalRefLimitReached`;
  - the stored references equal the actor's `refs`, an empty `refs` stores none, and an edit with different `refs` leaves them unchanged;
  - a replay returns the same `responseId` and inserts nothing, including after the form closes, after a new version is published, and after an edit (with the current revision); a replay on a one-per-respondent form gives 201, not `AlreadyResponded`; the same key from another identified respondent creates a second response; an anonymous replay returns the original.
- `test:pg`: concurrent submits with the same key leave exactly one response.
- `http-api` tests:
  - the respondent half of the unauthorized list: reading or editing another respondent's response gives 404; a respondent from another tenant gets 404 on submit; changing references without `forms:manage` gives 403;
  - the anonymous cases from [Anonymous respondent access and tenancy](./issues/19-anonymous-respondent-access-and-tenancy.md): no token on load or submit gives 401 `missing`; a grant for form A gives 404 on form B's load, answer schema and submit; an `acme` grant naming a `globex` form gives 404; a grant on a limited form loads with `respondent: "anonymous"`, and submitting gives 401 `identityRequired`; a grant on `GET` or `PUT /respond/responses/{id}` gives 401 `identityRequired`; a grant submitting to its open, unlimited form gives 201 with no respondent id stored;
  - the reference cases from [Trust in response external references](./issues/20-trust-in-response-external-references.md): a token with `form` and `refs` submits and the references are stored; `externalRefs` in a body gives 422 and nothing is stored; an identified token bound to form A gives 404 on form B's load, submit and responses; a custom resolver returning `refs` gets them stored;
  - the lookup: one reference on two forms in the tenant returns both, the same reference in another tenant isn't returned, and an unknown reference gives 200 with an empty list;
  - a missing or malformed `idempotencyKey` gives 422, and a replay gives an identical 201 body;
  - a submit declaring 1 MiB plus one byte gives 413.
- The parity test gains a submit, a replay, and 401 `identityRequired`.
- Renderer component tests in Vitest browser mode:
  - `getToken` receives `{ formId }`, the sign-in prompt follows `respondent: "anonymous"`, and each `reason` maps to its message;
  - a rejected `fetch` and a 503 each lock the answers and show Retry, Retry resends the same key, a 201 moves on to the confirmation, and a 422 after Retry unlocks the form;
  - a 413 shows its message, and a form with an unknown question type is refused;
  - for all seven types, a failed submit moves focus to the first invalid input, and each invalid input has `aria-invalid` and an `aria-describedby` pointing at its error.
- Reference host Vitest:
  - a table test of `resolveProjectForm`: no forms, only unpublished, only closed, one open, open plus closed (the open one wins), and two open (ambiguous);
  - `/token?project=<id>` gives 404 for none and for several candidates, refuses a project in another tenant, and mints `form` and `refs` for exactly one; the anonymous user's grant expires after 5 minutes; `/token` with no `project` gives 401 for the anonymous user.
- Playwright, renderer project (Chromium, Firefox, WebKit) in the reference host:
  - load, submit, edit; publish v2 behind an open form, submit, see the reload prompt, then submit on v2;
  - the anonymous dev user submits to an unlimited form, and is prompted to sign in on a form limited to one response per respondent;
  - the "form for project X" route, and the "no open form" and "ambiguous" pages, each seeding its own project and asserting that no `<form-renderer>` is mounted;
  - route interception lets a submit reach the server and drops its reply; Retry shows the confirmation with the same `responseId` the server sent the first time;
  - the axe checks; a keyboard-only run that fills in and submits all seven types using only Tab, Shift+Tab, Space, Enter and the arrow keys; focus moving to the first error through the shadow root; and the strict-CSP test on the real renderer.
  - WebKit's default Tab order may skip buttons and checkboxes. The first ticket that writes the keyboard run checks this, and falls back to Chromium and Firefox for that one test only if WebKit can't reach every control.

**Exit**: closes §12 bullets 4, 6 and 10 (host side), the composite-key half of 5, and the respondent part of 8. Closes the phase 2 rows of [Security cases](#security-cases).

## Phase 3: builder

**Goal**: an editor creates, drafts, previews, publishes and deletes (while never published) forms in the builder UI, and sees each form's publication history.

**Implements**: ADR 0003 (builder), ADR 0005 (editing rules), ADR 0009 (`reidentifyQuestion`), ADR 0014 (the builder action), ADR 0016 (the builder's unknown outcomes); [Frontend framework and renderer embedding strategy](./issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Package layout](./issues/11-package-layout.md), [Identity, authorization and tenancy seam](./issues/09-identity-authorization-and-tenancy-seam.md) (the builder admin actor), [Definition and persistence defects](./issues/27-definition-and-persistence-defects.md) (the id source).

**Deliverables** (`apps/builder`):

- The admin actor from `config.json`: `GET <tokenUrl>` with `credentials: "include"` before each call, and a "Sign in" link to `<loginUrl>` on 401 or a missing `forms:manage`.
- The form list, and creating a form.
- The draft editor: all seven editor components, registered with `satisfies` against core's question types. Every definition change goes through `@fb/core/editing`, including `reidentifyQuestion`, with an id source built on Web Crypto. Move-up and move-down buttons, with keyboard focus following the moved question. Explicit Save, and on `RevisionConflict` the choice to reload or stay.
- Discarding the draft of a published form. On a never-published form, "Delete form" (with a confirmation step) replaces "Discard draft" and returns to the form list.
- Preview through the renderer component's preview mode, which never calls the API.
- Publishing, with every `ValidationFailed` problem shown at once.
- Form settings: the availability toggle and the response limit.
- Publication history: the versions list, reading one version, and the indicator for the current version against the outstanding draft.
- A form's external references, read-only.
- Errors: "This form is too large to save" on 413. On an unknown outcome, "couldn't confirm", then reloading the form list after a create, or the form's detail otherwise.

**Tests that close this phase**:

- Builder component tests where the logic isn't already covered by core: focus follows a question moved up or down; an unknown outcome on create reloads the form list; a 413 shows its message.
- The Playwright builder project (Chromium):
  - create, edit, preview (asserting that no `/respond` request is made), save, publish v1, edit and publish v2, and see both versions in the history;
  - create a form, delete it, and check it's gone from the list.

**Exit**: closes §12 bullet 1 end to end, and bullet 3 through the UI.

## Phase 4: responses and history

**Goal**: authorized admins inspect, filter and delete responses, each shown against the version it was submitted under, and hosts can erase a person and answer access requests. The host's admin page manages references and finds responses by reference.

**Implements**: ADR 0001 §8.1, ADR 0002 (deletion), ADR 0007 (deleting by respondent), ADR 0010's `responses` group and answer-schema endpoint, ADR 0013; [HTTP API surface](./issues/16-http-api-surface.md), [Personal data classification and erasure](./issues/22-personal-data-classification-and-erasure.md).

**Deliverables**:

- **`@fb/server`** `lib/responses`: the list (newest first, keyset pagination on `id`, `limit` 50 by default and 200 at most, every filter optional: form, version, reference and respondent), the read with its version embedded, delete one, and delete by respondent across the whole tenant. Answers and response references go by cascade.
- **`@fb/http-api`**:
  - the `responses` group, with `respondentId` as a path parameter and filter of 1 to 255 code points (otherwise 422);
  - `GET /respond/forms/{formId}/versions/{versionId}/answer-schema`, generated with `z.toJSONSchema` on every request, with the three generator fixes (`pattern: "\\S"`, `uniqueItems`, and `x-fb-minDate`/`x-fb-maxDate`), `maxLength: 254` on email, `x-fb-authoritative: false` and the authority `description`.
- **`apps/builder`**:
  - the response list, with keyset paging and filters;
  - response detail, rebuilt from the embedded version as a read-only question-and-answer list driven by each type's display part in the builder registry, through `interpretAnswers`, not by reusing the renderer;
  - both deletes, behind `responses:delete`.
- **`apps/reference-host`** `src/`: signed in as `acme-admin` or `globex-admin`, add and remove form references and list responses by reference for each demo project.
- **`docs/embedding.md`**: the two phase 4 parts (see [`docs/embedding.md` contents](#docsembeddingmd-contents)).

**Tests that close this phase**:

- Persistence (PGlite): deleting responses removes their answers and references by cascade without firing any immutability trigger, and `UPDATE form_versions SET published_by = …` is still rejected.
- Use case: after erasure, the same idempotency key creates a new response.
- Use-case and `http-api` tests:
  - reading a v1 response after v2 dropped one of its questions and relabelled an option returns v1's snapshots and the raw answers;
  - pagination is stable across edits;
  - delete by respondent covers the whole tenant and returns `{ deleted: 0 }` when there's nothing to delete;
  - after deleting by respondent, the version read still succeeds for every affected form, and no other respondent's response is touched;
  - after the last response of a version is deleted, that version and its question keys still read;
  - after deleting by respondent, the same identified respondent can submit again to a one-per-respondent form;
  - `GET /responses?respondentId=…` with no `formId` lists that respondent's responses across every form in the tenant, and none from another tenant;
  - listing responses by reference finds a response submitted under that `refs` claim;
  - a 256-code-point `respondentId` gives 422.
- `http-api` tests for the responses half of the unauthorized list: without `responses:read`, reading responses gives 403; without `responses:delete`, deleting gives 403; another tenant's admin gets 404.
- The table-driven answer-schema contract test, running every case through Zod and through ajv (2020-12 with formats), including the 254 and 255 email cases. They may differ only on the date-range case.
- Playwright:
  - builder project: open a v1 response after v2 is published and see v1's questions; the `acme-analyst` user reads responses but can't publish or delete;
  - renderer project: the "form for project X" test checks the response is listed under its project, and the dropped-reply test checks the form's response list shows exactly one response.

**Exit**: closes §12 bullet 5, the protected-responses part of 8, and the lookup half of 10. Closes the phase 4 rows of [Security cases](#security-cases).

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
- The phase 4 erasure tests gain their analytics assertions: after deleting by respondent, analytics succeed for every affected form and their counts drop by exactly the deleted responses; after the last response of a version is deleted, analytics still list that version, with its questions present and zero counts.
- Playwright builder project: on a multi-version form the test builds for itself, the analytics view shows counts by version and keeps an absent question out of that version's totals.

**Exit**: closes §12 bullet 9. With it, every §12 bullet and security case is closed.

## Proof of the §12 bar

Each phase's "Tests that close this phase" list is the detail. This is the checklist.

| §12 bullet                                             | Closed in       | Main proof                                                                                        |
| ------------------------------------------------------ | --------------- | ------------------------------------------------------------------------------------------------- |
| 1. Created, drafted, previewed, published              | 1 (API), 3 (UI) | Use-case and `http-api` tests; builder e2e with preview                                           |
| 2. Publishing produces an immutable version            | 1, 4            | Trigger tests on PGlite and `test:pg`; draft edit after publish; erasure leaves versions readable |
| 3. Later edits and publication create a new version    | 1, 3            | Publish, edit, publish use-case test; builder e2e                                                 |
| 4. Responses stay with their original versions         | 2               | Republish and edit use-case tests; fixed-column trigger                                           |
| 5. Historical questions and answers stay interpretable | 2, 4            | Composite foreign key; v1 read after v2 changes; builder e2e                                      |
| 6. New submissions use the intended version            | 2               | `VersionSuperseded` test; three-browser reload e2e                                                |
| 7. Failed publication changes nothing                  | 1               | Incomplete draft; injected failure; save, publish and delete races in `test:pg`                   |
| 8. Unauthorized users are refused                      | 1, 2, 4         | The `http-api` unauthorized list; anonymous-grant and form-binding cases; analyst builder e2e     |
| 9. Analytics by version, differing questions handled   | 5               | Merge-function fixtures; query tests; builder e2e                                                 |
| 10. External references stay host-agnostic             | 2, 4            | Dependency matrix; arbitrary namespaces; `refs` claim tests; project route e2e                    |

## Security cases

Cases beyond §12 bullet 8 that the reopened tickets decided. Each is proven at the layer shown, in the phase shown.

| Case                                                                                 | Phase | Layer                                               | Source                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ----- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Missing, expired, wrongly signed and wrong-audience tokens, each with its `reason`   | 1     | `http-api`                                          | [Anonymous respondent access and tenancy](./issues/19-anonymous-respondent-access-and-tenancy.md)                                      |
| Malformed claim sets, both claim sets and `refs`                                     | 1     | `http-api`                                          | Anonymous respondent access and tenancy; [Trust in response external references](./issues/20-trust-in-response-external-references.md) |
| Over-long `sub`, `tenant` and custom-resolver subjects, and a non-UUID `form`        | 1     | `http-api`                                          | [Request limits and abuse controls](./issues/25-request-limits-and-abuse-controls.md)                                                  |
| A body with no `Content-Length`, and bodies over their limit                         | 1, 2  | `http-api`; `api-server` parity test                | Request limits and abuse controls                                                                                                      |
| An anonymous grant on an admin endpoint                                              | 1     | `http-api`                                          | Anonymous respondent access and tenancy                                                                                                |
| A grant or form-bound token used on another form or tenant                           | 2     | `http-api`                                          | Anonymous respondent access and tenancy; Trust in response external references                                                         |
| Forged references: `externalRefs` in a body, and an edit trying to change references | 2     | `http-api`; use case                                | Trust in response external references                                                                                                  |
| Retried and racing submissions                                                       | 2, 4  | Use case; `test:pg`; renderer component; Playwright | [Retries and idempotency for creates and submissions](./issues/26-retries-and-idempotency-for-creates-and-submissions.md)              |
| Erasure removes a person's responses within one tenant, and nothing else             | 4, 5  | Persistence; `http-api`                             | [Personal data classification and erasure](./issues/22-personal-data-classification-and-erasure.md)                                    |
| An over-long `respondentId`                                                          | 4     | `http-api`                                          | Request limits and abuse controls                                                                                                      |

## `docs/embedding.md` contents

The host-facing contract, in one document. Phase 2 writes every part except the two marked phase 4. Each part states what its sources decided and doesn't add rules.

1. **The element**: the inputs (`api-base-url`, `form-id`, an optional `response-id` for edit mode, and the required `getToken({ formId })` property), the `submitted` and `error` events, and theming through `--form-renderer-*` custom properties and `::part()`. There's no references input. Sources: ADR 0003, ADR 0011, ADR 0012.
2. **Tokens**: the identified claim set and the anonymous grant, form binding, the `refs` claim and its limits, the `sub` and `tenant` caps, short-lived grants, and keeping `refs` short to stay under common header limits. A request with no token is a 401. Sources: ADR 0006, ADR 0011, ADR 0012, ADR 0015.
3. **The reference guarantee**: a response's references are the `refs` of the token that submitted, never anything from the browser, and anyone holding that token before `exp` can submit under them. Source: ADR 0012.
4. **Looking up forms by reference**: the lookup returns every form carrying the reference, an unknown reference gives an empty list, and choosing among them is the host's job. Source: [Lookup cardinality for form external references](./issues/21-lookup-cardinality-for-form-external-references.md).
5. **Strict CSP and Trusted Types**: the element works with no `'unsafe-inline'`, `'unsafe-eval'`, hashes or nonces, and hosts using Trusted Types allow the `svelte-trusted-html` policy. Source: ADR 0008.
6. **The custom-renderer contract**: items 1, 2 and 4 to 7 from [HTTP API surface](./issues/16-http-api-surface.md), with item 4 covering `FormNotPublished` and `PayloadTooLarge`; never sending `externalRefs`; and the idempotency rules (the key's lifetime, resending an unchanged body, what counts as an unknown outcome, and a replay after closing or republishing still returning 201). **Phase 4** adds item 3: optional browser validation through the answer-schema endpoint, with the date-range gap listed. Sources: ADR 0010, ADR 0012, ADR 0015, ADR 0016.
7. **Host duties**: the module doesn't rate-limit, so hosts rate-limit `/respond` (especially submit) and the endpoint that mints grants. Under the Fetch handler, the host owns connection and request timeouts. Hosts run the exported migration themselves. The body limits, and the [design envelope](#design-envelope) as advisory. Sources: ADR 0015, [Persistence model](./issues/10-persistence-model.md), [Expected load and data volumes](./issues/24-expected-load-and-data-volumes.md).
8. **Personal data**: subjects are opaque and pseudonymous, tenants are opaque, form content holds no personal data, and the host owns retention. **Phase 4** adds the erasure procedure (`DELETE /respondents/{respondentId}/responses` once per tenant, and anonymous responses through the references their grants asserted) and the access-request procedure (`GET /responses?respondentId=…` plus each response read). Source: ADR 0013.

## Seed data and the database lifecycle

- **Tests seed themselves** (see [Rules for every phase](#rules-for-every-phase)). The demo seed exists only for manual demos and to give e2e a realistic background.
- **The demo seed is host-owned.** A seed script in `apps/reference-host/seed/` owns the dev users (from phase 1) and the demo projects in `acme` and `globex` (from phase 2). It creates forms, versions, references and responses only through the public API, never by direct inserts, so a seed can never break an invariant. It needs no running server: it builds its own `createFormModuleHandler`, calls `migrate()`, and gives `@fb/api-client` the handler's `fetch`. The dependency matrix gains one row in phase 1: `apps/reference-host/seed` may import `http-api/web` and `api-client`. Each phase extends the seed with what that phase makes possible.
- **The seed signs the same claims as `/token`**, with the dev secret: dev-user tokens for admin writes, and for responses, identified tokens or anonymous grants bound to the project's form and carrying its `refs`. Every submit mints its own `idempotencyKey`. There's still one form per demo project.
- **The multi-version analytics form** joins the seed in phase 5: one form in `acme` with versions that drop a question, add an option, relabel an option, change a number range and reidentify a question, with responses from `alice`, `bob` and anonymous respondents.
- **Resetting**: published forms can't be deleted (ADR 0014), and the seed publishes its forms, so nothing tries to make the seed idempotent.
  - `seed:reset` in `apps/reference-host` runs `DROP SCHEMA IF EXISTS form_management CASCADE` through `docker compose exec -T postgres psql`, then the seed script, which re-migrates and seeds. Dropping the schema is DDL, which the row triggers don't block. The same compose service backs local development and CI, so the task works in both.
  - The `e2e` task depends on `seed:reset`, so every Playwright run starts from a fresh schema plus the demo seed. It's also the manual reset for local demos.

## Settled before hand-off

These were left for phase 0 by earlier tickets and are now decided:

- **Drizzle's migrations table** lives in `form_management`, as ADR 0007 says. The Effect migrator in `drizzle-orm@1.0.0-rc.5-5935859` reads `migrationsSchema` from its config (it defaults to `drizzle`), verified in the published tarball.
- **The reference host's Node-to-Fetch adapter** is `@remix-run/node-fetch-server` 1.0.0 (MIT, no dependencies), using `createRequest` and `sendResponse` inside the Vite middleware. `srvx` was the alternative, and does more than this needs.
- **The repo and its licences** exist (see [Before phase 0](#before-phase-0-done)).

## Caveats carried into implementation

- **TypeScript 6.0.3** is required by dependency-cruiser 18.6, SvelteKit 3 and svelte-check. Vite+ templates default to `^7`.
- **Drizzle `rc5`**: the published `rc` tag crashes on stable Effect. The `SqlError` `paths` shim stays until a newer build ships the fix from Drizzle PR #6429, and its type test flags when it can go.
- **Drizzle migrations generated in the same second** apply in the wrong order, so generate the `--custom` migration in a separate step.
- **dependency-cruiser misses type-only imports in `.svelte`**, so the Oxlint `no-restricted-imports` backstop is load-bearing.
- **tsgolint doesn't type `.svelte` files**: svelte-check stays a cached task, and shadcn-svelte's `components/ui/**` is ignored in lint.
- **A bare `resolve.conditions: ["source"]` loads Svelte's server build in the browser**. Always spread `defaultClientConditions`.
- **The element wrapper must be listed in `sideEffects`**, or it's silently tree-shaken out.
- **`vp run` gives tasks a clean environment**, so `DATABASE_URL` goes in each task's `cache.env` or `cache.untrackedEnv`.
- **Effect Schema's length checks count UTF-16 units**, so every Effect Schema cap uses the shared code-point check.
- **Effect's `MaxBodySize` is ignored on the `toWebHandler` path** and resets the socket on Node, which is why the body limits live in the module's own edge middleware.
- **`crypto.randomUUID()` needs a secure context**. Localhost counts, so the builder's id source works in development and e2e.
- **A typed row mapper doesn't catch a schema looser than its column.** That's accepted: it only weakens what clients are promised.
- **Open upstream Vite+ issues** that may surface in phase 0 are listed in [Vite+ toolchain](./issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md).

## Out of scope

See the map's [Out of scope](./map.md#out-of-scope) section. Nothing in this spec reaches past it.
