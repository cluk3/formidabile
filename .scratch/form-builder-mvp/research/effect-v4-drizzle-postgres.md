# Effect v4 with Drizzle and Postgres

Research for [ticket 03](../issues/03-effect-v4-with-drizzle-and-postgres.md). Researched 2026-10-19.

## Sources

Every claim below is cited to one of these sources.

- **[npm]** The npm registry: `npm view <pkg> dist-tags time dependencies peerDependencies` for `effect`, `@effect/sql`, `@effect/sql-drizzle`, `@effect/sql-pg`, `@effect/sql-pglite`, `drizzle-orm`, `drizzle-kit`, `@electric-sql/pglite` and `@testcontainers/postgresql`.
- **[drizzle-src]** The published `drizzle-orm` tarballs `1.0.0-rc.4` and `1.0.0-rc.5-5935859`, both from `npm pack`. Paths are relative to the package root. Unless a line says otherwise, it refers to `1.0.0-rc.5-5935859`.
- **[kit-src]** The published `drizzle-kit@1.0.0-rc.4` tarball: `index.d.ts` and the bundled `skills/drizzle-migrations/SKILL.md`.
- **[effect-src]** The published `effect@4.0.5` tarball, `src/sql/SqlClient.ts`.
- **[sql-pg-src]** The published `@effect/sql-pg@4.0.5` tarball: `README.md`, `src/PgClient.ts` and `dist/PgClient.d.ts`.
- **[sql-pglite-src]** The published `@effect/sql-pglite@4.0.5` tarball: `README.md` and `dist/PgliteClient.d.ts`.
- **[d-connect]** Drizzle docs, [Effect Postgres](https://orm.drizzle.team/docs/connect-effect-postgres).
- **[d-rc1]** Drizzle release notes, [v1.0.0-rc.1](https://github.com/drizzle-team/drizzle-orm/releases/tag/v1.0.0-rc.1).
- **[d-config]** Drizzle docs, [drizzle.config.ts](https://orm.drizzle.team/docs/drizzle-config-file).
- **[d-custom]** Drizzle docs, [Custom migrations](https://orm.drizzle.team/docs/kit-custom-migrations).
- **[d-constraints]** Drizzle docs, [Indexes & Constraints](https://orm.drizzle.team/docs/indexes-constraints).
- **[d-rls]** Drizzle docs, [Row-Level Security](https://orm.drizzle.team/docs/rls).
- **[pg-trigger]** PostgreSQL 18 docs, [CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html).
- **[pg-priv]** PostgreSQL 18 docs, [5.8 Privileges](https://www.postgresql.org/docs/current/ddl-priv.html).
- **[pg-rls]** PostgreSQL 18 docs, [5.9 Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- **[pglite]** PGlite docs, [What is PGlite](https://pglite.dev/docs/about) and [PGlite Socket](https://pglite.dev/docs/pglite-socket).
- **[tc]** Testcontainers for Node, [PostgreSQL module](https://node.testcontainers.org/modules/postgresql/).
- **[gh-6403]** Drizzle issue [#6403](https://github.com/drizzle-team/drizzle-orm/issues/6403), "Effect rc.118 breaks SqlError declaration imports and transaction error inference", and PR [#6429](https://github.com/drizzle-team/drizzle-orm/pull/6429), "Bump effect to stable v4.0.0".
- **[effect-migration]** Effect's v3 to v4 migration annotations, [`migration/annotations/effect__sql-drizzle__Pg.yaml`](https://github.com/Effect-TS/effect/blob/main/migration/annotations/effect__sql-drizzle__Pg.yaml) in `Effect-TS/effect`.
- **[repro]** A second, independent reproduction run on 2026-10-19 in `/tmp/edz-exp`, also not committed. It used `effect@4.0.5`, `@effect/sql-pg@4.0.5`, `@effect/sql-pglite@4.0.5`, `@electric-sql/pglite@0.5.10`, `drizzle-orm` and `drizzle-kit` at `1.0.0-rc.5-5935859`, and `typescript@5.9.3`. Its results matched **[smoke]** on every point both runs covered.
- **[gh-6162]** Drizzle issue [#6162](https://github.com/drizzle-team/drizzle-orm/issues/6162), "Deprecated TaggedErrorClass syntax incompatible with Effect v4 release candidates", open as of 2026-10-19. It points to Effect's [beta.104 changelog](https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md#400-beta104) and Effect PR [#6732](https://github.com/Effect-TS/effect/pull/6732), which made the rename.
- **[gh-6036]** Drizzle PR [#6036](https://github.com/drizzle-team/drizzle-orm/pull/6036), "fix(effect): set the driver error as EffectDrizzleQueryError cause", open as of 2026-10-19.
- **[gh-6382]** Drizzle issue [#6382](https://github.com/drizzle-team/drizzle-orm/issues/6382), "`effect-postgres` `db.execute()` is typed as a row array but returns the `@effect/sql-pg` result object", open.
- **[gh-6234]** Drizzle issue [#6234](https://github.com/drizzle-team/drizzle-orm/issues/6234), "withReplicas sends reads to a replica inside an Effect transaction", open.
- **[d-upgrade]** Drizzle docs, [Upgrading to Drizzle v1](https://orm.drizzle.team/docs/upgrade-v1).
- **[d-tx]** Drizzle docs, [Transactions](https://orm.drizzle.team/docs/transactions).
- **[probe3]** A third independent run on 2026-10-19 in `/tmp/edr/probe`, also not committed. It used `effect@4.0.5`, `@effect/sql-pg@4.0.5`, `@effect/sql-pglite@4.0.5`, `@electric-sql/pglite@0.5.10`, `drizzle-orm` and `drizzle-kit` at `1.0.0-rc.4` and then at `1.0.0-rc.5-5935859`, `embedded-postgres@18.4.0-beta.17`, and `typescript@7.0.2`. Wherever it overlapped with **[smoke]** (rc.4 crash, atomic rollback, savepoints, ambient `db` joining the transaction, JSONB round-trip, trigger, revoked grant, `drizzle-kit migrate`), the results matched. The additional findings are marked **[probe3]** below.
- **[smoke]** A throwaway smoke test I ran on 2026-10-19 in `/tmp/dzsmoke`. It is not committed: the map says no production code. It used `effect@4.0.5`, `@effect/sql-pg@4.0.5`, `@effect/sql-pglite@4.0.5`, `@electric-sql/pglite@0.5.10`, and `drizzle-orm` plus `drizzle-kit` at `1.0.0-rc.4` and then at `1.0.0-rc.5-5935859`. The script ran twelve checks against two backends:
  - **PGlite:** in process, through `@effect/sql-pglite` and `drizzle-orm/effect-pglite`.
  - **Real PostgreSQL 18:** started from the `embedded-postgres` npm package, through `@effect/sql-pg` and `drizzle-orm/effect-postgres`.
  - **The checks:** migrations applied; a failed publish rolled back; a successful publish committed; JSONB round-tripped; a JSONB operator query matched; a nested transaction fell back to its savepoint; `SqlClient.withTransaction` also rolled back Drizzle writes; `tx.rollback()` worked; a partial unique index rejected a duplicate; a trigger blocked UPDATE and blocked DELETE; and concurrent queries ran inside a transaction.
  - **Not covered:** Docker wasn't running on this machine, so testcontainers and docker compose weren't exercised.

## 1. Integration options and their status under Effect v4

There are three candidates. Only the first is a supported Effect v4 path today.

| Option | Effect v4? | Notes |
| --- | --- | --- |
| Drizzle's native Effect driver, `drizzle-orm/effect-postgres` (and `effect-pglite`) | Yes, in the `1.0.0-rc` line | Built on `@effect/sql-pg`'s `PgClient` |
| `@effect/sql-drizzle` | No | Effect 3 only |
| Plain Drizzle (`drizzle-orm/node-postgres`), each call wrapped in `Effect.tryPromise` | Works with any Effect version | No shared transaction context with Effect, so you rebuild it yourself |

- **Drizzle ships native Effect v4 support.** `drizzle-orm@1.0.0-rc.1` introduced `drizzle-orm/effect-postgres`. Its changelog says it "Switched from Effect V3 to Effect V4 beta for `effect-schema`, `effect-postgres`". **[d-rc1]** The docs install `drizzle-orm@rc` with `effect` and `@effect/sql-pg`. **[d-connect]**
  - The package also exports `effect-pglite`, `effect-core`, `effect-schema`, a migrator for each Effect driver, and Effect drivers for other dialects. **[drizzle-src `package.json` exports]**
  - `PgDrizzle.make({ relations })` is an Effect that requires `PgClient`, `EffectLogger` and `EffectCache`. `makeWithDefaults()` provides a no-op logger and cache, so only `PgClient` is left. **[drizzle-src `effect-postgres/driver.d.ts`; d-connect]**
  - The docs show wrapping the db in a `Context` service and a `Layer`, composed with `PgClient.layer`. **[d-connect Step 3]**
- **This is still pre-1.0, and the published `rc` tag is broken against stable Effect.**
  - `drizzle-orm` `latest` is `0.45.4`, which has no Effect support. `rc` is `1.0.0-rc.4`, published 2026-06-27, before `effect@4.0.0` went stable on 2026-10-01. **[npm]**
  - `1.0.0-rc.4` fails at import time against `effect@4.0.5` with `TypeError: Schema$1.TaggedErrorClass is not a function`, raised from `cache/core/cache-effect.js`. **[smoke; drizzle-src rc.4 `cache/core/cache-effect.js`]** In `effect@4.0.5`, `Schema` exports `TaggedError` and `TaggedClass`, but not `TaggedErrorClass`. **[effect-src `dist/Schema.d.ts`]** The rename happened in `effect@4.0.0-beta.104`, and the Drizzle issue reporting it against `rc.4` is still open. **[gh-6162]**
  - The newer build `1.0.0-rc.5-5935859`, published 2026-09-09 under the dist-tag **`rc5`** for both `drizzle-orm` and `drizzle-kit`, no longer uses that API. It passed all twelve checks on both backends. **[npm; drizzle-src; smoke]**
  - Its peer range is `effect` and `@effect/sql-*` `>=4.0.0-beta.105 || >=4.0.0`, and all of them are optional peers. **[drizzle-src `package.json`]**
- **Type-level caveat in `rc5`.** Drizzle's `.d.ts` files still import `effect/unstable/sql/SqlError`. Effect 4.0 moved SQL to `effect/sql` and has no `unstable/sql` export. **[drizzle-src `pg-core/effect/session.d.ts`; effect-src `package.json` exports]**
  - With `skipLibCheck: false`, `tsc` reports `TS2307: Cannot find module 'effect/unstable/sql/SqlError'`.
  - With `skipLibCheck: true`, it compiles, but `db.transaction(...)`'s error channel silently becomes `any`. Ordinary query errors stay typed as `EffectDrizzleQueryError`. **[smoke: emitted `.d.ts`]**
  - **Workaround (verified):** a tsconfig `paths` entry `"effect/unstable/sql/*": ["./node_modules/effect/dist/sql/*.d.ts"]` restores the full union `EffectDrizzleQueryError | SqlError | <your errors>`. **[smoke]** drizzle-kit prints a harmless warning that it ignores this mapping. **[smoke]** An ambient declaration file containing `declare module "effect/unstable/sql/SqlError" { export * from "effect/sql/SqlError" }` also works: the transaction error type became exactly `"boom" | SqlError`, and full lib-checking reported no more `unstable/sql` errors. **[repro]**
  - **Fixed upstream but not yet published.** Issue #6403 was closed on 2026-10-05 as fixed by PR #6429, which was merged into the `rc5` branch on 2026-10-04. On that branch, `effect-postgres/session.ts` imports `effect/sql/SqlError`, and the peer ranges are `>=4.0.0`. **[gh-6403]** The newest published `rc5` build is still `1.0.0-rc.5-5935859` from 2026-09-09. **[npm]** So the shim can be dropped once a later build is published.
- **The Drizzle docs are out of date about `@effect/sql-pg`.** The docs install `pg` and pass `pg`'s `types.getTypeParser` into `PgClient.layer({ types })`. **[d-connect]** That matches `@effect/sql-pg` up to `4.0.0-rc.112`, which depended on `pg`, `pg-pool` and `pg-types`. From `4.0.0-rc.115` onward it has no runtime dependencies. **[npm]**
  - `@effect/sql-pg@4.0.5` has no runtime dependencies. It describes itself as having "a native wire-protocol driver", and its `types` option is a `PgTypes.Registry`, not a `pg` type parser. **[npm; sql-pg-src `README.md` L3, `PgClient.d.ts` `PgClientConfig.types`]**
  - The same page's Layer example declares the db service with `Context.Tag('DB')<...>()`. **[d-connect Step 3]** That is the Effect 3 API. Effect 4 services are declared with `Context.Service`, which is what `@effect/sql-pg@4.0.5` itself uses, for example `PgClient: Context.Service<PgClient, PgClient>`. **[sql-pg-src `dist/PgClient.d.ts`]** Treat the docs' code samples as v3-era sketches.
  - With `rc5`, a plain `PgClient.layer({ url })` round-trips `uuid`, `text`, `integer`, `boolean` and `jsonb` correctly. **[smoke]** Timestamp and date codecs were not exercised, so ticket 10 should check them once the persistence model needs them.
- **`@effect/sql-drizzle` is Effect 3 only.** Its `latest` is `0.51.0`, with peers `effect ^3.22.0`, `@effect/sql ^0.52.0` and `drizzle-orm >=0.43.1 <0.50`. It has no 4.x release. **[npm]** Effect's own migration notes confirm it is gone: "The package was removed; import PgDrizzle from drizzle-orm/effect-postgres, define an application service tag, and compose with PgClient.layer." **[effect-migration]** Effect 4 folded `@effect/sql` into `effect/sql`: the source lives at `src/sql/SqlClient.ts`, and `@effect/sql`'s `latest` stays at `0.52.1`. **[effect-src; npm]**
- **Wrapping plain Drizzle by hand is possible but loses the main benefit.** You'd use `drizzle-orm/node-postgres` with `pg`, calling `Effect.tryPromise` around each query.
  - With the native driver, Drizzle queries run on whichever connection Effect's `SqlClient` has bound to the current transaction (§3). That gives one transaction context across Drizzle and raw `effect/sql` statements, plus interruption-safe rollback. A hand-wrapped `pg` client gets neither. This follows from how the native session is built, below. **[drizzle-src `effect-postgres/session.js` L18, L27]**

## 2. Drivers and connection pooling

- **The production driver is `@effect/sql-pg`, and Drizzle doesn't add a driver of its own.** `EffectPgSession.prepareQuery` executes with `this.client.unsafe(query.sql, params)` on the `PgClient` it was given. **[drizzle-src `effect-postgres/session.js` L18]**
  - `@effect/sql-pg@4.0.5` is a self-contained wire-protocol client with its own `PgPool`, `PgConnection` and `PgProtocol` modules. It doesn't use `pg` or `postgres.js`. **[sql-pg-src `dist/`; npm]**
- **`postgres.js` (`postgres`) is not an option on the Effect path.** No Effect v4 SQL package wraps it, and Drizzle's Effect drivers list only `@effect/sql-*` peers. **[drizzle-src `package.json` peerDependencies]**
- **The test driver is `@effect/sql-pglite`**, which depends on `@electric-sql/pglite ^0.5.8` and pairs with `drizzle-orm/effect-pglite`. **[npm; drizzle-src `effect-pglite/driver.js` L11]** Its client adds "serialized access" around the single PGlite instance. **[sql-pglite-src `PgliteClient.d.ts` L151]**
- **Pooling.** `PgClient.layer(config: PgPoolConfig)` creates a scoped, pool-backed client. **[sql-pg-src `PgClient.ts` L179, L405]**
  - `PgPoolConfig` adds `maxConnections`, `minConnections`, `idleTimeout` and `connectionTTL` to the connection settings. **[sql-pg-src `PgClient.ts` L165–L169]**
  - `makeClient` creates a single-connection client instead. **[sql-pg-src `PgClient.d.ts`]**
  - **Multiplexing:** `multiplex` (off unless set) pipelines statements from several fibers over each pooled connection, up to `multiplexConcurrency`, which defaults to 32. "Transactions, streams, and listeners still reserve a connection." **[sql-pg-src `PgClient.ts` L138; `PgClient.d.ts`]**
  - **Prepared statements:** they are cached by name by default, up to `preparedStatementCacheSize`, which defaults to 100. Set `prepare: false` behind poolers that can't keep named statements, such as PgBouncer in transaction mode. **[sql-pg-src `PgClient.ts` L150; `PgClient.d.ts`]**
  - **Session settings:** `startupParameters`, for example `statement_timeout` or `search_path`, are sent in every new physical connection's startup packet, including replacement connections. **[sql-pg-src `README.md` §Session defaults]**
- **A transaction takes its own connection.** For a pool, the transaction acquirer is `pool.reserve`, so a transaction holds one connection until it commits or rolls back. **[sql-pg-src `PgClient.ts` L184]**

## 3. Transactions: atomic publish and nesting

This is the part that matters for ADR 0001 §5 rule 9, "Publishing must be atomic".

- **How it is written.** `db.transaction((tx) => Effect.gen(function* () { ... }))` returns `Effect<A, E | SqlError, R>`. **[drizzle-src `pg-core/effect/session.d.ts`]** It delegates to `@effect/sql`'s `client.withTransaction`, and can also apply isolation-level statements, including a snapshot. **[drizzle-src `effect-postgres/session.js` L25–L30]**
  - The publish step looks like this, and was verified in the smoke test:
    ```ts
    const publish = db.transaction((tx) => Effect.gen(function* () {
      const [version] = yield* tx.insert(formVersions).values({ formId, versionNumber, isCurrent: true }).returning()
      yield* tx.insert(questionSnapshots).values(snapshots.map((s) => ({ ...s, formVersionId: version.id })))
      // validation failure -> Effect.fail(...) -> whole transaction rolls back
    }))
    ```
  - **Rolls back on failure and on interruption.** `makeWithTransaction` "begins top-level transactions, uses savepoints for nested transactions, commits on success, and rolls back on failure or interruption". It runs under `Effect.uninterruptibleMask`. **[effect-src `SqlClient.ts` L384–L416]** A typed `Effect.fail` inside the block rolled back both the version row and the snapshot rows. **[smoke]**
  - **Explicit rollback.** `tx.rollback()` returns an `EffectTransactionRollbackError` value to `yield*`. **[drizzle-src `pg-core/effect/session.js` L103–L104; smoke]**
  - **Isolation level only works on the outermost call.** `db.transaction(fn, { isolationLevel, accessMode, deferrable })` takes the same `PgTransactionConfig` as the promise API. **[d-tx; drizzle-src `effect-postgres/session.d.ts` L37]** The Effect driver applies it by running `SET TRANSACTION ...` as the first statement inside `withTransaction`. **[drizzle-src `effect-postgres/session.js` `transaction`]**
    - At top level this worked: `current_setting('transaction_isolation')` read `serializable`. **[probe3]**
    - The same call made while a transaction was already open, after a query had run, failed with `EffectDrizzleQueryError` ("Failed to execute statement"). **[probe3]** In that case the call has become a savepoint, and Postgres only accepts `SET TRANSACTION` before the transaction's first query.
    - **Consequence:** if publishing needs `serializable` or `repeatable read`, the use-case layer that opens the outermost transaction must set it. A repository function can't raise it from inside.
  - **Separate fibers get separate transactions.** Two `db.transaction` calls run in parallel with `Effect.all(..., { concurrency: "unbounded" })`, one failing and one succeeding, rolled back and committed independently. **[probe3, on PGlite]**
- **Nested and composed transactions use savepoints.**
  - Calling `tx.transaction(...)`, or `db.transaction(...)` while already inside a transaction, finds the active connection in the fiber's context, increments a counter, and issues `SAVEPOINT effect_sql_<n>` instead of `BEGIN`. **[effect-src `SqlClient.ts` L427–L437]**
  - On failure it runs `ROLLBACK TO SAVEPOINT`. On success it `RELEASE`s the savepoint, which Postgres supports. **[effect-src `SqlClient.ts` L466–L471; sql-pg-src `PgClient.ts` L252]**
  - Catching an inner failure kept the outer transaction's writes and dropped only the inner ones. **[smoke]**
  - **Consequence for design:** repository functions can each wrap themselves in `db.transaction` and still compose into a single atomic publish.
- **Drizzle and raw `effect/sql` statements share one transaction.** The active connection lives in the Effect context, not on the `tx` object.
  - Inside `SqlClient.withTransaction(...)`, both a raw `` sql`INSERT ...` `` and a top-level `db.insert(...)` that wasn't routed through `tx` were rolled back together. **[smoke]**
  - So a domain service can open the transaction at the use-case level, and lower layers can simply `yield*` the db service.
- **Concurrency inside a transaction is serialized, not rejected.** A per-transaction `Semaphore(1)` guards the connection. **[effect-src `SqlClient.ts` L412–L414, L444, L487]** `Effect.all([...], { concurrency: "unbounded" })` inside a transaction succeeded. **[smoke]**
- **Pitfall: catching a failed statement without a savepoint.** If one statement fails and the error is swallowed inside the same transaction level, Postgres marks the transaction aborted. `@effect/sql-pg` then turns the `COMMIT` into a failure: "COMMIT rolled back an aborted transaction". **[sql-pg-src `PgClient.ts` L343–L353; smoke]** To recover from an expected constraint error mid-transaction, wrap the attempt in a nested `tx.transaction` so it gets a savepoint.
- **How database errors arrive.** Drizzle wraps them in `EffectDrizzleQueryError { query, params, cause }`. The `cause` holds an `effect/sql` `SqlError` whose reason is classified.
  - A unique violation came through as `SqlError/UniqueViolation`.
  - A trigger exception raised with `ERRCODE = 'restrict_violation'` came through as `SqlError/ConstraintError`.
  - **[drizzle-src `effect-core/errors.d.ts`; smoke]** Either can be mapped to a domain error, such as a version conflict or an immutability violation, at the repository boundary.
  - **The `cause` is an Effect `Cause`, not the `SqlError` itself.** Drizzle builds the error as `new EffectDrizzleQueryError({ query, params, cause: Cause.fail(e) })`. **[drizzle-src `pg-core/effect/session.js` L71–L75]** So `error.cause._tag` and `error.cause.reason` are `undefined`. `Cause.squash(error.cause)` returns the `SqlError`, whose `reason._tag` is the classification. **[probe3]** Open PR #6036 proposes putting the driver error directly in `cause`, so this access path may change. **[gh-6036]** Keep the unwrapping in one helper at the repository boundary.
  - **How SQLSTATE codes map to reasons in `@effect/sql-pg`:** `08xxx` connection, `28xxx` authentication, `42501` `AuthorizationError`, other `42xxx` syntax, `23505` `UniqueViolation` (with the constraint name), and other `23xxx` `ConstraintError`. **[sql-pg-src `dist/internal/sqlError.js` L21–L40]** A revoked grant therefore arrives as `AuthorizationError`, and a trigger raising `restrict_violation` (`23001`) as `ConstraintError`. **[probe3, real PostgreSQL 18]**
- **Two smaller driver caveats from open issues.**
  - `db.execute(sql\`...\`)` is typed as a row array, but on `effect-postgres` it returns the driver's result object (`{ rows, fields, command, ... }`). **[gh-6382]** The same result-object shape came back on `effect-pglite`. **[probe3]** Prefer the query builder, or read `.rows`.
  - `withReplicas` keeps sending reads to the replica inside an Effect transaction that was joined through the ambient context. The workaround is to use the `tx` argument. **[gh-6234]** This only matters if read replicas are introduced later.

## 4. Typed JSON and JSONB columns

- **Compile-time typing.** `jsonb().$type<T>()` types the column as `T` for inserts and selects. Drizzle's own doc comment shows `json('details').$type<UserDetails>()`. **[drizzle-src `column-builder.d.ts` L165–L169]**
  - A discriminated union `QuestionConfig` came back as `QuestionConfig` in the emitted types. It was stored and read back as a plain object, with no double-encoding, on both drivers. **[smoke]**
- **Querying inside JSON.** JSON operators work through the `sql` template, for example `` sql`${t.config}->>'kind' = 'choice'` ``. **[smoke]**
- **`$type` checks nothing at runtime.** Use `drizzle-orm/effect-schema` for that.
  - `createInsertSchema(table, { config: ConfigSchema })` and `createSelectSchema(table)` build Effect v4 schemas from the table definition. They import `effect/Schema`. **[drizzle-src `effect-schema/schema.d.ts`, `effect-schema/column.d.ts`]**
  - A JSON column without an override becomes a generic JSON union. **[drizzle-src `effect-schema/column.js` L13, L217]**
  - With a refined `config` schema, a valid snapshot decoded and an invalid `options` array was rejected. `uuid` columns are validated as RFC UUIDs. **[smoke]**
  - **Consequence:** the canonical form-definition schema (ticket 08) can be an Effect Schema, attached to the JSONB column through `$type` for static types and through `createInsertSchema` overrides for runtime checks.

## 5. Migrations: drizzle-kit workflow in a monorepo package

- **Configuration.** `drizzle.config.ts` sets `dialect: "postgresql"`, `schema`, `out` and `dbCredentials`. **[d-config; kit-src `SKILL.md`]**
  - `schema` accepts a glob or an array, so a db package can keep `src/**/*.sql.ts` table files.
  - `out` defaults to `./drizzle`.
  - Multiple config files can be selected with `--config=`. **[d-config]**
  - The applied-migrations table defaults to `drizzle.__drizzle_migrations` and can be renamed through `migrations: { table, schema }`. **[d-config]**
- **Commands.** `generate` diffs the schema and writes SQL for review. `push` applies the diff directly and is meant for local iteration. `migrate` applies the generated files. **[kit-src `SKILL.md` §Generate vs push; d-config]**
  - **Folder layout in 1.0:** each migration is its own folder, `<YYYYMMDDHHmmss>_<name>/` with `migration.sql` and `snapshot.json` inside. There is no `meta/_journal.json`. **[smoke; d-config §Migrations folder]** The upgrade guide gives the reason: dropping the journal "eliminate[s] potential Git conflicts with the journal file". `drizzle-kit up` converts an old-style folder. **[d-upgrade]**
  - **Branch safety:** drizzle-kit 1.0 adds "commutativity checks", described as "Detecting non-commutative migrations across branches". **[d-upgrade]** `drizzle-kit check` against the probe's migrations printed "Everything's fine". **[probe3]** This is worth running in CI once several branches add migrations.
  - **Stale bundled skill:** `drizzle-kit`'s bundled `skills/drizzle-migrations/SKILL.md` still describes `meta/_journal.json` and `meta/<n>_snapshot.json`, which 1.0 no longer writes. **[kit-src]** Rely on the generated output and the upgrade guide instead.
- **Custom SQL migrations.** `drizzle-kit generate --custom --name=<name>` creates an empty migration for SQL that Drizzle can't model, such as triggers and functions, and it is applied in order with the generated ones. **[d-custom; smoke]**
  - JavaScript and TypeScript migrations are not supported yet. **[d-custom]**
- **Ordering pitfall.** Folder timestamps have one-second resolution, and the migrator orders migrations by folder name. **[smoke]**
  - Running `generate` and `generate --custom` within the same second gave both folders the same timestamp. `…_immutable_snapshots` then sorted before `…_init` and failed with `relation "question_snapshots" does not exist`. **[smoke]**
  - Fix: check the new folder name after generating, and bump the timestamp if it collides.
- **Running migrations from Effect.** `migrate(db, { migrationsFolder })` from `drizzle-orm/effect-postgres/migrator` returns `Effect<undefined, MigratorInitError | EffectDrizzleQueryError | SqlError>`. There is an equivalent in `drizzle-orm/effect-pglite/migrator`. **[drizzle-src `effect-postgres/migrator.d.ts`]**
  - It applies **all pending migrations in one transaction**, together with their bookkeeping rows. **[drizzle-src `pg-core/effect/session.js` `migrate`]**
  - This is the same code path for tests (PGlite) and for app startup, and it needs no extra driver.
- **The drizzle-kit CLI needs `pg` or `postgres`.** `migrate`, `push`, `pull` and `studio` connect through a classic driver, and drizzle-kit can't use `@effect/sql-pg`.
  - With neither installed, `drizzle-kit migrate` exits with "please install either of 'pg', 'postgres', 'bun', '@neondatabase/serverless' or '@vercel/postgres' drivers". With `pg` available, it printed "Using 'pg' driver". **[smoke]**
  - `generate` needs no database. **[d-config: `dbCredentials` is only for push, pull, migrate and studio]**
  - **PGlite target:** `driver: "pglite"` points `push` and `migrate` at a PGlite directory or `:memory:`. **[d-config]**
- **Fit in a pnpm monorepo.**
  - Put `drizzle.config.ts`, the schema files and the `drizzle/` migrations folder in the package that owns persistence.
  - Give that package `generate` and `migrate` scripts.
  - Make `drizzle-kit` and `pg` dev dependencies of that package only.
  - The runtime ships the `drizzle/` folder and calls the Effect migrator, so `pg` never becomes a production dependency. This is my recommendation, built from the facts above rather than from a documented monorepo recipe. Drizzle's docs don't describe a monorepo layout.

## 6. Testing against a real Postgres

| Option | What runs | Speed in the smoke test | Fidelity | Works with the native Effect integration? |
| --- | --- | --- | --- | --- |
| **PGlite** in process (`@effect/sql-pglite` + `drizzle-orm/effect-pglite`) | Postgres compiled to WASM, single connection **[pglite]** | Whole suite including WASM start-up and migrations: about 0.8–0.9 s **[smoke]** | Real Postgres SQL: plpgsql triggers, partial unique indexes, CHECK constraints and JSONB all behaved like the server **[smoke]**. Doesn't exercise `@effect/sql-pg`'s wire protocol, pool, multiplexing or prepared-statement cache, or multi-connection concurrency | Yes, it has its own Drizzle driver |
| **PGlite over `@electric-sql/pglite-socket`**, used through `@effect/sql-pg` | TCP server with a multiplexer over PGlite's single connection; "not all use cases are guaranteed to work" **[pglite socket]** | n/a | **Broke:** after a trigger exception, `@effect/sql-pg` reported `Unexpected ReadyForQuery during parse` and lost the connection. The same test passed on real Postgres **[smoke]** | Not reliable; don't use it |
| **Real Postgres from a docker compose service** (or the `embedded-postgres` npm binaries) | The real server and the production driver | `embedded-postgres` (PostgreSQL 18): about 10 s for initdb and start, then 69 ms for the twelve checks **[smoke]** | Full: production driver, pooling, real concurrency and locking | Yes, `@effect/sql-pg` with `drizzle-orm/effect-postgres` passed all twelve checks **[smoke]** |
| **Testcontainers** (`@testcontainers/postgresql@12.2.1`) | A throwaway Postgres container for each suite | Not measured (Docker was not running) | Full, same as above. Adds `snapshot()` / `restoreSnapshot()` to reset the database between tests; don't name the container's database `"postgres"` if you use snapshots **[tc]** | Yes. `getConnectionUri()` feeds `PgClient.layer({ url })` **[tc]**. Requires a Docker daemon |

- **What PGlite can't show: concurrency.** `@effect/sql-pglite` guards the PGlite instance with a single `Semaphore.makeUnsafe(1)`, and "Statements, streams and transactions hold the permit until their scope closes, so no other fiber can use the connection while they run." **[sql-pglite-src `dist/PgliteClient.js` L85–L87]** PGlite itself "is single user/connection". **[pglite]** So two concurrent publishes run one after the other on PGlite, and lock waits, deadlocks and serialization failures never happen there. Concurrent-publish tests (ticket 10's locking strategy) belong in the real-Postgres suite.
- **Roles and grants do work on PGlite.** PGlite 0.5.10 reports `PostgreSQL 18.6`. After `REVOKE UPDATE` and `SET ROLE app_rw`, an UPDATE failed with SQLSTATE `42501` and an INSERT succeeded. **[probe3]** The privilege-split design in §7 can therefore be tested in process, using `SET ROLE` instead of a second login.
- **The two drivers are swapped with a Layer.** The test suite ran the same Drizzle repository code on both `drizzle-orm/effect-pglite` (with `PgliteClient.layer`) and `drizzle-orm/effect-postgres` (with `PgClient.layer`). **[smoke]**
  - The smoke script typed the db as `any`. Whether the two db classes unify under a single TypeScript type without a cast wasn't checked. Both expose `EffectDrizzleQueryError` as the query error and `never` as the context. **[drizzle-src `effect-*/session.d.ts`]**
- **Recommended split.**
  - Run the fast domain and repository integration tests on in-process PGlite, with one fresh database per test file. PGlite's docs pitch exactly this: "you can have a unique fresh Postgres for each test". **[pglite]**
  - Run a smaller suite on real Postgres through `@effect/sql-pg`, from a docker compose service locally and a Postgres service container in CI. That covers the production driver, pooling and concurrent-publish behaviour.
  - Testcontainers is the alternative when the suite should own the database's lifecycle. It needs Docker either way.
  - This split is a judgement call based on the measurements above.

## 7. Database-level immutability enforcement

ADR 0001 §5 rule 1 says published versions are immutable. Postgres offers three mechanisms, and Drizzle can declare or tolerate each one.

- **Triggers (verified, strongest).** Use a `BEFORE UPDATE OR DELETE ... FOR EACH ROW` trigger whose function raises. Before-triggers fire "before the operation is attempted", so the function can abort it. Statement-level `BEFORE TRUNCATE` triggers also exist. **[pg-trigger]**
  - **Drizzle can't declare triggers or functions in the schema.** Its `entities` config "only includes `roles`" for now, with "functions, triggers" listed as future entities. **[d-config §entities]** Put them in a `generate --custom` migration. **[d-custom]**
  - drizzle-kit leaves them alone: after the custom migration, a further `generate` reported "No schema changes, nothing to migrate", and `migrate` applied the trigger. **[smoke]** `drizzle-kit push --force` against the migrated database also reported "No changes detected", and the trigger was still there afterwards. **[repro]**
  - Through Drizzle, an UPDATE or DELETE on a protected row fails with `EffectDrizzleQueryError`, whose cause is `SqlError/ConstraintError` carrying the trigger's message. **[smoke]**
  - Triggers apply to every role, including the table owner, so they also guard against mistakes in migrations or ad-hoc SQL.
  - **Conditional immutability** is also possible: a `WHEN (OLD.published_at IS NOT NULL)` clause, or a check inside the function, freezes rows only once they are published. **[pg-trigger §condition]**
  - **Interaction with privacy deletion (ADR §9).** A blanket DELETE block on snapshot or version tables would also block lawful deletion. ADR §9 targets respondent personal data, not definitions, but the trigger has to allow whatever deletion path the privacy design chooses, for example a dedicated function or a session flag.
- **Privilege split (verified).** Run migrations as the owner role, and have the app connect as a role granted only `SELECT, INSERT` on immutable tables.
  - **Caveat:** the table owner can't really be locked out. "The right to modify or destroy an object is inherent in being the object's owner", and owners "can always re-grant their own privileges". **[pg-priv]** So this protects only if the runtime role is not the owner.
  - **Verified:** as the restricted role (`SET LOCAL ROLE app_runtime`), an UPDATE through Drizzle failed with Postgres's `permission denied for table snaps`. **[smoke]**
  - **Drizzle support:** `pgRole` exists, with `entities.roles: true` for drizzle-kit to manage roles. Grants aren't modelled, so `GRANT`/`REVOKE` goes in a custom migration. **[d-rls; d-config §entities]**
- **Row-level security.** Drizzle can declare RLS: `pgPolicy` inside `pgTable`, `pgTable.withRLS`, and policies with `for: 'update' | 'delete'` and `using: sql\`false\``. **[d-rls]**
  - **Limits:** "table owners normally bypass row security" unless `FORCE ROW LEVEL SECURITY` is set. `TRUNCATE` is never subject to RLS. **[pg-rls]**
  - **Different failure:** a blocked UPDATE silently affects 0 rows rather than raising an error. The Postgres docs example shows `UPDATE 0`. **[pg-rls]** Silent no-ops are a poor fit for an invariant you want to fail loudly.
- **CHECK constraints and partial unique indexes (verified, for supporting invariants).**
  - CHECK constraints validate a single row, so they can't stop an UPDATE from replacing one valid value with another.
  - They suit related invariants, such as `version_number > 0`, and a partial unique index on `(form_id) WHERE is_current` guarantees at most one current version per form. Drizzle declares both natively with `check(...)` and `uniqueIndex(...).on(...).where(sql\`...\`)`. **[d-constraints; smoke: drizzle-kit emitted `CREATE UNIQUE INDEX ... WHERE "is_current"` and Postgres rejected a second current version]**
  - Together with the transaction in §3, a publish that flips `is_current` inside the same transaction can never leave zero or two current versions.

## Open points for later tickets

- **Version pinning.** Use `effect@4.0.5`, `@effect/sql-pg@4.0.5`, `@effect/sql-pglite@4.0.5`, and `drizzle-orm` plus `drizzle-kit` at `1.0.0-rc.5-5935859` (the `rc5` tag), all pinned exactly. Re-check when Drizzle publishes an `rc` tag newer than `1.0.0-rc.4`.
- **The tsconfig `paths` shim** in §1 is needed until a Drizzle build containing PR #6429 is published.
- **Only lightly tested codecs.** One `timestamp({ withTimezone: true })` value round-tripped as a `Date` with milliseconds intact through `@effect/sql-pg@4.0.5`. **[repro]** That run reached PGlite over `pglite-socket`, which §6 found unreliable, so ticket 10, the persistence model, should still cover `timestamptz` and `date` columns on real Postgres.
- **TypeScript 7 (checked).** **[smoke]** and **[repro]** used TypeScript 5.x, while **[probe3]** used `typescript@7.0.2` and saw the same behaviour. With `skipLibCheck: true` and no shim, assigning `db.transaction(() => Effect.fail("e"))` to `Effect<never, "e", never>` compiled, because `SqlError` had been erased. With the ambient `declare module "effect/unstable/sql/SqlError"` shim from §1, the type was exactly `"e" | SqlError`, and the same assignment was rejected with TS2322. **[probe3]**
  - With `skipLibCheck: false`, TypeScript 7 also reported `Cannot find namespace 'Emscripten'` from `@electric-sql/pglite`'s declarations, alongside the `unstable/sql` errors. **[probe3]** So keep `skipLibCheck: true` in any package that imports PGlite, and add the shim.
- **Concurrent publishes.** Two publishes of the same form at once need a row lock or a unique `(form_id, version_number)` constraint to serialize them. The constraint is shown in §7, but locking strategy belongs to ticket 10.
