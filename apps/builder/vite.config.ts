import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defaultClientConditions, defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the app, but not for dependencies.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      // A single-page app: every route falls back to `index.html`, and `+layout.ts` turns SSR off.
      adapter: adapter({ fallback: "index.html" }),
    }),
  ],
  // `resolve.conditions` replaces Vite's defaults, so the defaults are spread after `source`.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  preview: { port: 4174, strictPort: true },
  test: {
    name: "builder-browser",
    include: ["tests/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  run: {
    tasks: {
      // The build writes `.svelte-kit/` and `build/`, so neither counts as an input.
      build: {
        command: "vp build",
        cache: { input: [{ auto: true }, "!.svelte-kit/**", "!build/**"], output: ["build/**"] },
      },
      preview: { command: "vp preview", dependsOn: ["build"], cache: false },
      // `svelte-kit sync` rewrites `.svelte-kit/`, which would make the task miss the cache every time.
      "check:svelte": {
        command: "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
        cache: { input: [{ auto: true }, "!.svelte-kit/**"], output: [] },
      },
    },
  },
});
