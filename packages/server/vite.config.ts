import { defineConfig } from "vite-plus";

export default defineConfig({
  run: {
    tasks: {
      "check:migrations": "drizzle-kit check",
    },
  },
});
