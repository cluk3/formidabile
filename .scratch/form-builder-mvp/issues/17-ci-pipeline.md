# CI pipeline

Type: grilling
Status: resolved
Blocked by: 11
Map: [Form builder MVP](../map.md)

## Question

Which CI system runs this repo, and what does each job run for the layout fixed in [Package layout](./11-package-layout.md)?

Decide:

- The CI host. It has to be free, and the repo has no git remote yet, so decide whether choosing a host (and creating a remote) is part of phase 0.
- The jobs and their order:
  - `vp check`, plus `check:svelte` for the renderer and the builder
  - dependency-cruiser, including the bite test from `setup-ts-deep-modules`
  - the `openapi.json` and `lib/schema.d.ts` drift check
  - `vp test` on PGlite, including Vitest browser mode in Chromium. The renderer's test against `dist/form-renderer.js` depends on the element build ([Renderer styles under strict host CSPs](./14-renderer-styles-under-strict-host-csps.md)).
  - `test:pg` against a Postgres 18 service container, including the `apps/api-server` smoke test
  - Playwright against `vp preview` of the reference host and the builder, with axe checks on the renderer. The strict-CSP test always runs in Chromium, Firefox and WebKit, so CI installs all three browsers. Decide the browser matrix for the rest.
- Which jobs gate a merge and which may run less often.
- Caching: the pnpm store, Playwright browsers, and whether the `vp run` cache is kept between CI runs.
- How the pinned Node version, pnpm and the one cataloged `playwright` version are installed, so CI matches local development.
- The single local command that runs the same gates before a push (the root `ready` command from the Svelte research).

## Answer

No ADR. The workflow file, the ruleset and the `ready` task are the record, and the spec describes them.

Facts checked during the session: Vite+ ships an official action, [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) (latest `v1.21.2`, released 2026-10-10). It installs Vite+, Node and the package manager, runs `vp install` and caches package-manager data with `cache: true`. Its docs say to pin an exact release, because the `v1` tag no longer gets updates ([Vite+ CI guide](https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/ci.md)). Vite+ and `setup-vp` choose Node from `.node-version`, then `devEngines.runtime`, then `engines.node`, then `.nvmrc`. Reusing the `vp run` cache across GitHub Actions runs is documented as experimental ([GitHub Actions cache](https://github.com/voidzero-dev/vite-plus/blob/main/docs/guide/github-actions-cache.md)).

- **Host and repo**:
  - GitHub Actions on GitHub-hosted `ubuntu-24.04` runners.
  - Phase 0 creates a **public** GitHub repo under `cluk3` with `gh repo create` and pushes the whole history, including `.scratch/`, `.agents/`, `.claude/`, the ADRs and `GLOSSARY.md`.
  - Before the first push, phase 0 adds a `.gitignore` for `node_modules`, `dist`, `.svelte-kit`, `test-results`, `playwright-report`, `.env*` and `*.local.*`.
  - Amended by [Repository hosting and visibility](./29-repository-hosting-and-visibility.md): the repo is the public `cluk3/formidabile`, created by you, not the agent. You re-author the history to the noreply address, add the MIT `LICENSE` and the vendored skills' `THIRD_PARTY_NOTICES.md`, and do the first push by hand before phase 0. Phase 0 starts from the existing `origin`, adds the `.gitignore` in its first commit, and creates the ruleset once the four checks have reported.
- **How work lands**: through short-lived branches and pull requests, including agent-implemented tickets. The workflow triggers on `pull_request` and on `push` to `main`. A concurrency group per ref cancels superseded runs.
- **Merge gate**:
  - A ruleset on `main` requires a pull request and all four jobs (`static`, `test`, `test-pg`, `e2e`) as required status checks.
  - It blocks force-pushes and deleting `main`, with no bypass list. It doesn't require branches to be up to date.
  - Every job gates the merge. Nothing runs less often, and there's no scheduled workflow, because public repos get unlimited minutes on standard runners.
- **Installing the toolchain**, all from files committed to the repo:
  - Node: an exact `24.20.0` in a root `.node-version`, read by both `vp env` and `setup-vp`.
  - pnpm: `devEngines.packageManager` (pnpm 12.14.0, `onFail: download`).
  - Vite+ and dependencies: `voidzero-dev/setup-vp` with `cache: true`.
  - Browsers: `vp exec playwright install --with-deps <browsers>` for the `playwright` version in the catalog.
- **Jobs**: four parallel jobs with no `needs:` between them. Each runs the same `vp run` task names as `ready`.
  1. **`static`**:
     - `vp check`
     - `check:svelte` for `apps/builder` and `packages/renderer`
     - dependency-cruiser, plus the rules fixture test (below)
     - the drift check: regenerate `packages/http-api/openapi.json` and `packages/api-client/lib/schema.d.ts`, then `git diff --exit-code` on both
     - `drizzle-kit check` (migration commutativity, from [Effect v4 with Drizzle and Postgres](./03-effect-v4-with-drizzle-and-postgres.md))
  2. **`test`**: `vp test` on PGlite, with Vitest browser mode in Chromium. Through its task dependency on `@fb/renderer#build`, it includes the renderer's test against `dist/form-renderer.js`. CI installs only Chromium here.
  3. **`test-pg`**: `test:pg` against real Postgres, including the `apps/api-server` startup smoke test.
  4. **`e2e`**: builds the apps and runs Playwright against `vp preview` of the reference host and the builder. It needs Postgres too, because the reference host's in-process API connects through `databaseUrl`. CI installs Chromium, Firefox and WebKit here.
- **Postgres in CI**: `test-pg` and `e2e` run `docker compose up --wait postgres` from the same root `docker-compose.yml` used locally, with no `services:` block in the workflow. The compose file pins one exact `postgres:18.x` tag, so the image is defined in one place. This replaces "becomes the CI service container" in [How the chosen stack fits together](./07-how-the-chosen-stack-fits-together.md). `DATABASE_URL` has to be declared in each task's `cache.env` or `cache.untrackedEnv`, because `vp run` gives tasks a clean environment.
- **Browser matrix**: two Playwright projects.
  - **Renderer in the reference host**, in Chromium, Firefox and WebKit: load, submit, edit, reload on a superseded version, the axe checks, and the strict-CSP test from [Renderer styles under strict host CSPs](./14-renderer-styles-under-strict-host-csps.md).
  - **Builder flows**, in Chromium only: editing, publishing, and the analyst who can't publish from [Identity, authorization and tenancy seam](./09-identity-authorization-and-tenancy-seam.md).
- **Generated files**: `openapi.json` and `lib/schema.d.ts` are in the Oxfmt and Oxlint ignore patterns, so the drift check compares the generator's raw output byte for byte.
- **Caching**:
  - The pnpm store, through `setup-vp` `cache: true`.
  - `~/.cache/ms-playwright`, keyed on the runner OS and the cataloged `playwright` version. On a hit, CI still runs `playwright install-deps` for the system libraries.
  - The `vp run` task cache is not kept between runs. Cross-run reuse is experimental, and tasks that run `vp`, `oxlint` or `oxfmt` miss after every fresh install anyway ([vite-plus#2845](https://github.com/voidzero-dev/vite-plus/issues/2845)). Within a run, the local task cache still deduplicates work.
- **Dependency-cruiser rules test**:
  - A committed fixture tree has one deliberate violation for each rule family:
    - a deep import
    - a browser-safe package importing `effect`, Drizzle, `jose` or a Node built-in
    - a forbidden edge in the dependency matrix
    - a `*.config.ts` import
    - a type-only deep import in a `.svelte` file (the Oxlint `no-restricted-imports` backstop)
  - A test runs the real config against the fixtures and asserts each violation fails with its expected rule name. It runs in `static`.
  - Phase 0 still does the manual pass, fail, pass sequence from `setup-ts-deep-modules` once.
- **Workflow security**:
  - A top-level `permissions: contents: read`, and no `pull_request_target`.
  - GitHub's default approval requirement stays on for PRs from first-time forks.
  - Every action is pinned by commit SHA, with its release tag in a comment.
  - `.github/dependabot.yml` updates only the `github-actions` ecosystem, weekly. npm dependencies stay exact-pinned in the pnpm catalog.
  - No repository secrets are needed: Postgres credentials and the dev JWT secret are test-only values.
- **Local gate**:
  - A root `ready` task runs the four CI gates in one sequence: it starts Postgres with `docker compose up --wait postgres`, then runs the `static` tasks, `test`, `test:pg` and `e2e`.
  - Compose it with `dependsOn` or real commands, not commands that call `vp run <script>`, which lose caching ([vite-plus#2238](https://github.com/voidzero-dev/vite-plus/issues/2238)).
  - The pre-commit hook stays the scaffold's `vp staged`, and there's no pre-push hook.
  - You run `ready` before opening a PR, and `AGENTS.md` tells implementing agents to do the same.
