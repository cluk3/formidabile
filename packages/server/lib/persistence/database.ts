import { PgClient } from "@effect/sql-pg";
import * as PgDrizzle from "drizzle-orm/effect-postgres";
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core";
import { Cause, Context, Effect, Layer, Option, Redacted } from "effect";
import { SqlError } from "effect/sql";

export class Database extends Context.Service<Database, PgDrizzle.EffectPgDatabase>()(
  "@fb/server/Database",
) {}

/** Transaction options for a read whose queries must all see one snapshot. */
export const readOnlySnapshot = {
  isolationLevel: "repeatable read",
  accessMode: "read only",
} as const;

/** A use case's own failures stay typed; a database failure inside its transaction is a defect. */
export const dieOnDatabaseError = <A, E extends { readonly _tag: string }, R>(
  effect: Effect.Effect<A, E, R>,
) =>
  // `Effect.catchTag` can't check a tag list against a generic `E`, so the guard is written out.
  Effect.catchIf(
    effect,
    (error): error is Extract<E, { readonly _tag: "SqlError" | "EffectDrizzleQueryError" }> =>
      error._tag === "SqlError" || error._tag === "EffectDrizzleQueryError",
    Effect.die,
  );

/** Whether a query failed on the unique constraint or index named `constraint`, on either driver. */
export const isUniqueViolation = (error: unknown, constraint: string) => {
  const failure =
    error instanceof EffectDrizzleQueryError && Cause.isCause(error.cause)
      ? Option.getOrUndefined(Cause.findErrorOption(error.cause))
      : error;
  return (
    SqlError.isSqlError(failure) &&
    failure.reason._tag === "UniqueViolation" &&
    failure.reason.constraint === constraint
  );
};

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
