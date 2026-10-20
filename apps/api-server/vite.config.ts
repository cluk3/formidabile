import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      dev: {
        command: "node --conditions=source --watch main.ts",
        dependsOn: ["formidabile#postgres"],
        cache: false,
      },
    },
  },
});
