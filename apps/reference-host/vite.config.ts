import { defaultClientConditions, defineConfig } from "vite-plus";
import { databaseUrl } from "./server/database-url.ts";
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
      // Published forms can't be deleted, so a reset drops the module's schema (DDL, which no row trigger blocks).
      // The seed then migrates it again and seeds it through the API.
      "seed:reset": {
        command: `docker compose exec -T postgres psql "${databaseUrl}" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS form_management CASCADE" && node seed/main.ts`,
        dependsOn: ["formidabile#postgres"],
        cache: false,
      },
    },
  },
});
