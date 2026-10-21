import { migrate } from "@fb/server/migrate";
import { DatabaseTest } from "@fb/server/testing";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { expect, test } from "vite-plus/test";

const runOnTestDatabase = <A, E>(effect: Effect.Effect<A, E, Layer.Success<typeof DatabaseTest>>) =>
  Effect.runPromise(effect.pipe(Effect.provide(DatabaseTest)));

const appliedMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ count: number }>`
    SELECT count(*)::int AS count FROM form_management.__drizzle_migrations
  `;
  return row?.count;
});

test("the test database arrives migrated, and migrating it again applies nothing", async () => {
  const [before, after] = await runOnTestDatabase(
    Effect.gen(function* () {
      const before = yield* appliedMigrations;
      yield* migrate;
      return [before, yield* appliedMigrations];
    }),
  );

  expect(before).toBeGreaterThan(0);
  expect(after).toBe(before);
});

test("every build of the test layer is a fresh database", async () => {
  await runOnTestDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TABLE form_management.leftover (id int)`;
    }),
  );

  const [row] = await runOnTestDatabase(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      return yield* sql<{ table: string | null }>`
        SELECT to_regclass('form_management.leftover')::text AS table
      `;
    }),
  );

  expect(row?.table).toBeNull();
});
