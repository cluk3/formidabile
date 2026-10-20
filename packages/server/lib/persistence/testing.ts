import { PgliteClient } from "@effect/sql-pglite";
import * as PgliteDrizzle from "drizzle-orm/effect-pglite";
import { Layer } from "effect";
import { Database } from "./database.ts";
import { migrate } from "./migrate.ts";

export const DatabaseTest = Layer.effectDiscard(migrate).pipe(
  Layer.provideMerge(
    Layer.effect(Database, PgliteDrizzle.makeWithDefaults()).pipe(
      Layer.provideMerge(PgliteClient.layer()),
    ),
  ),
);
