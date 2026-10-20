# Effect v4 with Drizzle and Postgres

Type: research
Status: resolved
Map: [Form builder MVP](../map.md)

## Question

What are the supported ways to use Drizzle against Postgres from an Effect v4 backend, and which ones give the transactional guarantees the ADR needs?

Find out:

- Integration options: an official Effect SQL plus Drizzle integration, wrapping Drizzle calls in Effect manually, or others. Their status under Effect v4.
- Postgres driver options supported by each (e.g. `pg`, `postgres.js`) and connection pooling.
- Transactions: how a multi-statement atomic operation is expressed (needed for "publishing is atomic", ADR 0001 §5 rule 9), and how nested or composed transactions behave.
- Support for JSON or JSONB columns with typed values (for question snapshots and type-specific configuration).
- Migrations: drizzle-kit workflow, and how it fits a monorepo package.
- Testing against a real Postgres: PGlite, testcontainers, or a docker-compose service; trade-offs in speed and fidelity, and which ones work with the chosen integration.
- Database-level enforcement options for immutability (e.g. triggers, revoked UPDATE grants, check constraints) and whether Drizzle can express or tolerate them.

## Answer

Use Drizzle's native Effect v4 driver, `drizzle-orm/effect-postgres`, on top of `@effect/sql-pg`. It gives the atomic, composable transactions that ADR 0001 §5 rule 9 needs. There is a version catch: the published `rc` tag (`1.0.0-rc.4`) crashes against stable Effect, so pin the `rc5` build (`1.0.0-rc.5-5935859`) of both `drizzle-orm` and `drizzle-kit`. A smoke test passed the same twelve checks on in-process PGlite and on real PostgreSQL 18. Full findings and citations are in [research/effect-v4-drizzle-postgres.md](../research/effect-v4-drizzle-postgres.md).

- **Integration options.**
  - **Native driver:** `drizzle-orm/effect-postgres` arrived in `1.0.0-rc.1`. `PgDrizzle.make` / `makeWithDefaults` turn a `PgClient` into a Drizzle db that returns Effects, wired up through a `Layer`.
  - **Broken `rc` tag:** `1.0.0-rc.4` fails at import with `Schema.TaggedErrorClass is not a function` against `effect@4.0.5`.
  - **Type caveat:** Drizzle's types still import `effect/unstable/sql/SqlError`, which Effect 4.0 removed, so `db.transaction`'s error channel becomes `any`. A one-line tsconfig `paths` shim restores it. The fix, Drizzle PR [#6429](https://github.com/drizzle-team/drizzle-orm/pull/6429), is merged on the `rc5` branch but not yet published, so the shim can go once a newer build ships.
  - **Not viable:** `@effect/sql-drizzle` is Effect 3 only (peer `effect ^3.22`, `drizzle-orm <0.50`). Wrapping `pg`-backed Drizzle in `Effect.tryPromise` works, but loses the shared transaction context.
- **Drivers and pooling.**
  - **Production:** `@effect/sql-pg@4.0.5` is now a self-contained wire-protocol driver, with no `pg`, `pg-pool` or `postgres.js`. It has its own pool (`maxConnections`, `minConnections`, `idleTimeout`, `connectionTTL`), optional multiplexing, and a prepared-statement cache (`prepare: false` for PgBouncer).
  - **Stale docs:** Drizzle's docs still show `pg`'s type parsers, which no longer apply. A plain `PgClient.layer({ url })` worked.
  - **Tests:** `@effect/sql-pglite` with `drizzle-orm/effect-pglite`.
- **Transactions.**
  - **Atomic publish:** `db.transaction((tx) => Effect.gen(...))` uses Effect SQL's `withTransaction`. Any failure or interruption rolls back everything, which was verified for a version row plus its snapshots.
  - **Nesting:** nested or composed calls become `SAVEPOINT`s, so repository functions can each open a transaction and still compose into one.
  - **Shared context:** raw `effect/sql` statements and Drizzle queries share the transaction through the Effect context.
  - **Pitfall:** if a failed statement is swallowed without a savepoint, `COMMIT` fails, because Postgres has marked the transaction aborted.
  - **Isolation level:** `db.transaction(fn, { isolationLevel })` only works on the outermost call. A nested call has become a savepoint and fails, so the use-case layer has to choose the isolation level for publishing.
  - **Error shape:** a query's `EffectDrizzleQueryError.cause` is an Effect `Cause`. `Cause.squash` yields the `SqlError`, whose reason is `UniqueViolation`, `ConstraintError` (which includes trigger `restrict_violation`) or `AuthorizationError` (revoked grant).
- **Typed JSONB.**
  - **Static types:** `jsonb().$type<T>()` gives compile-time types, and values round-trip as objects.
  - **Runtime checks:** `drizzle-orm/effect-schema` (`createInsertSchema(table, { config: Schema })`) adds Effect v4 schema validation.
- **Migrations.**
  - **Layout:** drizzle-kit 1.0 writes one folder per migration (`<timestamp>_<name>/migration.sql`).
  - **Custom SQL:** `generate --custom` holds hand-written SQL such as triggers and grants.
  - **Ordering pitfall:** timestamps have one-second resolution, and two migrations generated in the same second applied in the wrong order.
  - **At runtime:** the Effect migrator `drizzle-orm/effect-postgres/migrator` applies pending migrations in one transaction.
  - **CLI:** the drizzle-kit CLI's `migrate`, `push` and `pull` need `pg` or `postgres` as a dev dependency. `generate` needs no database.
  - **Monorepo:** keep config, schema and migrations in the persistence package.
- **Testing.**
  - **PGlite:** fast (about 0.8 s for the whole suite including WASM start-up), and real Postgres semantics such as triggers, partial indexes and JSONB behaved correctly. It doesn't exercise the production driver or pool.
  - **pglite-socket:** bridging PGlite to `@effect/sql-pg` broke after a trigger error. Don't use it.
  - **Real Postgres:** passed everything. Docker compose or testcontainers need a Docker daemon; testcontainers wasn't measured because Docker wasn't running.
  - **PGlite limit:** `@effect/sql-pglite` runs every statement and transaction one at a time, so concurrent-publish races, lock waits and serialization failures can only be tested on real Postgres. Roles and revoked grants do work on PGlite through `SET ROLE`.
  - **Recommended split:** PGlite for most integration tests, and a smaller suite on real Postgres through `@effect/sql-pg` in CI.
- **Immutability at the database level.**
  - **Triggers (strongest):** a `BEFORE UPDATE OR DELETE` trigger stops everyone, including the table owner. Drizzle can't declare triggers, so they go in a custom migration, and drizzle-kit doesn't touch them afterwards. They surface as `EffectDrizzleQueryError` with a `ConstraintError` cause.
  - **Privilege split:** a runtime role granted only `SELECT, INSERT` was verified to get `permission denied`. It only helps if the app doesn't connect as the table owner.
  - **RLS:** Drizzle can declare it with `pgPolicy`, but owners bypass it unless forced, and blocked updates fail silently as `UPDATE 0`.
  - **CHECK constraints and partial unique indexes:** Drizzle declares them natively. They suit supporting invariants such as one current version per form, not immutability.
  - **Privacy deletion:** the trigger design has to leave room for whatever deletion ADR §9 requires.
