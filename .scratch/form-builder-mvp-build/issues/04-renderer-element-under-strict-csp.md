# 04: Renderer element under a strict CSP in the reference host

**What to build:** `@fb/renderer` as a placeholder component tree shipped in both of its outputs, mounted as `<form-renderer>` on a reference host page served under a strict CSP, with the `e2e` CI job real and green. This proves ADR 0008's build mechanism in three browsers before any real renderer exists, and settles the points [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md) left unverified.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md), [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md); [Svelte 5 with Vite+](../../form-builder-mvp/issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), [Renderer styles under strict host CSPs](../../form-builder-mvp/issues/14-renderer-styles-under-strict-host-csps.md), [Strict-CSP scope for the renderer element](../../form-builder-mvp/issues/28-strict-csp-scope-for-the-renderer-element.md), [CI pipeline](../../form-builder-mvp/issues/17-ci-pipeline.md).

**Blocked by:** 02 (HTTP API and generated client shells, with the drift check).

**Status:** ready-for-agent

- [x] The renderer has both entry points: the component consumed from source, and the element built to `dist/form-renderer.js`. The element wrapper is listed in `sideEffects`, Rolldown's `output.minify` is on, and the constructable-stylesheet Vite plugin carries the wrapper's `extend` hook.
- [x] `check:svelte` covers the renderer.
- [x] Vitest browser mode runs in Chromium, and the renderer's Vitest test against the built bundle passes.
- [x] The reference host has a page mounting the placeholder element. Its server-side Vite plugin, on both `configureServer` and `configurePreviewServer`, serves `/api/*` through `@remix-run/node-fetch-server` into the stub handler, using `createRequest` and `sendResponse` inside the middleware so other paths fall through to `next()`. It also serves the strict CSP in `vp preview`.
- [x] Wherever source consumption runs in the browser, `resolve.conditions` puts `source` before a spread of `defaultClientConditions`.
- [x] The root `e2e/` Playwright project has a renderer project in Chromium, Firefox and WebKit, running against `vp preview` of the reference host.
- [x] The three-browser strict-CSP Playwright test passes on the placeholder.
- [x] The packages README records the outcome of the unverified points: svelte-check and `vp check` on the per-file config, `:global()` styles in inner components, and CSS hot reload in dev.
- [x] The `e2e` CI job runs with the Playwright browser cache.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `04-renderer-element-under-strict-csp`. `vp run ready` is green locally, with the strict-CSP test passing in Chromium, Firefox and WebKit. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- The renderer's bundle test imports `../dist/form-renderer.js` by path, because Vite can't resolve a package's reference to itself. The root `test` task depends on `@fb/renderer#build`, and the renderer is its own Vitest project (node and Chromium browser) under the root `test.projects`.
- The CI `e2e` job starts Postgres as the CI pipeline ticket asks, but nothing in ticket 04 connects to it yet. The stub handler's database runtime is lazy. Ticket 15 is the first to need it.
- The stub handler gets `/api/...` paths unchanged, so the client's `baseUrl` prefix handling is a phase 1 decision.
- The three unverified points are recorded in `packages/README.md`: `svelte-check` and `vp check` are clean, `:global()` works, and CSS hot reload works in the renderer's own dev server. The reference host loads the built element, so CSS changes there need `vp build --watch` in the renderer.
- No `code-review` skill run: this client has no Skill tool or sub-agents, so I reviewed the diff by hand.
