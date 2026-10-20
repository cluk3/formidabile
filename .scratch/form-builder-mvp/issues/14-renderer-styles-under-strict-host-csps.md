# Renderer styles under strict host CSPs

Type: grilling
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

Svelte compiles the `<form-renderer>` custom element so that it injects `<style>` elements into its shadow root. A host whose Content Security Policy has a strict `style-src` blocks them, and the element renders unstyled ([Svelte 5 with Vite+ and the deep-module toolchain](./13-svelte-5-with-vite-plus-and-the-deep-module-toolchain.md), section 6 of the findings). Constructable stylesheets (`adoptedStyleSheets`) aren't blocked, but Svelte can't emit them for custom elements ([sveltejs/svelte#8988](https://github.com/sveltejs/svelte/issues/8988)).

Decide:

- Whether the MVP documents a host requirement (`style-src 'unsafe-inline'`, or a hash for each stylesheet), or builds constructable-stylesheet adoption: inner components compiled with `css: "external"` and the extracted CSS adopted in the wrapper's `extend` hook.
- What CSP the reference host serves, and whether a Playwright test proves the element renders styled under it. The script side is already covered by `z.config({ jitless: true })` ([Zod 4 alongside Effect Schema](./04-zod-4-alongside-effect-schema.md)).
- Where the host-facing CSP requirements are documented as part of the embedding contract ([Frontend framework and renderer embedding strategy](./06-frontend-framework-and-renderer-embedding-strategy.md)).

## Answer

Recorded as [ADR 0008](../../../docs/adr/0008-renderer-element-adopts-constructable-stylesheets.md). The mechanism was verified in a throwaway spike: [findings](../research/renderer-csp-styles-spike.md).

- **Guarantee**: `<form-renderer>` works under a strict host CSP. That means no `'unsafe-inline'` or `'unsafe-eval'` anywhere and no style hashes or nonces. The host application only allows the bundle's script origin and the API origin. Requiring `'unsafe-inline'` and publishing per-release style hashes were both rejected.
- **Mechanism**: constructable-stylesheet adoption, as built in the spike.
  - Only the wrapper (`lib/FormRendererElement.svelte`) is compiled with `customElement: true`, and it has no `<style>`.
  - In `vp build`, inner components get `customElement: false, css: "external"` through vite-plugin-svelte's `dynamicCompileOptions`.
  - A ~25-line Vite plugin in `packages/renderer/vite.config.ts` serves `virtual:form-renderer-css` as a placeholder. In `generateBundle`, it deletes the emitted `.css` assets and substitutes their contents for the placeholder. It errors unless exactly one chunk contains the placeholder, so the bundle stays one self-contained ES module.
  - The wrapper's `extend` constructor builds one shared `CSSStyleSheet` (`replaceSync`) and sets `shadowRoot.adoptedStyleSheets`. If `this.shadowRoot` is missing, it throws a named error instead of using a `!` assertion. This guards the one undocumented Svelte internal the wiring depends on: `attachShadow` runs in the `SvelteElement` constructor.
  - In dev and Vitest (`command !== "build"`), inner components use `css: "injected"`, and the virtual module exports `""`.
  - The bundle came out slightly smaller than the default build (17.06 kB against 17.24 kB gzipped in the spike).
  - The wiring can be deleted once Svelte ships constructable stylesheets.
- **Inline styles**: static `style="…"` attributes are banned in `packages/renderer/lib/**/*.svelte`. Firefox strips them under a strict CSP, and Chromium reports a violation. A Vitest test parses each file with `svelte/compiler` and fails on any `style` attribute with a plain-text value. Dynamic `style="…{x}"`, `style:` directives and Svelte transitions stay allowed, because they go through CSSOM and the Web Animations API.
- **Trusted Types**: supported. Svelte creates a fixed pass-through policy, `svelte-trusted-html`, when the module loads. A host application that enforces `require-trusted-types-for 'script'` with a `trusted-types` allowlist must allow that name. A host application that also runs its own Svelte 5 bundle needs `'allow-duplicates'`, which follows from the Trusted Types rules but wasn't verified.
- **Reference host**: its Vite plugin sets an enforced `Content-Security-Policy` header on every `configurePreviewServer` response, and none in `vp dev` because the dev server injects CSS as `<style>` elements:

  ```
  default-src 'self'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types svelte-trusted-html
  ```

  The `/login` page must comply too, so no inline script or style. The builder's own CSP isn't covered here.

- **Tests**: production styles are only covered by tests against the built bundle. Dev and Vitest-from-source exercise the injected path.
  - **Playwright** (Chromium, Firefox and WebKit; the browser matrix for the other end-to-end tests belongs to [CI pipeline](./17-ci-pipeline.md)) loads the reference host's embed page under that header. It fails on any `securitypolicyviolation` event or CSP console error. It asserts a computed style from the outer tree and from a nested question component inside the shadow root, plus a host custom property and a `::part()` rule.
  - **Vitest browser mode** in `packages/renderer` imports `dist/form-renderer.js` and asserts one adopted sheet and zero `<style>` elements. Its task depends on the element build. This is also the guard against the empty bundle produced by tree-shaking.
- **Embedding contract**: one host-facing document at `docs/embedding.md`, written by the phased plan, not this map. It covers the tag, attributes and properties, events, `getToken`, theming through custom properties and `::part()`, and the CSP requirements. [HTTP API surface](./16-http-api-surface.md) adds the custom-renderer contract to the same file.
  - **Promise**: the element loads no fonts, images or other sub-resources, and makes requests only to its configured API base URL. Typography comes from the host application through inheritance and custom properties.
  - **What host applications need**: `script-src` allowing the bundle's origin, `connect-src` allowing the API origin, and the Trusted Types rule above. They need nothing in `style-src`, `img-src` or `font-src`, and no `'unsafe-eval'`, because the element sets `z.config({ jitless: true })`.
- **Not verified in the spike, for phase 0 to confirm**: svelte-check and `vp check` on the per-file config, `:global()` styles in inner components, and CSS hot reload in dev.

## Comments

- 2026-10-20: the readiness audit questioned this scope and its phase 0 cost. [Strict-CSP scope for the renderer element](./28-strict-csp-scope-for-the-renderer-element.md) kept the guarantee and its phase 0 timing unchanged.
