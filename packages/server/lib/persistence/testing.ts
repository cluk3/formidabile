import { PgClient } from "@effect/sql-pg";
import { PgliteClient } from "@effect/sql-pglite";
import * as PgliteDrizzle from "drizzle-orm/effect-pglite";
import { Effect, Layer, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { Database, DatabaseLive } from "./database.ts";
import { migrate } from "./migrate.ts";

const migrated = <ROut, E, RIn>(database: Layer.Layer<ROut, E, RIn>) =>
  Layer.effectDiscard(migrate).pipe(Layer.provideMerge(database));

export const DatabaseTest = migrated(
  Layer.effect(Database, PgliteDrizzle.makeWithDefaults()).pipe(
    Layer.provideMerge(PgliteClient.layer()),
  ),
);

// The immutability triggers forbid truncating, so every build gets a database of its own, dropped on release.
const freshDatabaseUrl = (serverUrl: string) => {
  const onServer = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
    effect.pipe(Effect.provide(PgClient.layer({ url: Redacted.make(serverUrl) })));
  return Effect.acquireRelease(
    SqlClient.SqlClient.use((sql) => {
      const name = `fb_test_${crypto.randomUUID().replaceAll("-", "")}`;
      return sql.unsafe(`CREATE DATABASE ${name}`).pipe(Effect.as(name));
    }).pipe(onServer),
    (name) =>
      SqlClient.SqlClient.use((sql) => sql.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)).pipe(
        onServer,
        Effect.orDie,
      ),
  ).pipe(
    Effect.map((name) => {
      const url = new URL(serverUrl);
      url.pathname = `/${name}`;
      return url.href;
    }),
  );
};

export const DatabaseTestPostgres = (serverUrl: string) =>
  Layer.unwrap(Effect.map(freshDatabaseUrl(serverUrl), (url) => migrated(DatabaseLive(url))));
