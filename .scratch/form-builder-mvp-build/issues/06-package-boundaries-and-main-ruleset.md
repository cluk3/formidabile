# 06: Package boundaries and the `main` ruleset

**What to build:** The dependency rules that keep the deep modules honest, each one proven to fire, and the `main` ruleset that makes a PR and all four CI jobs mandatory. This closes phase 0: every check the spec names runs against real, if empty, artifacts.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup) (Boundaries, Repo, Exit); [Package layout](../../form-builder-mvp/issues/11-package-layout.md), [CI pipeline](../../form-builder-mvp/issues/17-ci-pipeline.md), [Repository hosting and visibility](../../form-builder-mvp/issues/29-repository-hosting-and-visibility.md).

**Blocked by:** 03 (Server shell on Postgres and PGlite), 04 (Renderer element under a strict CSP), 05 (Builder SPA shell).

**Status:** ready-for-agent

- [ ] The dependency-cruiser config has the full browser-safe list, the full dependency matrix, the deep-import rule, the `*.config.ts` import ban, and `no-circular` scoped to exclude `components/ui/`.
- [ ] A committed fixture tree holds one violation per rule family, and a test asserts each fails with its rule name.
- [ ] Oxlint's `no-restricted-imports` backstops type-only deep imports in `.svelte` files, which dependency-cruiser misses. shadcn-svelte's `components/ui/**` is ignored in lint.
- [ ] The manual pass, fail, pass sequence from `setup-ts-deep-modules` is done once and noted on the PR.
- [ ] The packages README states the final layout and the browser-safe list.
- [ ] Once all four jobs (`static`, `test`, `test-pg`, `e2e`) have reported on this PR, the `main` ruleset is created with `gh api`. It requires a PR and all four jobs, forbids force-pushes and deleting `main`, and has no bypass list.
- [ ] `vp run ready` is green locally, and all four CI jobs are green on the PR.
