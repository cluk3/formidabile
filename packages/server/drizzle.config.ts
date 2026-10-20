import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/persistence/schema.ts",
  out: "./lib/persistence/migrations",
  migrations: { schema: "form_management" },
});
