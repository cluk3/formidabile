import { defaultClientConditions, defineConfig } from "vite-plus";
import { referenceHost } from "./server/plugin.ts";

export default defineConfig({
  plugins: [referenceHost()],
  // `resolve.conditions` replaces Vite's defaults, so the defaults are spread after `source`.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  // The preview page is served under a strict CSP, so no inline preload polyfill.
  build: { modulePreload: { polyfill: false } },
  preview: { port: 4173, strictPort: true },
  run: {
    tasks: {
      build: {
        command: "vp build",
        dependsOn: ["@fb/renderer#build"],
        cache: true,
      },
      preview: { command: "vp preview", dependsOn: ["build"], cache: false },
    },
  },
});
