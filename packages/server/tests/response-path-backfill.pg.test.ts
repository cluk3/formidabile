import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PgClient } from "@effect/sql-pg";
import { Database, DatabaseLive } from "@fb/server/database";
import { migrate as drizzleMigrate } from "drizzle-orm/effect-postgres/migrator";
import { Effect, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { expect, test } from "vite-plus/test";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("test:pg needs DATABASE_URL");

/** The last migration before the path table. Later folders are what this test applies onto existing rows. */
const headBeforePath = "20261021021536_response_immutability";
const migrationsFolder = fileURLToPath(new URL("../lib/persistence/migrations", import.meta.url));

const migrationsThrough = (name: string) => {
  const dir = mkdtempSync(join(tmpdir(), "fb-path-backfill-"));
  const later: string[] = [];
  for (const entry of readdirSync(migrationsFolder).sort()) {
    if (entry > name) {
      later.push(entry);
      continue;
    }
    cpSync(join(migrationsFolder, entry), join(dir, entry), { recursive: true });
  }
  if (later.length === 0) throw new Error(`no migration follows ${name}`);
  return dir;
};

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

test("responses collected before the path table are shown every question of their version", async () => {
  const { questionIds, shown } = await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const url = yield* freshDatabaseUrl(databaseUrl);
        const prefix = yield* Effect.acquireRelease(
          Effect.sync(() => migrationsThrough(headBeforePath)),
          (dir) => Effect.sync(() => rmSync(dir, { recursive: true, force: true })),
        );
        const formId = crypto.randomUUID();
        const versionId = crypto.randomUUID();
        const otherVersionId = crypto.randomUUID();
        const shown = [crypto.randomUUID(), crypto.randomUUID()];
        const otherQuestionId = crypto.randomUUID();
        const responseId = crypto.randomUUID();

        const stored = yield* Effect.gen(function* () {
          const db = yield* Database;
          yield* drizzleMigrate(db, {
            migrationsFolder: prefix,
            migrationsSchema: "form_management",
          });
          const sql = yield* SqlClient.SqlClient;
          yield* sql`
            INSERT INTO form_management.forms (id, tenant, availability, response_limit, created_at, updated_at)
            VALUES (${formId}, 'acme', 'closed', 'unlimited', now(), now())
          `;
          yield* sql`
            INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
            VALUES (${versionId}, ${formId}, 1, '{}', now(), 'acme-admin')
          `;
          yield* sql`
            INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
            VALUES (${otherVersionId}, ${formId}, 2, '{}', now(), 'acme-admin')
          `;
          for (const [index, questionId] of shown.entries()) {
            yield* sql`
              INSERT INTO form_management.question_identities (form_id, question_id, type)
              VALUES (${formId}, ${questionId}, 'text')
            `;
            yield* sql`
              INSERT INTO form_management.form_version_questions
                (version_id, question_id, form_id, type, position)
              VALUES (${versionId}, ${questionId}, ${formId}, 'text', ${index})
            `;
          }
          yield* sql`
            INSERT INTO form_management.question_identities (form_id, question_id, type)
            VALUES (${formId}, ${otherQuestionId}, 'text')
          `;
          yield* sql`
            INSERT INTO form_management.form_version_questions
              (version_id, question_id, form_id, type, position)
            VALUES (${otherVersionId}, ${otherQuestionId}, ${formId}, 'text', 0)
          `;
          yield* sql`
            INSERT INTO form_management.responses
              (id, form_id, version_id, respondent_id, limited, revision, idempotency_key, submitted_at)
            VALUES (${responseId}, ${formId}, ${versionId}, 'alice', false, 1, ${crypto.randomUUID()}, now())
          `;
          yield* drizzleMigrate(db, {
            migrationsFolder,
            migrationsSchema: "form_management",
          });
          return yield* sql<{ questionId: string }>`
            SELECT question_id AS "questionId"
            FROM form_management.response_path
            WHERE response_id = ${responseId}
          `;
        }).pipe(Effect.provide(DatabaseLive(url)));

        return { questionIds: stored.map((row) => row.questionId), shown };
      }),
    ),
  );

  expect(questionIds).toHaveLength(shown.length);
  expect(new Set(questionIds)).toEqual(new Set(shown));
});
