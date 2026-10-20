import { fileURLToPath } from "node:url";
import { migrate as drizzleMigrate } from "drizzle-orm/effect-postgres/migrator";
import { Effect } from "effect";
import { Database } from "./database.ts";
import { formManagement } from "./schema.ts";

const migrationsFolder = fileURLToPath(new URL("migrations", import.meta.url));

export const migrate = Database.use((db) =>
  drizzleMigrate(db, { migrationsFolder, migrationsSchema: formManagement.schemaName }),
).pipe(Effect.asVoid, Effect.withSpan("migrate"));
