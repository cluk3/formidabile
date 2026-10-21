import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted } from "effect";

export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  "@fb/server/Database",
) {}

/** A use case's own failures stay typed; a database failure inside its transaction is a defect. */
export const dieOnDatabaseError = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  Effect.catchIf(
    effect,
    (error): error is Extract<E, { readonly _tag: "SqlError" | "EffectDrizzleQueryError" }> =>
      error._tag === "SqlError" || error._tag === "EffectDrizzleQueryError",
    Effect.die,
  );

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
