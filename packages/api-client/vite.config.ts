import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      generate: {
        command: "openapi-typescript ../http-api/openapi.json --output lib/schema.d.ts",
        dependsOn: ["@fb/http-api#openapi"],
      },
    },
  },
});
