import { DatabaseLive } from "@fb/server/database";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { SqlClient } from "effect/sql";
import { expect, test } from "vite-plus/test";
import { ServerLive } from "../server.ts";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

// A database of its own, so the startup migration runs against an empty one.
const freshDatabaseUrl = Effect.acquireRelease(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const name = `api_server_smoke_${crypto.randomUUID().replaceAll("-", "")}`;
    yield* sql.unsafe(`CREATE DATABASE ${name}`);
    const url = new URL(databaseUrl);
    url.pathname = `/${name}`;
    return { name, url: url.href };
  }),
  ({ name }) =>
    SqlClient.SqlClient.use((sql) => sql.unsafe(`DROP DATABASE ${name} WITH (FORCE)`)).pipe(
      Effect.orDie,
    ),
);

const probeRunningServer = Effect.gen(function* () {
  const { address } = yield* HttpServer.HttpServer;
  if (address._tag === "UnixPathAddress") throw new Error("expected an internet address");
  const response = yield* Effect.promise(() => fetch(`http://localhost:${address.port}/`));

  const sql = yield* SqlClient.SqlClient;
  const [migrations] = yield* sql<{ count: number }>`
    SELECT count(*)::int AS count FROM form_management.__drizzle_migrations
  `;
  const [setting] = yield* sql<{
    statement_timeout: string;
  }>`SHOW statement_timeout`;
  return {
    status: response.status,
    appliedMigrations: migrations?.count,
    statementTimeout: setting?.statement_timeout,
  };
});

test("the server migrates at startup, answers HTTP, and its connections time statements out at 30 s", async () => {
  const started = await Effect.runPromise(
    Effect.gen(function* () {
      const { url } = yield* freshDatabaseUrl;
      return yield* probeRunningServer.pipe(
        Effect.provide(ServerLive({ port: 0 }).pipe(Layer.provideMerge(DatabaseLive(url)))),
      );
    }).pipe(Effect.scoped, Effect.provide(DatabaseLive(databaseUrl))),
  );

  expect(started.status).toBe(404);
  expect(started.appliedMigrations).toBeGreaterThan(0);
  expect(started.statementTimeout).toBe("30s");
});
