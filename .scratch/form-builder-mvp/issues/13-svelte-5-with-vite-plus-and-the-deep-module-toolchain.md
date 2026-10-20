# Svelte 5 with Vite+ and the deep-module toolchain

Type: research
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

The builder (SvelteKit as a static single-page app) and the renderer (a Svelte 5 component tree that is also built as a self-contained custom element) were chosen in [Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md). The Vite+ research ([Vite+ toolchain for a pnpm monorepo](./01-vite-plus-toolchain-for-a-pnpm-monorepo.md)) only verified a React-style setup. How does Svelte 5 fit the settled toolchain, and what does phase 0 need to do about it?

Find out:

- Whether `@sveltejs/vite-plugin-svelte` and SvelteKit work with Vite+ 1.3 (Vite 8): `vp dev`, `vp build`, and building a Svelte library with `vp pack`, or whether `svelte-package` is needed.
- Whether Oxlint, Oxfmt and `vp check` handle `.svelte` files, or whether `svelte-check`, ESLint with `eslint-plugin-svelte`, or Prettier with `prettier-plugin-svelte` are still needed, and how those would run as Vite+ tasks.
- Whether dependency-cruiser 18.6 (with TypeScript 6.0.3 pinned) resolves imports in `.svelte` files, so the deep-module rule holds for Svelte packages.
- How workspace Svelte packages are consumed from source (the `source` export condition and the `svelte` export condition).
- How to build one component tree as both a normal Svelte component and a self-contained custom element (the `customElement` compiler option, `<svelte:options customElement>`, shadow DOM style injection, property and attribute mapping, dispatching events from the host element), and any Svelte 5 limitations of custom elements.
- How Svelte components are tested with Vitest 5 (browser mode, `vitest-browser-svelte`, or `@testing-library/svelte` with jsdom).
- Whether shadcn-svelte, Bits UI and Tailwind CSS 4 work in this setup.

## Answer

Svelte 5 fits Vite+ 1.3 as long as phase 0 adds svelte-check and adjusts a few config settings. Everything below was verified in a throwaway `/tmp` workspace (a deep-module renderer package plus a SvelteKit static SPA that consumes it from source), unless it cites docs. SvelteKit 3.1.0 (released 2026-10-01) needs Vite 8, TypeScript `^6` and Node 22.17, and has no `svelte.config.js`: Kit options go into `sveltekit({...})` in `vite.config.ts`, and `$lib` becomes a `#lib` subpath import. Kit 3, svelte-check and `@sveltejs/package` all peer on TypeScript `^6`, so the 6.0.3 pin is now needed by the Svelte tools as well as dependency-cruiser.

- **Build and dev:**
  - `vp dev`, `vp build` (adapter-static) and `vp test` work for the builder and for a plain `vite-plugin-svelte` package, and `vp migrate` converts an `sv` scaffold cleanly.
  - `vp pack` can't build Svelte libraries: tsdown can't parse `.svelte` and can't host `vite-plugin-svelte`. `svelte-package` works but isn't needed: the component is consumed from source, and the custom element is a `vp build` library-mode bundle.
- **Lint, format and types:**
  - Oxlint lints only `.svelte` `<script>` blocks.
  - Oxfmt formats `.svelte` once `fmt: { svelte: true }` is set and `svelte` is installed at the root.
  - tsgolint doesn't type-check `.svelte` files, and it types every `.svelte` import as an untyped shim. That gives false errors on shadcn-svelte's generated `index.ts`, so ignore `components/ui/**` in lint.
  - svelte-check (which reads Kit 3 config from `vite.config.ts`) stays the Svelte type checker, run as a cached `vite.config.ts` task with `.svelte-kit/**` excluded from its inputs. ESLint and Prettier aren't needed.
- **Deep modules:**
  - dependency-cruiser 18.6 compiles `.svelte` with the project's `svelte/compiler`, and the boundary rule fires on deep imports inside components.
  - `import type` in `.svelte` is erased before analysis. An Oxlint `no-restricted-imports` rule catches those imports.
  - shadcn-svelte's `dialog` folder forms a cycle, so scope `no-circular` to exclude `components/ui/`.
- **Source consumption:**
  - Point `source`, `svelte` and `default` at the root entry file.
  - `resolve.conditions` replaces Vite's defaults, so use `["source", ...defaultClientConditions]` (and the server variant for SSR). A bare `["source"]`, as written in the Vite+ findings, loads Svelte's server build in the browser.
- **Custom element:**
  - A thin `<svelte:options customElement>` wrapper around the shared tree, compiled with `customElement: true`, worked in Chromium: attribute and property mapping, nested-component styles inside the shadow root, CSS custom properties, `::part()`, and composed events dispatched from `$host()`.
  - The bundle is a single self-contained ES module: 38 kB (15 kB gzipped), or 19 kB gzipped with `zod/mini`. Turn on Rolldown `output.minify`.
  - List the wrapper in `sideEffects`, or it is silently tree-shaken out.
  - Svelte injects `<style>` elements, and strict `style-src` CSPs block them. Constructable stylesheets would avoid the block, but Svelte doesn't support them yet ([sveltejs/svelte#8988](https://github.com/sveltejs/svelte/issues/8988)).
- **Tests:**
  - Vitest 5 browser mode with `@vitest/browser-playwright` and `vitest-browser-svelte` (`await render`) works, and so does jsdom with `@testing-library/svelte` when `browser` is in the resolve conditions.
  - Pin one `playwright` version whose browsers are installed.
- **UI kit:**
  - Tailwind 4.3, shadcn-svelte CLI 1.7 (which detects `#lib` despite Kit 2-era docs) and Bits UI 2.19 work in the builder.
  - Bits UI's `runed` dependency still declares an optional peer of Kit `^2` (harmless). Keep Tailwind out of the shadow-DOM renderer.

[Findings](../research/svelte-5-with-vite-plus.md)
