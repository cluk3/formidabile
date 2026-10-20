# 01: Workspace, toolchain, and the `static` and `test` CI jobs

**What to build:** The pnpm workspace on Vite+ with the final toolchain, and a first PR whose `static` and `test` CI jobs are real and green. Only `@fb/core` exists, as a shell with empty `definition`, `answers` and `editing` exports. The other workspaces arrive in the later phase 0 tickets, and each adds its own checks to the same pipeline.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [Vite+ toolchain](../../form-builder-mvp/issues/01-vite-plus-toolchain-for-a-pnpm-monorepo.md), [How the chosen stack fits together](../../form-builder-mvp/issues/07-how-the-chosen-stack-fits-together.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md), [CI pipeline](../../form-builder-mvp/issues/17-ci-pipeline.md) as amended by [Repository hosting and visibility](../../form-builder-mvp/issues/29-repository-hosting-and-visibility.md).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The work starts from the existing `origin/main` of `cluk3/formidabile`, and never runs `gh repo create`.
- [ ] `.gitignore`, with the list from CI pipeline, is committed on this first PR.
- [ ] `.node-version` pins `24.20.0`, `devEngines.packageManager` pins pnpm 12.14.0 with `onFail: download`, and a root Vite+ 1.3 config exists.
- [ ] The pnpm catalog pins exact versions as listed in the spec, including `effect` and `@effect/*` at 4.0.5, `drizzle-orm` and `drizzle-kit` at `1.0.0-rc.5-5935859`, and TypeScript 6.0.3 (not the `^7` the Vite+ templates default to).
- [ ] The base and server tsconfigs follow Package layout, including the Drizzle `SqlError` `paths` shim.
- [ ] Oxfmt (with Svelte formatting) and Oxlint run. The generated `openapi.json` and the client's generated schema types are in both tools' ignore patterns.
- [ ] Vitest's include excludes `e2e/`.
- [ ] `@fb/core` has its real name, entry points, `package.json` exports, `lib: ["ES2024"]` and `types: []`, and one trivial test so `vp test` runs.
- [ ] A packages README states the layout, the browser-safe list, and that root config files aren't public.
- [ ] The workflows have the `static` and `test` jobs exactly as in CI pipeline, with `setup-vp` pinned by SHA and `cache: true`, and `permissions: contents: read`. Dependabot covers `github-actions` only.
- [ ] A root `ready` task runs the same `vp run` task names CI runs.
- [ ] `vp run ready` is green locally, and both CI jobs are green on the PR.
