# Vite+ toolchain for a pnpm monorepo

Type: research
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

What does Vite+ provide today, and how is it set up in a pnpm workspace monorepo that will hold several TypeScript packages, a React-style frontend, and a Node backend?

Find out:

- Current release status, licence, and install path (CLI name, config file shape).
- What it covers: dev server, build (app and library), test (Vitest), lint, format, task running and caching across workspace packages.
- How it handles library packages that other workspace packages consume (build or source imports, type declarations).
- Whether it coexists with dependency-cruiser and Playwright, or whether either is replaced or awkward.
- Anything relevant to running a Node backend (not only frontend apps) under it.
- Known gaps or rough edges that would affect phase 0 repo setup.

## Answer

Vite+ is stable and MIT-licensed: 1.0.0 shipped on 2026-09-28 and `latest` is 1.3.0 (2026-10-16). It needs Node `^22.18 || ^24.11 || >=26`. It is one `vite-plus` dev dependency providing the `vp`/`vpr` CLI, configured through a single root `vite.config.ts` (`defineConfig` from `vite-plus`, with `run`/`lint`/`fmt`/`check`/`test`/`pack`/`staged` blocks).

It covers:
- `vp dev` and `vp build` (Vite 8);
- `vp pack` (tsdown library builds with `.d.ts`);
- `vp test` (Vitest 5);
- `vp lint`, `vp fmt` and `vp check` (Oxlint and Oxfmt, with type-checking through tsgolint);
- `vp run` (a pnpm-filter-compatible workspace task runner with a local cache that tracks inputs and outputs automatically).

The stock library template exports `dist/`, so consumers need a build first. A `source` export condition, plus `customConditions` in tsconfig and `resolve.conditions` in the consumer's Vite config, lets Node, `vp test` and `vp check` use library source directly (verified in a `/tmp` scaffold). There is no Node-server command. The backend runs with Node 24's built-in type stripping (`node --conditions=source --watch`), is tested with `vp test` and is bundled with `vp pack`.

Playwright Test is not replaced: it runs as a separate task, but Vitest's default `*.spec.ts` include must exclude the e2e files. The scaffold's TypeScript `^7` stops dependency-cruiser 18.6.0 from parsing any `.ts` file, so pin `typescript: 6.0.3` in the catalog; Vite+ accepts TypeScript 5–7, and with 6.0.3 both tools were verified working. Other phase-0 rough edges are open upstream issues:
- loosened pnpm peer checks for the `vite` alias ([#2806](https://github.com/voidzero-dev/vite-plus/issues/2806));
- `vp run` skipping pnpm's stale-install check ([#3091](https://github.com/voidzero-dev/vite-plus/issues/3091));
- false cycle reports from dev and peer links between sibling packages ([#1610](https://github.com/voidzero-dev/vite-plus/issues/1610));
- `mergeConfig` with unbuilt workspace imports breaking task-graph loading ([#1709](https://github.com/voidzero-dev/vite-plus/issues/1709)).

Setup constraints documented or observed: no tsconfig `baseUrl` (type-aware lint skips it); `vp build` run at the workspace root with no target exits 1 in CI; mismatched `@types/node` versions duplicate `vite-plus` peer instances, so catalog it; pin `vite-plus` exactly, since releases come out weekly.

[Findings](../research/vite-plus-toolchain.md)
