# Spike: CSP-safe styles for the `<form-renderer>` custom element

Asset for [Renderer styles under strict host CSPs](../issues/14-renderer-styles-under-strict-host-csps.md). Throwaway experiment in `/tmp/fr-csp-spike`, run on 2026-10-20. Nothing here is production code.

**Versions:** `vite-plus` 1.3.0 (Vite 8.3.4 with Rolldown, Vitest 5.0.5), `@sveltejs/vite-plugin-svelte` 7.3.1, `svelte` 5.57.2, `typescript` 6.0.3, `playwright` 1.62.0, `@vitest/browser-playwright` 5.0.5, pnpm 11.27.1, Node 24.20.0.

## Result

Constructable-stylesheet adoption works. Under `Content-Security-Policy: default-src 'self'; script-src 'self'`, the built element:

- renders fully styled in Chromium, Firefox and WebKit, with styles from the outer tree and from a nested component;
- has 1 adopted sheet, 0 `<style>` elements in the shadow root and 0 in `document.head`;
- produces 0 `securitypolicyviolation` events and 0 console errors;
- still picks up a host custom property (`--fr-color`) and `form-renderer::part(submit)`.

As a control, the default build (Svelte's `append_styles`) renders unstyled in all three browsers.

## Mechanism

- Only the wrapper (`lib/FormRendererElement.svelte`) is compiled with `customElement: true`, and it has no `<style>`.
- In `vp build`, inner components are compiled with `customElement: false, css: "external"` through vite-plugin-svelte's public `dynamicCompileOptions`.
- A ~25-line Vite plugin serves `virtual:form-renderer-css` as a placeholder string. In `generateBundle`, it deletes the emitted `.css` assets and substitutes their contents for the placeholder. It errors unless exactly one chunk contains the placeholder.
- The wrapper's `extend` hook builds one shared `CSSStyleSheet` (`replaceSync`) and sets `this.shadowRoot.adoptedStyleSheets` in the constructor.
- In dev and Vitest (`command !== "build"`), inner components use `css: "injected"`, so Svelte appends `<style>` into the shadow root, and the virtual module exports `""`.
- The custom wiring is about 49 non-blank lines: 25 in `vite.config.ts`, 20 in the wrapper and 4 in `env.d.ts`.

```ts
// packages/renderer/vite.config.ts (as run)
import { defineConfig } from "vite-plus";
import type { Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

const WRAPPER = /\/lib\/FormRendererElement\.svelte$/;
const VIRTUAL = "virtual:form-renderer-css";
const PLACEHOLDER = "__FORM_RENDERER_CSS__";

function elementCss(isBuild: boolean): Plugin {
  return {
    name: "form-renderer-css",
    enforce: "post",
    resolveId: (id) => (id === VIRTUAL ? "\0" + VIRTUAL : undefined),
    load: (id) =>
      id === "\0" + VIRTUAL ? `export default ${JSON.stringify(isBuild ? PLACEHOLDER : "")};` : undefined,
    generateBundle(_, bundle) {
      let css = "";
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type === "asset" && name.endsWith(".css")) {
          css += String(file.source);
          delete bundle[name];
        }
      }
      const hits = Object.values(bundle).filter((f) => f.type === "chunk" && f.code.includes(PLACEHOLDER));
      if (hits.length !== 1 || hits[0].type !== "chunk") this.error(`expected 1 chunk with ${PLACEHOLDER}`);
      const re = new RegExp(`(["'\`])${PLACEHOLDER}\\1`, "g");
      hits[0].code = hits[0].code.replace(re, () => JSON.stringify(css));
    },
  };
}

export default defineConfig(({ command }) => {
  const isBuild = command === "build";
  return {
    plugins: [
      svelte({
        compilerOptions: { customElement: true },
        dynamicCompileOptions: ({ filename }) =>
          WRAPPER.test(filename) ? undefined : { customElement: false, css: isBuild ? "external" : "injected" },
      }),
      elementCss(isBuild),
    ],
    build: {
      lib: { entry: "element.ts", formats: ["es"], fileName: "form-renderer" },
      rolldownOptions: { output: { minify: true } },
    },
  };
});
```

```svelte
<!-- lib/FormRendererElement.svelte (as run) -->
<svelte:options
  customElement={{
    tag: "form-renderer",
    shadow: "open",
    props: {
      formId: { attribute: "form-id", type: "String" },
      title: { attribute: "title", type: "String" },
      accent: { attribute: "accent", type: "String" },
    },
    extend: (ce) =>
      class extends ce {
        constructor() {
          super();
          if (css) this.shadowRoot!.adoptedStyleSheets = [sheet()];
        }
      },
  }}
/>

<script module lang="ts">
  import css from "virtual:form-renderer-css";

  let shared: CSSStyleSheet | undefined;
  function sheet() {
    if (!shared) {
      shared = new CSSStyleSheet();
      shared.replaceSync(css);
    }
    return shared;
  }
</script>

<script lang="ts">
  import FormRenderer from "./FormRenderer.svelte";

  let { formId = "", title = "Untitled", accent = "rgb(0, 128, 0)" } = $props();
</script>

<FormRenderer
  {formId}
  {title}
  {accent}
  onsubmitted={(d) =>
    $host().dispatchEvent(new CustomEvent("form-submitted", { detail: d, bubbles: true, composed: true }))}
/>
```

## Size

| Build | Raw | gzip -9 |
|---|---|---|
| Adopted stylesheet | 45,124 B | 17,064 B |
| Default (`append_styles`) | 45,939 B | 17,242 B |

The adopted build is smaller because the `append_styles` runtime drops out.

## Consumption from source

A separate app with a default `svelte()` config, importing `{ FormRenderer }` from source, styles correctly in both `vp dev` and `vp build` + `vp preview` across all three browsers. The renderer's `vite.config.ts` isn't read by consumers, so the per-file options stay confined to the element build.

## Inline styles under the strict CSP

| Variant | How Svelte applies it | Chromium | Firefox | WebKit |
|---|---|---|---|---|
| Static `style="color: red"` | Part of the template HTML (`template.innerHTML`) | `style-src-attr` violation, style still applies | `style-src-attr` violation, attribute **stripped** | No violation, applies |
| Dynamic `style="color: {c}"` | `dom.style.cssText` (CSSOM) | OK | OK | OK |
| `style:color={c}` | `style.setProperty` (CSSOM) | OK | OK | OK |
| `transition:fade` | `Element.animate` (Web Animations API) | OK | OK | OK |

## Trusted Types

Svelte 5.57.2 creates its own pass-through policy named `svelte-trusted-html` when the module is imported (`internal/client/dom/reconciler.js`). The name is fixed, and there's no hook to supply your own policy.

| Added to the strict CSP alongside `require-trusted-types-for 'script'` | Result (same in all three browsers) |
|---|---|
| No `trusted-types` directive | Renders styled, 0 violations |
| `trusted-types svelte-trusted-html` | Renders styled, 0 violations |
| `trusted-types host-app` (allowlist without Svelte's name) | **Never renders**: `createPolicy` throws when the module loads, so `form-renderer` is never defined |
| `trusted-types 'none'` | **Never renders**, same error |

## Gotchas

- Dev and Vitest-from-source never exercise the adopted path. Only a test against the built bundle covers it (a Vitest browser test of `dist/form-renderer.js` passed in all three browsers with `adopted: 1, styleEls: 0`). That test needs `vp build` first.
- Using the build options in dev silently renders unstyled: Vite puts the extracted CSS in `document.head`, outside the shadow root.
- CSP can't be tested in dev.
- Rolldown's minifier dropped the `if (css)` guard because it saw the placeholder as truthy. That's harmless, but it shows the minifier reasons about the placeholder's value.

## Fragility

- **Stable:** `dynamicCompileOptions`, `css: "external"` and `extend` are public, documented options.
- **Fails loudly:** the plugin assumes library mode emits `.css` assets visible in `generateBundle` and that the placeholder survives minification as a string literal. If either breaks, the build errors.
- **Undocumented Svelte internal:** Svelte calls `attachShadow` in the `SvelteElement` constructor, before the `extend` subclass's constructor body runs. If that moves, `this.shadowRoot` is null.
- **Browser- and Svelte-dependent:** whether a static `style=""` attribute triggers a violation depends on how Svelte builds templates.
- **Deletable:** if Svelte ships constructable stylesheets ([sveltejs/svelte#8988](https://github.com/sveltejs/svelte/issues/8988)), the wiring can be removed.

## Not verified

- HMR when editing CSS in dev.
- svelte-check and `vp check` on this config.
- `:global()` styles in inner components.
- Two Svelte bundles on one page under a `trusted-types` allowlist without `'allow-duplicates'`. By the Trusted Types rules, the second `createPolicy` call should throw.
