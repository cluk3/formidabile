# Svelte 5 with Vite+ and the deep-module toolchain

Researched 2026-10-19 against npm `latest` (versions below), the official Svelte, SvelteKit, Vite, Vite+ and Oxc docs, and package source. Experiments ran in a throwaway workspace at `/tmp/svp/ws` (Node 24.20.0, pnpm 12.14.0). It was created with `pnpm dlx create-vite-plus@1.3.0 vite:monorepo`, then `sv@1.1.1 create` (a `minimal` SvelteKit app and a `library`), then `vp migrate`, and then hand-reshaped into the deep-module layout: a `packages/renderer` Svelte package (root entry points `index.ts` and `element.ts`, components in `lib/`, tests in `tests/`) and an `apps/builder` SvelteKit static SPA that consumes it from source.

Each claim is marked **(experiment)** when it was observed in that workspace, or cites the document or source file it comes from.

## Summary

Svelte 5 fits the settled toolchain with one structural change: **SvelteKit 3** (released 2026-10-01) moved all project config into the `sveltekit()` Vite plugin, so there is no `svelte.config.js`. Its dependency floor (Vite 8, TypeScript 6, Node 22.17) matches Vite+ 1.3 and the TypeScript 6.0.3 pin.

**What works with Vite+:**
- `vp dev`, `vp build` and `vp test` work for both the SvelteKit app and a plain `@sveltejs/vite-plugin-svelte` package (experiment).
- Vitest 5 browser mode with `vitest-browser-svelte` works, and so does jsdom with `@testing-library/svelte` (experiment).
- shadcn-svelte 1.7, Bits UI 2.19 and Tailwind 4.3 work in the builder (experiment).

**Static checks need care.** `vp check` covers `.svelte` files only partly:
- Oxlint lints the `<script>` blocks.
- Oxfmt formats `.svelte` only when `fmt.svelte` is enabled and `svelte` is installed.
- tsgolint does not type-check `.svelte` files at all, and it types every `.svelte` import as a generic shim. That produces false errors on shadcn-svelte's generated `index.ts` files.

So **svelte-check stays** as the type checker for Svelte packages, run as a cached `vp run` task. ESLint and Prettier are not needed.

**dependency-cruiser 18.6 does see `.svelte` imports.** It compiles them with the project's `svelte/compiler`, so the deep-module rule bites inside components, with one hole: `import type` inside a `.svelte` file is erased before analysis.

**No library build is needed.** `vp pack` (tsdown) cannot build Svelte component libraries properly, and `svelte-package` is not needed: workspace consumers compile the renderer from source, and the custom element is a `vp build` library-mode bundle (experiment).

**The custom-element approach works.** One component tree compiles to both outputs, with nested-component styles, CSS custom properties, `::part()`, attribute and property mapping and composed host events all verified in Chromium (experiment). One limitation, and a risk for the embedding contract: Svelte injects `<style>` elements into the shadow root, and hosts with a strict `style-src` CSP block them (experiment).

## Current versions (npm `latest`, 2026-10-19)

Versions were observed with `npm view <pkg> version peerDependencies`.

| Package | Version | Relevant peers / engines |
| --- | --- | --- |
| `svelte` | 5.57.2 | `node >=18` |
| `@sveltejs/kit` | 3.1.0 | `vite ^8.0.12`, `svelte ^5.57.1`, `typescript ^6.0.0`, `@sveltejs/vite-plugin-svelte ^7.0.0`; `node >=22.17` |
| `@sveltejs/vite-plugin-svelte` | 7.3.1 | `vite ^8.0.0`, `svelte ^5.46.4` |
| `@sveltejs/adapter-static` | 4.0.0 | `@sveltejs/kit ^3.0.0-next.0` |
| `@sveltejs/package` | 3.0.1 | `typescript ^6.0.0`; `node >=22` |
| `svelte-check` | 4.7.7 | `typescript ^5 \|\| ^6` |
| `svelte2tsx` | 0.7.62 | `typescript ^4.9.4 \|\| ^5 \|\| ^6` |
| `vite-plus` | 1.3.0 | bundles Vite 8.3.4, Vitest 5.0.5, Oxlint 1.88.0, Oxfmt 0.73.0, tsdown 0.23.1 ([vite-plus-toolchain.md](./vite-plus-toolchain.md)) |
| `dependency-cruiser` | 18.6.0 | Svelte transpiler support `>=3.0.0 <6.0.0` ([`src/meta.cjs`](https://github.com/sverweij/dependency-cruiser/blob/v18.6.0/src/meta.cjs)) |
| `vitest-browser-svelte` | 3.1.0 | `vitest ^4 \|\| ^5`, `svelte ^3–5` |
| `@testing-library/svelte` | 5.4.2 | `vite *`, `vitest *` |
| `@vitest/browser-playwright` | 5.0.5 | `vitest 5.0.5`, `playwright *` |
| `shadcn-svelte` (CLI) | 1.7.0 | `svelte ^5` |
| `bits-ui` | 2.19.5 | `svelte ^5.33.0`; depends on `runed ^0.35.1` |
| `tailwindcss` / `@tailwindcss/vite` | 4.3.3 | `vite ^5.2 \|\| … \|\| ^8` |
| `sv` (Svelte CLI) | 1.1.1 | |
| `typescript` | 7.0.2 | TypeScript 7 is outside Kit 3's, `@sveltejs/package`'s and svelte-check's peer ranges |

**TypeScript 7 is unusable with Svelte today, not only with dependency-cruiser.** The TypeScript 6 pin is now required by three tools: SvelteKit 3, svelte-check and `@sveltejs/package`. The `sv` templates already write `typescript: ^6.0.3` (experiment).

## 1. Vite plugin, SvelteKit 3, `vp dev` and `vp build`

- **Kit 3 config lives in `vite.config.ts`.** "`svelte.config.js` is no longer supported." Options formerly under `kit.*` become top-level `sveltekit({...})` plugin options next to `compilerOptions` ([Migrating to SvelteKit v3](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)).
- **Other Kit 3 changes that touch phase 0** ([migration guide](https://svelte.dev/docs/kit/migrating-to-sveltekit-3)):
  - `$lib` is replaced by a `#lib` subpath import that you declare in `package.json` `imports`.
  - `tsconfig.json` extends `$app/tsconfig`, which ships `isolatedModules` and `verbatimModuleSyntax`.
  - `$app/environment` is renamed `$app/env`, and `$app/stores` is removed.
  - Any `server` directory or filename segment is server-only.
- **vite-plugin-svelte 7 requires Vite 8** ([7.0.0 release](https://github.com/sveltejs/vite-plugin-svelte/releases/tag/%40sveltejs%2Fvite-plugin-svelte%407.0.0)). With Vite+'s catalog alias `vite: npm:@voidzero-dev/vite-plus-core@1.3.0` and its `vite@*` override, `pnpm peers check` reports no issues for Kit, the plugin or the adapter (experiment).
- **`vp migrate` handles the `sv` scaffold** (experiment). Run at the workspace root, it:
  - rewrote `vite`/`vitest` scripts to `vp dev`, `vp build` and `vp test`;
  - rewrote `vitest` and `@vitest/browser-playwright` imports to `vite-plus/test*` and changed `defineConfig` to come from `vite-plus`;
  - added `vitest: 5.0.5` and `@vitest/browser-playwright: 5.0.5` to the catalog, with a `vitest@*` override;
  - added `await` before `render()` and swapped `toHaveTextContent` for `toMatchTextContent`, which is the documented Vitest 5 change for `vitest-browser-svelte` ([viteplus.dev/guide/vitest-v5](https://viteplus.dev/guide/vitest-v5), shipped as `docs/guide/vitest-v5.md` in `vite-plus@1.3.0`);
  - inserted `clearMocks: false` and `sharedViteServer: false` compatibility settings, which can be removed in a new repo.
- **The builder works end to end** (experiment), with `sveltekit({ adapter: adapter({ fallback: "index.html" }) })` and `ssr = false` in the root `+layout.ts`:
  - `vp build` writes the static SPA to `build/`;
  - `vp dev` serves the page, and Chromium (Playwright) renders the renderer component imported from `packages/renderer` source with no failed requests.
- **Running `vp build` in a package prints a note.** It runs the built-in command rather than the package's `build` script ("use `vpr build` instead") (experiment), as the Vite+ run docs describe.
- **The "no Svelte config found … using default configuration" message is noise.** vite-plugin-svelte prints it in non-Kit packages; it's harmless because options are passed inline to `svelte({...})` (experiment).

## 2. Library builds: `vp pack` versus `svelte-package`

- **`vp pack` cannot build Svelte components** (experiment):
  - Plain `vp pack index.ts --dts` fails with `PARSE_ERROR … lib/FormRenderer.svelte` because tsdown has no `.svelte` loader.
  - `pack.plugins: [svelte()]` from `@sveltejs/vite-plugin-svelte` fails with `Cannot read properties of undefined (reading 'prebundleSvelteLibraries')`: the plugin depends on Vite's config hooks.
  - With the Rollup-only `rollup-plugin-svelte@7.2.3` (last published 2025-08), it builds, but the output is *precompiled client JS* rather than `.svelte` source. The generated `index.d.mts` also loses the component's type: it re-exports `FormRenderer` from the `.mjs` chunk, which has no declaration.
- **`svelte-package` (3.0.1) works but expects one input directory.** It is the documented way to ship Svelte component libraries ([Packaging](https://svelte.dev/docs/kit/packaging)). It preprocesses `.svelte` files, transpiles `.ts`, and emits `.svelte.d.ts` through svelte2tsx (experiment: `svelte-package -i lib` produced `FormRenderer.svelte.d.ts` typed as `Component<RendererProps>`). It packages one input directory (`-i`, default `src/lib`), which doesn't match a deep-module package whose public entry points sit at the package root. Since 3.0.0 it reads the Svelte config through `@sveltejs/load-config` and rewrites import aliases to relative paths ([3.0.0 release](https://github.com/sveltejs/kit/releases/tag/%40sveltejs%2Fpackage%403.0.0)).
- **Neither is needed for the MVP.** The Svelte component output is only consumed inside the workspace (builder preview), and npm distribution is out of scope (map, "Out of scope"). Consumers compile the renderer's `.svelte` source with their own plugin, so the renderer package has no build step for the component. The custom element is built with `vp build` in library mode (section 6). Add `svelte-package` only if the component is ever published.

## 3. Lint, format and type-check for `.svelte`

Experiment: a `.svelte` file and a `.ts` file, each with an unused variable, a `debugger` statement, a `string`-to-`number` type error and bad spacing.

| Tool | `.ts` | `.svelte` |
| --- | --- | --- |
| Oxlint (`vp lint`) | unused var, `no-debugger`, TS2322 | `no-debugger` only: no unused-var report and **no type error** |
| tsgolint type check (`vp check`) | TS2322 reported | not checked |
| Oxfmt (`vp fmt`), default | formatted | **skipped** ("Expected at least one target file") |
| Oxfmt with `fmt: { svelte: true }` | formatted | formatted (script, markup and attributes) |
| `svelte-check` | TS2322 | TS2322 |

- **Oxlint lints only the script blocks.** Oxlint supports "Framework files (`.vue`, `.svelte`, `.astro`) by linting only their `<script>` blocks" ([Oxlint](https://oxc.rs/docs/guide/usage/linter.html)). It does not lint template markup, so Svelte's own a11y and markup warnings come only from the Svelte compiler, which svelte-check reports.
- **Oxfmt formats `.svelte` through a bundled `prettier-plugin-svelte`.** It "requires the `svelte` package to be installed and the `svelte` option to be enabled" ([Oxfmt language support](https://oxc.rs/docs/guide/usage/formatter/language-support.html)). The `oxfmt@0.73.0` typings say `svelte` is "Options for `prettier-plugin-svelte` … Pass `true` or an object to enable `.svelte` file formatting … Oxfmt does NOT bundle [`svelte/compiler`]" (`oxfmt/dist/index.d.ts`). So no separate Prettier is needed; `vp migrate`'s formatting pass had left every `.svelte` file untouched because the option was off (experiment).
- **tsgolint types every `.svelte` import with Svelte's ambient shim.** `svelte/types/index.d.ts` declares `declare module '*.svelte' { const Comp: LegacyComponentType; … export default Comp; }` (svelte 5.57.2). Two observed consequences (experiment):
  - `FormRendererElement.element` in a `.ts` file fails with TS2339 (`Property 'element' does not exist on type 'LegacyComponentType'`), even though svelte-check accepts it.
  - shadcn-svelte's generated `ui/button/index.ts` re-exports `<script module>` named exports (`buttonVariants`, `ButtonProps`, and so on) from `./button.svelte`, and fails with five TS2614 errors. `lint.ignorePatterns: ["apps/builder/src/lib/components/ui/**"]` makes `vp check` pass.
- **svelte-check stays the authoritative type checker** for Svelte packages, and it checks their `.ts` files too. svelte-check 4.7.7 finds the Svelte config through `@sveltejs/load-config`, which resolves `vite.config.*` with Vite and reads the options of the `vite-plugin-sveltekit-setup` or `vite-plugin-svelte:config` plugin (`@sveltejs/load-config@0.2.3`, `dist/src/index.js`). Verified with a Vite+ `defineConfig`: setting `customElement: false` in the renderer's `vite.config.ts` made svelte-check emit `options_missing_custom_element` for the element wrapper, and `true` cleared it (experiment).
- **svelte-check runs as a cached `vp run` task** (experiment):
  - As a plain `package.json` script, the builder's `svelte-kit sync && svelte-check` is never cached ("not cached because it modified its inputs"), because `svelte-kit sync` rewrites `.svelte-kit/`.
  - Defined in the package's `vite.config.ts` as `run.tasks["check:svelte"]` with `cache: { input: [{ auto: true }, "!.svelte-kit/**"], output: [] }`, it hits the cache 3/3 on rerun, and misses on an edit to `+page.svelte`.
  - Task inputs and outputs can be overridden as described in the Vite+ docs ([automatic data tracking](https://viteplus.dev/guide/automatic-data-tracking), [run config](https://viteplus.dev/config/run)).
- **Not needed:**
  - **ESLint with `eslint-plugin-svelte` (3.23.1):** the compiler warnings (a11y, unused CSS, runes misuse) arrive through svelte-check, and Oxlint covers script logic.
  - **Prettier with `prettier-plugin-svelte` (4.1.1):** Oxfmt bundles it.

  Running ESLint would need a second lint pipeline with `svelte-eslint-parser`; this was not evaluated with Oxlint's alpha JS plugins.

## 4. dependency-cruiser 18.6 and the deep-module rule

- **It compiles `.svelte` files with the project's own `svelte/compiler`.** dependency-cruiser imports `svelte/compiler` lazily and, for Svelte ≥ 5, calls `compile(source, {})` directly (TypeScript is handled natively), retrying with `experimental.async` if needed ([`src/extract/transpile/svelte-wrap.mjs`](https://github.com/sverweij/dependency-cruiser/blob/v18.6.0/src/extract/transpile/svelte-wrap.mjs)). Its default scan extensions include `svelte` (`src/cli/normalize-cli-options.mjs`). With pnpm, `svelte` must be resolvable from the workspace root: here it is a root dev dependency, which Oxfmt's `svelte` option needs anyway.
- **The deep-module rule bites inside `.svelte` files** (experiment). This used the skill's config with `PACKAGES_ROOT = "packages"`, `.svelte` added to `enhancedResolveOptions.extensions`, and `conditionNames: ["source", "svelte", "import", "default"]`:
  - `packages/other/lib/Widget.svelte` importing `../../renderer/lib/Question.svelte` fails with `entrypoint-boundary-across-packages`.
  - `@fb/renderer` in `+page.svelte` resolves to `packages/renderer/index.ts` through the `source` condition.
  - `#lib/greet.ts` resolves as `aliased-subpath-import`.
  - `.svelte`-to-`.svelte` and `.svelte`-to-`.ts` edges all appear.
- **Hole: type-only imports in `.svelte` are invisible.** The Svelte compiler erases `import type`, so `tsPreCompilationDeps` can't apply. `import type { RendererProps } from "../../renderer/lib/types.ts"` in a `.svelte` file passed depcruise (experiment).
  - **Backstop:** Oxlint parses the script block with types intact. A root `no-restricted-imports` rule with patterns such as `"**/../*/lib/**"`, `"**/../*/tests/**"` and `"@fb/*/lib/**"` caught exactly that import in the `.svelte` file (experiment).
- **shadcn-svelte's generated components form cycles.** `ui/dialog/dialog-content.svelte` imports `* as Dialog from "./index.js"`, which re-exports `dialog-content.svelte`, and that trips `no-circular` (experiment). Scope the rule with `from: { pathNot: "^apps/builder/src/lib/components/ui/" }`.
- **Workspace imports are typed `undetermined`.** `@fb/renderer` resolves into the workspace rather than `node_modules`, so its dependency type is `undetermined` (experiment). This is harmless for the four boundary rules, which match on paths.

## 5. Consuming workspace Svelte packages from source

- **Use a `svelte` condition alongside the `source` condition.** Svelte libraries advertise themselves with a `svelte` export condition, and "Svelte-aware tooling sees the `svelte` condition and knows this is a Svelte component library" ([Packaging](https://svelte.dev/docs/kit/packaging)). For a source-consumed package, point `source`, `svelte` and `default` at the root entry file, for example `".": { "source": "./index.ts", "svelte": "./index.ts", "default": "./index.ts" }`. TypeScript and svelte-check then resolve it without `customConditions` because `default` matches (experiment). Keep `source` for consistency with the TypeScript packages.
- **Pitfall: `resolve.conditions` replaces Vite's defaults.** The option's default is `['module', 'browser', 'development|production']` (`defaultClientConditions`), and setting it overrides that ([Vite shared options](https://vite.dev/config/shared-options.html#resolve-conditions)). Writing only `["source"]`, as the [Vite+ findings](./vite-plus-toolchain.md) wrote it, drops `browser`. Svelte then resolves its server build, and the first browser test failed with `lifecycle_function_unavailable: mount(...) is not available on the server` (experiment). Use `["source", ...defaultClientConditions]` and `ssr.resolve.conditions: ["source", ...defaultServerConditions]`; `vite-plus` re-exports both constants (experiment).
- **Kit's `#lib` imports cover app-internal aliases.** Consumers need no other alias config (experiment).
- **The dev server serves workspace source.** Kit's `server.fs.allow` listing does not include `packages/`, but `vp dev` still serves the renderer's source through the workspace `node_modules` link; no `fs.allow` change was needed (experiment).

## 6. One component tree as a Svelte component and a custom element

**Pattern used (experiment):**

```
packages/renderer/
  index.ts                     export { default as FormRenderer } from "./lib/FormRenderer.svelte"
  element.ts                   import "./lib/FormRendererElement.svelte"   (defines <form-renderer>)
  lib/FormRenderer.svelte      the real tree (props + callback props, scoped <style>, part="…")
  lib/Question.svelte          nested component with its own <style>
  lib/FormRendererElement.svelte
      <svelte:options customElement={{ tag: "form-renderer", shadow: "open",
        props: { formId: { attribute: "form-id", type: "String" }, title: { attribute: "title", type: "String" } } }} />
      renders <FormRenderer … onsubmitted={(d) => $host().dispatchEvent(new CustomEvent("form-submitted", { detail: d, bubbles: true, composed: true }))} />
```

The renderer's own `vite.config.ts` compiles with `compilerOptions: { customElement: true }`, which also serves its tests. Its `vp build` uses library mode (`build.lib.entry: "element.ts"`, `formats: ["es"]`). The builder compiles the same `.svelte` files from source with its own options (`customElement` off), so in the builder the renderer's CSS is extracted into the app's CSS files like any component (experiment).

**Verified in Chromium through Vitest browser mode (experiment):**
- **Attributes and properties:** the `form-id` attribute maps to `formId`, and setting the `formId` property re-renders.
- **Styles:** styles from the nested `Question.svelte` land in the **shadow root**, not `document.head`. Svelte's `append_styles` appends a `<style>` to `anchor.getRootNode()` when that is a `ShadowRoot` ([`dom/css.js`](https://github.com/sveltejs/svelte/blob/svelte%405.57.2/packages/svelte/src/internal/client/dom/css.js)).
- **Theming:** a host-page `--fr-color` custom property reaches inside, and `form-renderer::part(submit)` styles a button rendered by the inner component.
- **Events:** the host-dispatched `form-submitted` event reaches `document`, with `target === <form-renderer>`.
- **Normal use:** a component compiled with `customElement: true` still renders normally through `vitest-browser-svelte` `render()`.

**Build output (experiment):**
- **Size:** `dist/form-renderer.js` is one self-contained ES module (Svelte runtime and CSS inlined, no imports). It's 38.2 kB (14.6 kB gzipped) for the toy tree, and 52.8 kB (19.0 kB gzipped) with `zod/mini` validation and `z.config({ jitless: true })`.
- **Minification:** library-mode `es` output isn't whitespace-minified by default; `build.minify` had no effect. Set `build.rolldownOptions.output.minify: true` (54.3 → 38.2 kB raw).
- **Pitfall, a silently empty bundle:** with `"sideEffects": ["**/*.css", "./element.ts"]`, the side-effect-only `import "./lib/FormRendererElement.svelte"` was tree-shaken. The bundle shrank to 0.19 kB, while tests still passed because Vitest doesn't tree-shake. List the wrapper `.svelte` in `sideEffects`, or have `element.ts` call `customElements.define(…, Wrapper.element)` explicitly (that form survived tree-shaking, but tsgolint flags `.element`; see section 3). Phase 0 needs a test against the built bundle.
- **Plain host page:** loaded with `<script type="module">` under `default-src 'self'; script-src 'self'`, the element rendered, validated with `zod/mini`, and dispatched `{ formId, answer }`.

**CSP limitation (experiment):** on that strict-CSP page, Chromium blocked both injected `<style>` elements ("Applying inline style violates … 'default-src 'self''"), so the element rendered unstyled.
- **Constructable stylesheets are not blocked.** `new CSSStyleSheet()` with `replaceSync()` and `shadowRoot.adoptedStyleSheets` applied under the same CSP in Chromium, Firefox and WebKit, while a `<style>` in the same shadow root was blocked in all three.
- **Svelte has no option for constructable stylesheets.** With `customElement: true`, the compiler ignores `css: "external"` and always emits `append_styles` (verified with `svelte/compiler` 5.57.2). Constructable-stylesheet support is an open feature request ([sveltejs/svelte#8988](https://github.com/sveltejs/svelte/issues/8988), with [#10837](https://github.com/sveltejs/svelte/issues/10837) closed as its duplicate).
- **Options:**
  - document that hosts need `style-src 'unsafe-inline'` (or a hash per stylesheet);
  - or compile inner components with `css: "external"` (custom element only on the wrapper, through `dynamicCompileOptions`) and adopt the extracted CSS in the wrapper's `extend` hook. That second option is custom build wiring and was not built here.

**Documented Svelte 5 custom-element limitations** ([Custom elements](https://svelte.dev/docs/svelte/custom-elements)):
- **Props:** list every prop explicitly, because `let props = $props()` without declarations exposes nothing. Attributes are strings unless `type` is set. Props whose names start with `on` are treated as event listeners, so name inputs and outputs accordingly (for example `form-submitted` and `credentials`, not `onSubmit`).
- **Lifecycle:** the inner component is created one tick after `connectedCallback`. Properties set earlier are buffered, but exported functions aren't callable until mount, so use `extend` if a method must exist earlier. Shadow DOM updates land on the next tick.
- **Styles:** they are encapsulated, so page CSS and `:global(...)` don't reach in. They are inlined as a JS string. SSR isn't suitable.
- **Context and slots:** context doesn't cross custom-element boundaries, and slotted content renders eagerly.
- **TypeScript in `extend`:** it is allowed only with `lang="ts"` and erasable syntax.
- **Form participation:** `ElementInternals` is available through `extend` (`static formAssociated = true`).

## 7. Testing with Vitest 5 under Vite+

- **Browser mode** ([viteplus.dev/guide/migrate](https://viteplus.dev/guide/migrate), "Vitest" section):
  - Install `@vitest/browser-playwright` at the bundled Vitest version plus `playwright`.
  - Import `playwright` from `vite-plus/test/browser-playwright`, and the browser context from `vite-plus/test/browser`.
  - Augmentations keep targeting `'vitest'` and `'@vitest/browser*'`.
- **Both component-test styles work** (experiment):
  - **Browser mode:** `vitest-browser-svelte@3.1.0` `await render(Component, props)` returns locators.
  - **jsdom:** `@testing-library/svelte@5.4.2` works in a jsdom project, which needs `resolve.conditions` to include `browser` so Svelte's client build loads (the Svelte docs show the same [`conditions: ['browser']`](https://svelte.dev/docs/svelte/testing) setting).
  - **Mixed:** one package can run both as Vitest `projects` with `extends: true`.
- **`vitest-browser-svelte` imports `vitest/browser` itself.** It shares one instance with `vite-plus/test/browser` because Vite+'s `vitest@*` override collapses both to 5.0.5 (experiment: tests pass and `pnpm peers check` is clean).
- **Use browser mode for the renderer.** It's the only one of the two where shadow DOM, `::part()`, computed styles and real focus behave like a browser, and the WCAG 2.2 AA gate in ADR 0003 needs those. Keep jsdom optional for fast logic-only component tests; prefer plain `.svelte.test.ts` unit tests for rune logic ([Svelte testing](https://svelte.dev/docs/svelte/testing)).
- **Pin `playwright` to the version whose browser builds are installed** (experiment):
  - `playwright@1.60.0` wanted `chromium_headless_shell-1223`, which wasn't installed.
  - The locally cached 1234 build matches `playwright@1.62.0` (from its `browsers.json`); `latest` is 1.64.1, which needs 1248.
  - Phase 0 should catalog one `playwright` version for Vitest browser mode and Playwright e2e, and install its browsers with `vp exec playwright install`.

## 8. Tailwind CSS 4, shadcn-svelte and Bits UI

- **Tailwind:** `sv create --add tailwindcss` wires `@tailwindcss/vite` before `sveltekit()` and writes `@import "tailwindcss"` to `src/routes/layout.css`. `vp build` emits the utilities, for example `.text-blue-700{color:var(--color-blue-700)}` and `.bg-primary{…}` (experiment).
- **shadcn-svelte CLI 1.7.0 is Kit 3-aware even though its docs aren't:**
  - The [SvelteKit install page](https://shadcn-svelte.com/docs/installation/sveltekit) still shows `svelte.config.js` aliases and `$lib`.
  - The CLI source detects `package.json` `imports["#lib/*"]` and defaults its aliases to `#lib/...`. Run through a pseudo-terminal with defaults, `init` wrote `components.json` with `#lib/components`, `#lib/utils`, `#lib/components/ui` and `#lib/hooks` (style `vega`, Lucide icons).
  - `init` rewrote `src/routes/layout.css` with theme variables and imports from `tw-animate-css`, `shadcn-svelte/tailwind.css` and `@fontsource-variable/inter`, and added `@lucide/svelte`, `cn`, `tailwind-variants` and `shadcn-svelte` as dev dependencies.
  - `add button dialog select` installed the components plus `separator`.
  - `init` needs either an interactive prompt or a `--preset <code>` from shadcn-svelte.com/create; style names such as `nova` are rejected.

  (All experiment.)
- **The components work in the builder** (experiment). With `bits-ui@2.19.5`, `tailwind-variants` and `@internationalized/date` added, a page using `Button`, `Dialog` (whose content hosts the renderer component) and `Select`:
  - passes svelte-check with `--fail-on-warnings`;
  - passes a browser test that opens the dialog and finds the renderer's heading;
  - builds with `vp build`.
- **Peer warning:** Bits UI → `runed@0.35.1` declares an optional peer `@sveltejs/kit ^2.21.0`, so pnpm warns "unmet peer @sveltejs/kit". runed's latest (0.37.1, 2025-12) still declares `^2.21.0`. Only `runed/kit` imports SvelteKit, and it uses the Kit 2 module `$app/environment`, which Kit 3 renamed; Bits UI never imports `runed/kit` (experiment: no match in `bits-ui/dist`). The warning is cosmetic; silence it with `peerDependencyRules.allowedVersions` (`"runed>@sveltejs/kit": "3"`).
- **Keep the renderer free of Tailwind and shadcn-svelte.** ADR 0003 already says so, and two findings support it. First, shadow DOM blocks page CSS. Second, Tailwind 4 relies on `@property`, which doesn't register inside shadow roots ([tailwindlabs/tailwindcss#15005](https://github.com/tailwindlabs/tailwindcss/issues/15005), open).

## Open risks

- **Strict-CSP hosts get an unstyled custom element**, unless they allow inline styles or the renderer adopts constructable stylesheets through custom build wiring (section 6). This affects the embedding contract and the reference host's CSP, and should be decided in the renderer or reference-host plan.
- **Type checking is split.** `vp check` (tsgolint) covers `.ts` packages, while svelte-check covers Svelte packages, `.ts` included. tsgolint's view of `.svelte` imports is the untyped shim, so code that `.ts` files import from `.svelte` modules must not rely on named `<script module>` exports. Keep shared types and helpers in `.ts` files.
- **SvelteKit 3 is 18 days old.** Third-party docs and libraries, such as the shadcn-svelte docs and runed's peer range, still assume Kit 2. Expect small breakages and pin exact versions.
- **The TypeScript 6 pin is now load-bearing for Svelte** (Kit 3, svelte-check and `@sveltejs/package` all peer on `^6`), not only for dependency-cruiser. A Vite+ upgrade or `vp migrate` that writes `typescript ^7` will break `svelte-kit sync` and svelte-check.
- **Not verified:**
  - Firefox and WebKit for the full component tests: only the constructable-stylesheet probe ran in all three engines.
  - `vp run` caching of `vp build` for the element bundle across workspace packages.
  - Oxlint JS plugins with `eslint-plugin-svelte`.

## What phase 0 must do

1. **Catalog exact versions** in `pnpm-workspace.yaml`, keeping Vite+'s `vite`/`vitest` aliases, overrides and peer rules: `svelte 5.57.2`, `@sveltejs/kit 3.1.0`, `@sveltejs/vite-plugin-svelte 7.3.1`, `@sveltejs/adapter-static 4.0.0`, `svelte-check 4.7.7`, `tailwindcss` and `@tailwindcss/vite 4.3.3`, `bits-ui 2.19.5`, `vitest-browser-svelte 3.1.0`, `@vitest/browser-playwright 5.0.5`, one `playwright` version, `typescript 6.0.3` and `dependency-cruiser 18.6.0`. Add `svelte` as a root dev dependency, because dependency-cruiser and Oxfmt load `svelte/compiler` from the root. Allow `runed>@sveltejs/kit: 3` in `peerDependencyRules`.
2. **Scaffold the builder** with `sv create --template minimal --types ts --add tailwindcss sveltekit-adapter="adapter:static"`, then run `vp migrate` once at the root:
   - set `ssr = false` and `adapter({ fallback: "index.html" })`;
   - put Kit config in `sveltekit({...})` in `vite.config.ts` (there is no `svelte.config.js`);
   - use `#lib` subpath imports and a `tsconfig.json` that extends `$app/tsconfig`;
   - remove the migration's Vitest 4 compatibility settings.
3. **Initialise shadcn-svelte** with the `#lib` aliases. Treat `apps/builder/src/lib/components/ui/**` as vendored: add it to `lint.ignorePatterns` and exclude it from `no-circular`.
4. **Lay out the renderer as a deep-module package without a build step for the component:**
   - root entry points `index.ts` (the Svelte component) and `element.ts` (defines `<form-renderer>`), with `lib/` and `tests/`;
   - `exports` with `source`, `svelte` and `default` pointing at the entry files, and `./element` pointing to `dist/form-renderer.js` for the bundle;
   - list the custom-element wrapper `.svelte` file in `sideEffects`;
   - no `vp pack` and no `svelte-package`.
5. **Build the element** with `vp build` in library mode (`entry: "element.ts"`, `formats: ["es"]`, `rolldownOptions.output.minify: true`) and `compilerOptions.customElement: true`. Add a test against the built `dist` file (for example from the reference host's Playwright e2e) so tree-shaking or CSS regressions can't pass silently.
6. **Fix the `source` condition wiring** for every Vite consumer: `resolve.conditions: ["source", ...defaultClientConditions]` and `ssr.resolve.conditions: ["source", ...defaultServerConditions]`, both constants imported from `vite-plus`. This corrects the plain `["source"]` from the Vite+ findings.
7. **Turn on Svelte formatting and lint backstops** in the root `vite.config.ts`: `fmt: { svelte: true }`, plus a `no-restricted-imports` rule that blocks cross-package `lib/` and `tests/` paths, covering type-only imports that dependency-cruiser can't see in `.svelte` files.
8. **Add `check:svelte` as a `vite.config.ts` task** in each Svelte package: `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings` for the builder and plain `svelte-check …` for the renderer, with `cache.input: [{ auto: true }, "!.svelte-kit/**"]`. Make it part of the root `ready` or CI command next to `vp check` and depcruise.
9. **Extend `.dependency-cruiser.cjs`** with `PACKAGES_ROOT = "packages"`, `.svelte` in `enhancedResolveOptions.extensions`, `conditionNames: ["source", "svelte", "import", "default"]` and `tsPreCompilationDeps: true`. Then run the skill's step 6 bite test, with one of the deep imports placed inside a `.svelte` file.
10. **Set up component tests:**
    - Vitest browser mode (Playwright Chromium) with `vitest-browser-svelte` for the renderer and the builder. Use `await render(...)` and imports from `vite-plus/test` and `vite-plus/test/browser*`.
    - Keep `*.svelte.test.ts` and `*.browser.test.ts` out of the e2e `include`, and keep e2e out of Vitest's.
    - Install browsers with `vp exec playwright install` for the cataloged `playwright` version.
11. **Record the CSP decision for the custom element** in the renderer plan, choosing between documenting `style-src 'unsafe-inline'` for hosts and building constructable-stylesheet adoption. Also keep `z.config({ jitless: true })` in `element.ts`.
