# Vite+ toolchain for a pnpm monorepo

Researched 2026-10-19 against `vite-plus@1.3.0` (npm `latest`), docs at [voidzero-dev/vite-plus@554486b](https://github.com/voidzero-dev/vite-plus/tree/554486b5cf6ce5e86bbc03912489483a65928e2f/docs) (published at [viteplus.dev](https://viteplus.dev/guide/)), plus a throwaway scaffold in `/tmp` (`pnpm create vite-plus@1.3.0 vite:monorepo`, Node 24.20.0, pnpm 12.14.0).

Contributors:
- VitePlusResearch: initial npm findings.
- VitePlusResearch2-2: the dependency-cruiser and TypeScript 7 findings (meta.cjs, #1112, #1104), `devExports`, #1117, and the Implications and Open risks sections.
- VitePlusResearch-2: the upstream issue list.

All claims were re-verified against primary sources.

## Summary

Vite+ has been stable and MIT-licensed since 1.0.0 on 2026-09-28. The current version is 1.3.0, released 2026-10-16. It is one dev dependency, `vite-plus`, which provides the `vp` and `vpr` binaries and is configured through a root `vite.config.ts` using `defineConfig` from `vite-plus`. It bundles Vite 8 (dev server and app builds), tsdown (library builds), Vitest 5, Oxlint with tsgolint type-checking, Oxfmt, and Vite Task (a task runner with a local cache that works out each task's inputs and outputs by itself).

In a pnpm workspace:
- Lint, format and type-check config lives once at the root.
- `vp run -r` runs `package.json` scripts in dependency order and can cache them.
- Libraries are built with `vp pack`. The stock template exports `dist/`, so consumers need a build first. Pointing a custom export condition at source avoids that.

Two things affect our setup:
- **Templates install TypeScript 7.** dependency-cruiser 18.6.0 cannot use TypeScript 7 and silently skips every `.ts` file. Pinning TypeScript 6.0.3 fixes this, and Vite+ accepts it.
- **There is no Node backend runner.** We run the API with Node's built-in type stripping, test it with `vp test`, and bundle it with `vp pack`.

Playwright Test is not replaced. It runs alongside as a separate tool.

## Release status, licence, install path, CLI, config

- **Stable since 1.0.0 (2026-09-28).** The [v1.0.0 release](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0) is titled "Vite+ 1.0 is stable". It promoted 1.0.0-rc.1 with no code changes. The [troubleshooting page](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/troubleshooting.md) also says "Vite+ 1.0 is available".
- **Recent releases.** Observed with `npm view vite-plus time dist-tags`:

  | Version | Date |
  | --- | --- |
  | 0.3.3 | 2026-09-18 |
  | 1.0.0 | 2026-09-28 |
  | 1.1.0 | 2026-10-07 |
  | 1.2.0 | 2026-10-14 |
  | 1.3.0 (`latest`) | 2026-10-16 |

  An `alpha` tag still points at `0.1.21-alpha.7`. Releases are frequent, weekly or faster, and come with migration notes. For example, rc.1 moved task cache settings under `cache` ([v1.0.0 notes](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.0.0)).
- **Bundled tool versions in 1.3.0** ([v1.3.0 release](https://github.com/voidzero-dev/vite-plus/releases/tag/v1.3.0)):

  | Tool | Version |
  | --- | --- |
  | vite | 8.3.4 |
  | rolldown | 1.2.14 |
  | tsdown | 0.23.1 |
  | vitest | 5.0.5 |
  | oxlint | 1.88.0 |
  | oxlint-tsgolint | 7.0.2004 |
  | oxfmt | 0.73.0 |

  These match `npm view vite-plus@1.3.0 dependencies`, where `vite` is aliased to `npm:@voidzero-dev/vite-plus-core@1.3.0`.
- **Licence: MIT, "Copyright (c) 2026-present, VoidZero Inc."** Sources: [LICENSE](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/LICENSE) and npm `license = 'MIT'`.
- **Node requirement.** `engines.node` is `^22.18.0 || ^24.11.0 || >=26.0.0` (npm). Vitest 5 sets that floor ([test guide](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/test.md)).
- **Two ways to install** ([getting started](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/index.md), [local CLI](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/local-cli.md)):
  - **Project-local.** Add `vite-plus` as a dev dependency. It "requires an existing Node.js runtime and package manager". The binaries are `vp` and `vpr`, where `vpr` is short for `vp run` (npm `bin`).
  - **Optional global `vp`.** Installed with `curl -fsSL https://vite.plus | bash`. It also manages Node and package-manager versions; `vp env off` opts out.

  The docs recommend `package.json` scripts that call `vp` for collaborator projects.
- **Config shape.** A single `vite.config.ts` with `defineConfig` from `vite-plus`. Normal Vite keys (`server`, `build`, `preview`) sit next to Vite+ blocks: `create`, `run`, `fmt`, `lint`, `check`, `test`, `pack`, `staged`, `defaultPackage` ([config index](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/config/index.md)). The docs advise against a separate `vitest.config.ts` or `tsdown.config.ts` ([test](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/test.md), [pack](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/pack.md)).
- **Scaffold.** `vp create vite:monorepo` (or `pnpm create vite-plus vite:monorepo`) creates `apps/website` from create-vite `vanilla-ts` and `packages/utils` from the [tsdown `vite-plus` template](https://github.com/sxzz/tsdown-templates/tree/main/vite-plus) ([monorepo.ts](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/packages/cli/src/create/templates/monorepo.ts)). Observed output in `/tmp`:
  - The root `package.json` has `devDependencies: { "vite-plus": "catalog:" }`, `devEngines.packageManager` set to pnpm 12.14.0 with `onFail: "download"`, `engines.node >=22.18.0`, and a `prepare: "vp config"` script that installs git hooks.
  - `pnpm-workspace.yaml` uses `catalogMode: prefer`, with catalog entries `vite: npm:@voidzero-dev/vite-plus-core@1.3.0`, `vite-plus: 1.3.0` and `typescript: ^7.0.2`. It also adds the override `vite@*: "catalog:"` and `peerDependencyRules` for `vite`.
  - The root `vite.config.ts` has `staged`, `fmt`, `lint` (with `typeAware: true, typeCheck: true` and the `vite-plus/prefer-vite-plus-imports` rule) and `run: { cache: true }`.

## What it covers

| Area | Command | Engine | Source |
| --- | --- | --- | --- |
| Dev server | `vp dev` | Vite 8, standard Vite config | [dev](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/dev.md) |
| App build / preview | `vp build`, `vp preview` | Vite 8 + Rolldown | [build](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/build.md) |
| Library build | `vp pack` | tsdown: `.d.ts` generation, formats, watch, `exe` | [pack](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/pack.md) |
| Test | `vp test` (single run), `vp test watch` | Vitest 5.0.5; APIs from `vite-plus/test` | [test](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/test.md) |
| Lint | `vp lint` | Oxlint, with JS plugins via `lint.jsPlugins` | [lint](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/lint.md) |
| Format | `vp fmt` | Oxfmt | [check](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/check.md) |
| Format + lint + type-check | `vp check` (`--fix`) | type-check via tsgolint (TypeScript Go) when `typeAware` and `typeCheck` are on | [check](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/check.md) |
| Task runner + cache | `vp run` / `vpr` | Vite Task | [run](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/run.md), [cache](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/cache.md) |
| Staged files / git hooks | `vp staged`, `vp config`, `vp hooks` | built-in dispatcher | [getting started](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/index.md) |

- **Built-in commands are fixed.** `vp dev`, `build`, `test`, `lint`, `fmt`, `check` and `pack` cannot be overridden. A `package.json` script with the same name runs only through `vp run <name>` ([run](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/run.md)).
- **Workspace task running** ([run](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/run.md)):
  - `-r` runs every package in dependency order, taken from `package.json` dependencies.
  - `-t` runs one package plus its dependencies.
  - `--filter` uses pnpm syntax.
  - `--parallel` ignores ordering.
  - `dependsOn` accepts entries like `'@my/core#build'` or `{ task: 'build', from: 'dependencies' }`.
  - At most 4 tasks run at once by default.
- **What gets cached** ([cache](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/cache.md), [automatic data tracking](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/automatic-data-tracking.md)):
  - Tasks defined in `vite.config.ts` are cached by default. `package.json` scripts are not, unless you pass `--cache` or set `run.cache`. The scaffold sets `run.cache: true`.
  - Inputs and outputs are found by tracking file-system reads and writes. `vp build` and `vp test` also report extra cache metadata to the runner.
  - Results are saved only when the task exits with code 0.
- **Where the cache lives.** The cache is local, in `node_modules/.vite/task-cache`. Reusing it across GitHub Actions runs is marked "experimental" ([GitHub Actions cache](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/github-actions-cache.md)). The docs mention no remote or shared cache.
- **Observed cache behaviour.** In the `/tmp` scaffold, `vp run -r build` ran 3 tasks: the website's `tsc` and `vp build`, and the utils `vp pack`. The immediate rerun reported "3/3 cache hit (100%) … 5.34s saved".

## Library packages consumed by other workspace packages

- **The stock library depends on its build.** The template's `package.json` has `"exports": { ".": "./dist/index.mjs" }`, `files: ["dist"]` and `build: "vp pack"`. Its `vite.config.ts` has `pack: { dts: { generator: "tsgo" }, exports: true }` (observed in the scaffold). The raw template ([sxzz/tsdown-templates `vite-plus`](https://github.com/sxzz/tsdown-templates/tree/01a79e7473ae2cb90af2b1312decc54c14b7cb91/vite-plus), last commit touching the folder 01a79e74, 2026-10-15) has `dts: { tsgo: true }` instead. The difference comes from `vp create`, which runs the migrator on the new library (`rewriteMonorepoProject` in [monorepo.ts](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/packages/cli/src/create/templates/monorepo.ts)). The migrator also adds `deps.resolveDepSubpath: true` (seen in the scaffold) and, when `attw` is set, an `attw` `profile` default ([pack_config.rs](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/crates/vp_migration/src/pack_config.rs)). Both are compatibility defaults to review. `exports: true` makes tsdown rewrite `exports` from the build ([tsdown package exports](https://github.com/rolldown/tsdown/blob/main/docs/options/package-exports.md)). So consumers resolve `dist`, and the library must be built first, for example with `dependsOn: [{ task: 'build', from: 'dependencies' }]` or `vp run -t`. In the experiment, deleting `dist` made `node src/main.ts` in the consumer fail with `ERR_MODULE_NOT_FOUND …/utils/dist/index.mjs`.
- **Source-import option from tsdown.** `exports.devExports: true` points `exports` at source and moves the built exports into `publishConfig`. A string value adds a custom condition instead, meant to be paired with TypeScript `customConditions` ([tsdown package exports](https://github.com/rolldown/tsdown/blob/main/docs/options/package-exports.md)).
- **Verified source-import setup in `/tmp`.** The library had `"exports": { ".": { "source": "./src/index.ts", "default": "./dist/index.mjs" } }` and `pack.exports: false`. The consumer worked without any library build in each tool once configured:

  | Tool | What it needed |
  | --- | --- |
  | `node --conditions=source src/main.ts` | Nothing else; it ran the library's TypeScript source |
  | `vp test` | Fails without config. Passes with `resolve.conditions: ["source"]` and `ssr.resolve.conditions` / `externalConditions: ["source"]` in the package's `vite.config.ts` |
  | `vp check` | `"customConditions": ["source"]` in the consumer tsconfig; then it type-checks across the package boundary and reported an injected TS2322 error |
- **Declaration files** come from `vp pack` with `dts` ([pack](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/pack.md)). With TypeScript 7, tsdown warns: "TypeScript 7.0 does not yet have a stable API and is experimental. Some options will be unavailable" (observed). With TypeScript 6.0.3 and `dts.generator: "tsc"`, it emitted `index.d.mts` cleanly (observed).
- **Only TypeScript versions are aligned across members.** The monorepo template aligns TypeScript across members because mismatched versions create separate `vite-plus` peer instances under pnpm ([monorepo.ts `alignMonorepoTypeScriptVersion`](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/packages/cli/src/create/templates/monorepo.ts)). It does not align `@types/node`. The library template ships `^26.6.5` and the root catalog `^24`, and we observed duplicate `vite-plus@1.3.0_@types+node@24…` and `…@26…` instances in `.pnpm`.

## Coexistence with dependency-cruiser and Playwright

- **dependency-cruiser runs as an ordinary separate tool.** You run it through `vp run` or `vp exec depcruise`. Vite+ has no equivalent: Oxlint covers lint rules plus custom JS-plugin rules ([lint](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/lint.md)), but nothing like path-based dependency rules.
- **TypeScript 7 breaks dependency-cruiser.**
  - dependency-cruiser declares the TypeScript range as `typescript: ">=2.0.0 <7.0.0"` ([src/meta.cjs line 14 @ 8b4dbdee](https://github.com/sverweij/dependency-cruiser/blob/8b4dbdee044fec740dc265ed9cd772387cc152ac/src/meta.cjs#L14)), and `depcruise --info` (18.6.0) shows the same range. With TypeScript 7.0.2 installed it shows `x typescript`, with no `.ts` support. A cruise then reported only `dist/*.mjs` files (observed).
  - The maintainer says "typescript 7 isn't usable as it doesn't have an API yet" ([#1069](https://github.com/sverweij/dependency-cruiser/issues/1069)). That issue is closed only because a stale bot closed it on 2026-08-01; it is not fixed. The "Support for Typescript v7" request is open ([#1112](https://github.com/sverweij/dependency-cruiser/issues/1112), opened 2026-10-19). The `swc` parser fallback has open gaps ([#1104](https://github.com/sverweij/dependency-cruiser/issues/1104)): `.mts`/`.cts` files are skipped, and `export type … from` is not treated as type-only.
  - The tool itself prints: "Install typescript to get better results (e.g. npm i -D typescript@^6) … Support for typescript@>=7 will follow when its API is published and stable" (observed).
  - npm lists `typescript` 7.0.2 as `latest` and 6.0.3 as the newest 6.x.
- **TypeScript 6.0.3 fixes it.** Vite+ accepts it: `@voidzero-dev/vite-plus-core` and `tsdown@0.23.1` peer on `typescript ^5 || ^6 || ^7` (npm). After a clean install with the catalog pinned to 6.0.3, everything worked (observed):
  - `depcruise --info` showed `✔ typescript … typescript@6.0.3` with `.ts` support.
  - A forbidden `packages/utils → apps/api` import was reported as an error.
  - Workspace imports resolved to `packages/utils/src/index.ts` with `enhancedResolveOptions: { conditionNames: ["source","import","default"], exportsFields: ["exports"] }`.
  - `vp check`, `vp pack` and `vp run -r build` all passed.

  Upgrading TypeScript in place left TypeScript 7 hoisted in `node_modules/.pnpm/node_modules` until `node_modules` was deleted (observed).
- **Playwright overlap.**
  - Vite+ uses Playwright only as an optional provider for Vitest browser mode. `playwright` and `@vitest/browser-playwright` are optional peers ([migrate guide](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/migrate.md); npm `peerDependenciesMeta`). Nothing replaces `@playwright/test` (latest 1.64.1 on npm) for end-to-end tests.
  - The Docker guide recommends `vp exec playwright install --with-deps chromium`, so the browser matches the lockfile ([docker](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/docker.md)). `PLAYWRIGHT_*` is in Vite Task's default pass-through env list ([run config](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/config/run.md)).
  - One awkward point: Vitest's default `include` is `**/*.{test,spec}.?(c|m)[jt]s?(x)` ([Vitest include](https://github.com/vitest-dev/vitest/blob/main/docs/config/include.md)). Playwright `*.spec.ts` files would be picked up by `vp test` unless they are excluded or named differently.

## Running a Node backend

- **No backend runner.** `vp dev` always starts the Vite dev server ([dev](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/dev.md)). The docs' own monorepo example keeps the API's own scripts (`"dev": "tsx watch src/index.ts"`) and runs them with `vp run -r --parallel dev` ([monorepo](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/monorepo.md)). Lint overrides can scope `env: { node: true }` to `apps/api/**` (same page). Native backend dev/watch support is an open request ([#1117](https://github.com/voidzero-dev/vite-plus/issues/1117), opened 2026-03-23). It says `vp dev` starts an unneeded frontend server on port 5173 for backend-only packages, and that Vite-only features such as `import.meta.glob` are not transformed when the output runs in Node. So backend code should avoid Vite-only APIs.
- **Node type stripping instead of `tsx`.** Node's type stripping is enabled by default since v23.6.0 and stable since v24.12.0. It handles erasable syntax only, so set `erasableSyntaxOnly` in tsconfig. It refuses `.ts` files under `node_modules` paths and does not apply tsconfig `paths` ([Node TypeScript docs](https://github.com/nodejs/node/blob/v24.x/doc/api/typescript.md)). pnpm workspace symlinks resolve to real paths outside `node_modules`, so `node --conditions=source src/main.ts` ran workspace-library TypeScript source on Node 24.20.0 (observed). `node --watch` covers the dev loop.
- **Bundling the backend.** `vp pack` with `pack: { entry: ["src/main.ts"], platform: "node" }` produced `dist/main.mjs` (observed). It left `import { fn } from "utils"` external, because tsdown externalizes declared dependencies by default. Deploying the bundle therefore needs built workspace libraries, or tsdown's bundling options. `vp pack` can also make single-file executables (needs Node ≥ 25.7.0) ([pack](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/pack.md)).
- **Tests.** `vp test` runs Node-side Vitest suites for the backend (observed with `vite-plus/test` imports).
- **Environment.** Tasks run through `vp run` get a "clean environment". Only allow-listed variables like `PATH`, `HOME` and `CI` pass through, so variables such as `DATABASE_URL` need `cache.env` or `cache.untrackedEnv` ([cache](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/cache.md), [run config](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/config/run.md)).

## Known gaps and rough edges for phase 0

- **Defaults to TypeScript 7.** This breaks dependency-cruiser's TypeScript parsing (above). Pin `typescript: 6.0.3` in the catalog and use `pack.dts.generator: "tsc"` until dependency-cruiser supports TypeScript 7.
- **Nested `lint`/`fmt` config is ignored.** A package's `vite.config.ts` `lint`/`fmt` blocks are not applied per file. `vp check` always uses the root blocks, so use `lint.overrides` / `fmt.overrides` at the root ([monorepo](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/monorepo.md), [troubleshooting](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/troubleshooting.md)). The scaffold strips `lint`/`fmt` from member configs for this reason. Whether to support nested config is still under discussion ([discussion #2669](https://github.com/voidzero-dev/vite-plus/discussions/2669)).
- **`vite-plus` vs `vite` imports.** `vite-plus` owns only `defineConfig`, `defineProject` and `lazyPlugins`. Other Vite APIs should stay as `vite` imports, which resolve to the `@voidzero-dev/vite-plus-core` alias. Test APIs come from `vite-plus/test` ([migrate rules, "`vite` Imports"](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/migrate-rules.md)).
- **Plugins load for every command.** Top-level plugins in `vite.config.ts` load even for `vp lint`/`vp fmt` and editor tooling. Wrap heavy ones in `lazyPlugins(...)` ([troubleshooting](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/troubleshooting.md)).
- **No `baseUrl`.** tsgolint type-checking does not support tsconfig `baseUrl` ([troubleshooting](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/troubleshooting.md)). Use package `exports` or `#` subpath imports instead of path aliases; Node type stripping requires this too.
- **App commands at the workspace root need a target.** `vp dev`, `build`, `preview` and `pack` at the root need `-C <dir>` or `defaultPackage`. In non-interactive shells they exit 1 when several packages match ([monorepo](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/monorepo.md)). In CI, use `vp run -r <task>` or `vp -C`.
- **pnpm version and config are set by the scaffold.** It pins `devEngines.packageManager` to pnpm 12.14.0 with `onFail: download`; with pnpm 11.27.1 on PATH, installs ran as pnpm 12.14.0 (observed). It also injects the `vite@*` override and peer rules that the toolchain relies on ([migrate rules](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/migrate-rules.md)). Keep those when hand-writing `pnpm-workspace.yaml`.
- **Misaligned `@types/node`** across members duplicates `vite-plus` peer instances (observed). Put it in the catalog.
- **Open upstream issues** (all confirmed open via `gh issue view` on 2026-10-19):
  - **Peer checks.** The `vite` → `@voidzero-dev/vite-plus-core` alias relies on blanket `peerDependencyRules` exceptions, so strict pnpm peer validation for Vite plugins is lost ([#2806](https://github.com/voidzero-dev/vite-plus/issues/2806), opened 2026-09-24).
  - **Stale installs.** `vp run` skips pnpm 11+'s `verifyDepsBeforeRun` check. After a pull that changes the lockfile, scripts can run against stale `node_modules`; run `vp install` first ([#3091](https://github.com/voidzero-dev/vite-plus/issues/3091), opened 2026-10-16).
  - **False cycles.** `vp run --filter` includes `devDependencies`/`peerDependencies` sibling links in its graph and can report cycles that pnpm would not ([#1610](https://github.com/voidzero-dev/vite-plus/issues/1610), opened 2026-05-17).
  - **Task-graph load failure.** A package `vite.config.ts` that uses `mergeConfig` and imports from an unbuilt workspace package breaks task-graph loading ("Failed to load task graph") ([#1709](https://github.com/voidzero-dev/vite-plus/issues/1709), opened 2026-05-29). Keep `vite.config.ts` files free of imports from workspace packages that need a build.
  - **Lost caching through `vp run`.** A `run.tasks` entry whose command is `vp run <script>` silently loses task-level caching ([#2238](https://github.com/voidzero-dev/vite-plus/issues/2238), opened 2026-07-25). Put the real command in the task instead.
  - **Cache misses after reinstall.** Cached tasks that run `vp`, `oxlint` or `oxfmt` miss after every reinstall, because config loading reads `node_modules/.modules.yaml` ([#2845](https://github.com/voidzero-dev/vite-plus/issues/2845), opened 2026-09-28).
  - **No graph view.** There is no command that shows the workspace dependency graph; it is a feature request ([#1182](https://github.com/voidzero-dev/vite-plus/issues/1182), opened 2026-03-28).
- **Cache caveats.** The cache is local only, and CI reuse is experimental. Tasks that read environment variables need `cache.env` declarations; the tracker cannot see env reads ([automatic data tracking](https://github.com/voidzero-dev/vite-plus/blob/554486b5cf6ce5e86bbc03912489483a65928e2f/docs/guide/automatic-data-tracking.md)).
- **Release churn.** Five releases in four weeks around 1.0, with config moves between release candidates ([releases](https://github.com/voidzero-dev/vite-plus/releases)). Pin an exact `vite-plus` version in the catalog; the scaffold does this.
- **Not confirmed:** how `vp run` caching behaves for long-running watch or dev tasks that never exit with code 0. The docs say only that successful runs are cached.

## Implications for this project

- Root `vite.config.ts`:
  - lint, fmt, `typeAware`/`typeCheck` and `staged`;
  - `lint.overrides` for `apps/web/**` (react plugin) and `apps/api/**` (`env.node`);
  - `run.tasks` for cached `build`, `test` and `depcruise` tasks.
- Catalog in `pnpm-workspace.yaml`: `vite-plus` exact, the `vite` core alias, `typescript: 6.0.3`, `@types/node`, `dependency-cruiser`. Keep the override and peer rules the scaffold adds.
- Workspace libraries:
  - export a `source` condition pointing at `src/index.ts`, with `dist` as `default`;
  - set `customConditions: ["source"]` in tsconfig;
  - set `resolve.conditions` and `ssr.resolve.conditions` in consumers' `vite.config.ts`;
  - set `conditionNames` and `exportsFields` in dependency-cruiser.

  This keeps dev, test and depcruise working without build steps. `vp pack` with `dts` stays available for anything that needs `dist`.
- Backend (`apps/api`):
  - `node --conditions=source --watch src/main.ts` for dev;
  - `vp test` for Vitest;
  - `vp pack` (`platform: "node"`) for a deployable bundle;
  - tsconfig with `erasableSyntaxOnly` and `verbatimModuleSyntax`.

  Run it through `vp run`, declaring env vars under `cache.env`/`untrackedEnv`.
- Playwright: `@playwright/test` lives in its own package (for example `apps/e2e`) and runs via `vp run e2e`/`vp exec playwright`. Keep e2e files out of Vitest's `include`. Install browsers with `vp exec playwright install`.
- Node: target Node 24 LTS (≥ 24.11 for Vitest 5; type stripping stable from 24.12).

## Open risks

- dependency-cruiser and TypeScript 7: staying on TypeScript 6 is a holdover until [#1112](https://github.com/sverweij/dependency-cruiser/issues/1112) lands. Vite+ templates and tsdown are already on 7, so later scaffolds or `vp migrate` runs may push TypeScript 7 back in.
- The source-condition pattern is our own wiring (verified only in a toy scaffold). The Vite+ docs describe only the `dist`-export template. Effect, Drizzle and the React toolchain still need checking under Vite's `ssr.resolve.conditions`.
- Vite+ is young (1.x since 2026-09-28) and releases weekly. Bundled tool versions move together, so a Vite+ bump also bumps Vitest, Oxlint and tsdown at once.
- There is no remote task cache, so CI speed relies on the experimental `actions/cache` reuse or none.
- Oxlint type-aware rules and type-checking run on tsgolint (TypeScript Go), not `tsc`. Edge-case differences from `tsc` with TypeScript 6 were not evaluated.
