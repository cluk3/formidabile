# 05: Builder SPA shell in the e2e pipeline

**What to build:** `apps/builder` as a SvelteKit 3 static SPA shell that reads its runtime `config.json`, type-checked by `check:svelte` and loaded by a Playwright builder project in Chromium. The builder has no features yet.

**Sources:** [Spec, phase 0](../../form-builder-mvp/spec.md#phase-0-repo-setup); [ADR 0003](../../../docs/adr/0003-svelte-renderer-with-two-outputs.md); [Svelte 5 with Vite+](../../form-builder-mvp/issues/13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), [Frontend framework and renderer embedding strategy](../../form-builder-mvp/issues/06-frontend-framework-and-renderer-embedding-strategy.md), [Package layout](../../form-builder-mvp/issues/11-package-layout.md).

**Blocked by:** 04 (Renderer element under a strict CSP in the reference host).

**Status:** ready-for-agent

- [ ] SvelteKit 3 is configured in the Vite config as a static SPA, with the `#lib` alias, Tailwind 4, and shadcn-svelte initialised.
- [ ] The app reads the runtime `config.json` at startup.
- [ ] `check:svelte` covers the builder.
- [ ] The root Playwright project gains a builder project in Chromium, running against `vp preview` of the builder, with one test that the shell loads.
- [ ] `vp run ready` is green locally, and every CI job is green on the PR.
