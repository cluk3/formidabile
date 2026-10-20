import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      openapi: "node scripts/openapi.ts",
    },
  },
});
