# Phased implementation plan and spec

Type: grilling
Status: resolved
Blocked by: 05, 06, 07, 08, 09, 10, 11, 13, 14, 15, 16, 17
Map: [Form builder MVP](../map.md)

## Question

What is the phased implementation plan from an empty repo to the ADR 0001 §12 bar, and does the resulting spec at `.scratch/form-builder-mvp/spec.md` leave nothing to decide before implementation?

Decide:

- Phase 0 (repo setup) contents: workspace, Vite+, dependency-cruiser, Postgres for local development and tests, Playwright, CI. [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md) already fixes several of these: exact pins in the pnpm catalog, the base tsconfig, the `SqlError` paths shim and its type test, the docker compose Postgres 18 service, `vp test` on PGlite plus an opt-in `test:pg`, and the `openapi.json` drift check. [CI pipeline](./17-ci-pipeline.md) fixes the GitHub remote, the workflow and its four jobs, the `main` ruleset and the root `ready` command.
- The order of the vertical slices after that (e.g. create and publish, then submit, then historical view, then analytics, then host integration), and the exit criteria of each, tied to the §12 demonstration list.
- Which §12 invariants each phase's automated tests prove.
- Writing the spec itself, ready for `/to-tickets`.

## Answer

The spec is written at [`spec.md`](../spec.md). No ADR: the plan is easy to change and has no surprising trade-off, so the spec is its record. No glossary changes.

Two fact checks ran during the session, closing items earlier tickets had left for phase 0:

- The Effect migrator in `drizzle-orm@1.0.0-rc.5-5935859` honours `migrationsSchema` (default `drizzle`), read from `pg-core/effect/session.js` in the published tarball. ADR 0007's placement of the migrations table in `form_management` stands.
- `@remix-run/node-fetch-server` 1.0.0 (MIT, no dependencies) exports `createRequest` and `sendResponse`, which fit Vite's connect middleware. It's the reference host's Node-to-Fetch adapter.

Decisions:

- **What the spec is**: an index plus plan. It links the ADRs and tickets rather than restating them, and adds only the phase order, each phase's deliverables by package or app, its exit tests, the §12 checklist and the seed data. The ADRs win any disagreement.
- **Slicing**: after phase 0, vertical slices, each closing at least one §12 bullet.
- **Phase 0**: setup only, with the final shape everywhere: all eight workspaces as shells with their real entry points, the catalog pins, the tsconfigs and shim, the full dependency-cruiser config and its fixture test, compose Postgres plus PGlite, an empty `HttpApi` with `openapi.json` and the drift check, an empty Drizzle schema with `drizzle-kit check`, the migrator, Playwright with a smoke test, the GitHub repo, the four CI jobs, the ruleset and `ready`. It also builds both frontend pipelines around placeholders: the renderer element with the constructable-stylesheet plugin and the three-browser strict-CSP test, and the SvelteKit builder shell with `check:svelte`. It settles the CSP ticket's unverified points and records them in the packages README. No domain code.
- **Phase order**:
  1. Author and publish through the API (core definition and editing, authoring persistence and triggers, the actor seam, the forms, drafts and versions endpoints, the client, and the reference host's `/api`, `/login` and `/token`).
  2. Respond (core answers, responses and answers persistence, the `/respond` group, form external references and the lookup by reference, the renderer and its element under strict CSP, the "form for project X" route, `docs/embedding.md`). Form references and the lookup moved here from phase 4 because the project route needs them.
  3. Builder (draft editing on `core/editing`, preview through the renderer component, revision conflicts, `reidentifyQuestion`, settings, publication history).
  4. Responses and history (admin list, read and deletes, the answer-schema endpoint and its contract test, the builder's response screens, the host's reference admin).
  5. Analytics (queries, merge functions, endpoint, builder view).

  The renderer comes before the builder because preview reuses the renderer component.

- **Exit criteria**: automated only. Each §12 item assigned to the phase has its tests, `ready` is green, and the four CI jobs are green. No manual demo.
- **Test levels**: each invariant is proven at the lowest layer that can break it (triggers in persistence tests on PGlite and `test:pg`, use-case rules in server tests, status codes and capabilities in `http-api` tests through the Fetch handler), and exercised once from above. Playwright covers only cross-component flows, the CSP test and axe.
- **The §12 checklist**: the spec's "Proof of the §12 bar" table and each phase's test list.
- **Migrations**: append-only from the first one, with one generate plus one custom migration per schema change. Phase 1 creates the authoring tables, phase 2 the responses, answers (indexed `(version_id, question_id)` from the start) and references, and phase 5 adds no schema.
- **Question types**: all seven per layer in the phase where that layer arrives (core in phase 1, the renderer in phase 2, the builder in phase 3), with no temporary loosening of the registries.
- **Admin screens live in the builder**, each in the phase that ships its API: publication history in phase 3; the response list, detail and deletes in phase 4; analytics in phase 5. Response detail is a read-only question-and-answer list driven by each type's display part, not the renderer. Analytics uses tables with plain CSS bars and no chart library. The analyst builder e2e moves to phase 4.
- **Ticket boundaries**: the spec doesn't fix them. `/to-tickets` slices each phase, and every ticket must leave `ready` green.
- **Seed data**, which graduates the map's last "Not yet specified" patch:
  - Tests seed themselves and assert only on what they created.
  - The demo seed is host-owned, in `apps/reference-host/seed/`, and writes only through the public API, through its own in-process handler and the client. It adds one dependency-matrix row: `seed` may import `http-api/web` and `api-client`.
  - The multi-version analytics form joins the seed in phase 5.
  - `seed:reset` drops `form_management` through `docker compose exec psql`, then re-migrates and seeds. The `e2e` task depends on it, so every Playwright run starts fresh. This is the same drop, migrate and seed agreed in the session, run as a task dependency rather than from Playwright's global setup, because the drop needs a SQL connection the e2e project doesn't have.
