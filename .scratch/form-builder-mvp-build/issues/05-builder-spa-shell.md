# 05: Builder SPA shell in the e2e pipeline

**What to build:** `apps/builder` as a SvelteKit 3 static SPA shell that reads its runtime `config.json`, type-checked by `check:svelte` and loaded by a Playwright builder project in Chromium. The builder has no features yet.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md); [Svelte 5 with Vite+](../../form-builder-mvp/issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md).

**Blocked by:** 04 (Renderer element under a strict CSP in the reference host).

**Status:** ready-for-agent

- [x] SvelteKit 3 is configured in the Vite config as a static SPA, with the `#lib` alias, Tailwind 4, and shadcn-svelte initialised.
- [x] The app reads the runtime `config.json` at startup.
- [x] `check:svelte` covers the builder.
- [x] The root Playwright project gains a builder project in Chromium, running against `vp preview` of the builder, with one test that the shell loads.
- [x] `vp run ready` is green locally, and every CI job is green on the PR.

## Comments

**2026-10-21, implementing agent:** Built on branch `05-builder-spa-shell`. `vp run ready` is green locally. The last box stays open until the PR's CI jobs report. Notes for later tickets:

- `shadcn-svelte init` has no non-interactive path without a preset code, so it ran through a pty with defaults (style `vega`, base colour `neutral`). The CLI wired `cn` as a catalog dependency. No component is added yet, so `src/lib/components/ui/` doesn't exist. A trial `button` built and type-checked through the `#lib/*.js` imports, then was removed.
- `imports["#lib/*"]` lists extension fallbacks because the generated components import `#lib/utils.js` while the file is `utils.ts`.
- The builder serves on port 4174 and its `config.json` points at the reference host on 4173. `/token` and `/login` don't exist there until phase 1.
- `bits-ui` is a builder dependency for the components `shadcn-svelte add` will write, and `runed>@sveltejs/kit` is allowed in `peerDependencyRules` for its optional Kit 2 peer.
- No unit test: the only seam the ticket names is the Playwright shell test, which proves the config is fetched and shown. No Skill tool or sub-agents here, so `code-review` was done by hand.
