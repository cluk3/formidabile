import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Layer, Redacted } from "effect";

export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  "@fb/server/Database",
) {}

export const DatabaseLive = (databaseUrl: string) =>
  Layer.effect(Database, PgDrizzle.makeWithDefaults()).pipe(
    Layer.provideMerge(
      PgClient.layer({
        url: Redacted.make(databaseUrl),
        // ADR 0015: every connection the module opens, in either serving mode, has this timeout.
        startupParameters: { statement_timeout: "30s" },
      }),
    ),
  );
