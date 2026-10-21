import { Database } from "@fb/server/database";
import { forms, formVersions } from "@fb/server/testing";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlError } from "effect/sql";
import { describe, expect, test } from "vite-plus/test";

type Services = Database | SqlClient.SqlClient;

const DriverError = Schema.Struct({ code: Schema.String, message: Schema.String });

// The driver's own error, so a test can tell a trigger's rejection from any other failure.
const rejection = <A, R>(statement: Effect.Effect<A, SqlError.SqlError, R>) =>
  statement.pipe(
    Effect.flip,
    Effect.map((error) => Schema.decodeUnknownSync(DriverError)(error.reason.cause)),
  );

const insertForm = (formId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.forms (id, tenant, availability, response_limit, created_at, updated_at)
      VALUES (${formId}, 'acme', 'closed', 'unlimited', now(), now())
    `,
  );

const insertDraft = (formId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.drafts (form_id, definition, updated_at)
      VALUES (${formId}, '{}', now())
    `,
  );

const insertIdentity = (formId: string, questionId: string, type: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.question_identities (form_id, question_id, type)
      VALUES (${formId}, ${questionId}, ${type})
    `,
  );

const insertVersion = (formId: string, versionId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
      VALUES (${versionId}, ${formId}, 1, '{}', now(), 'acme-admin')
    `,
  );

const insertVersionQuestion = (
  formId: string,
  versionId: string,
  questionId: string,
  type: string,
) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.form_version_questions (version_id, question_id, form_id, type, position)
      VALUES (${versionId}, ${questionId}, ${formId}, ${type}, 0)
    `,
  );

// A form published once, with one text question.
const publishedForm = Effect.gen(function* () {
  const formId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  yield* insertForm(formId);
  yield* insertVersion(formId, versionId);
  yield* insertIdentity(formId, questionId, "text");
  yield* insertVersionQuestion(formId, versionId, questionId, "text");
  return { formId, versionId, questionId };
});

const count = (table: string) =>
  SqlClient.SqlClient.use((sql) =>
    sql<{
      count: number;
    }>`SELECT count(*)::int AS count FROM ${sql(`form_management.${table}`)}`.pipe(
      Effect.map(([row]) => row?.count),
    ),
  );

export const describeAuthoringTables = (database: Layer.Layer<Services, unknown>) => {
  const run = <A, E>(effect: Effect.Effect<A, E, Services>) =>
    Effect.runPromise(effect.pipe(Effect.provide(database)));

  test("timestamptz and jsonb values round-trip through Drizzle", async () => {
    const publishedAt = new Date("2026-10-21T01:02:03.456Z");
    const definition = {
      formatVersion: 1,
      title: 'Café ☕ "quoted" \\ back',
      questions: [{ id: crypto.randomUUID(), nested: [1, 2.5, null, true, { deep: "x" }] }],
    };

    const { read, stored } = await run(
      Effect.gen(function* () {
        const db = yield* Database;
        const formId = crypto.randomUUID();
        const versionId = crypto.randomUUID();
        yield* db.insert(forms).values({
          id: formId,
          tenant: "acme",
          availability: "closed",
          responseLimit: "unlimited",
          createdAt: publishedAt,
          updatedAt: publishedAt,
        });
        yield* db.insert(formVersions).values({
          id: versionId,
          formId,
          number: 1,
          definition,
          publishedAt,
          publishedBy: "acme-admin",
        });

        // A session zone with an odd offset, so a codec that ignores the offset would shift the instant.
        const read = yield* db.transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.execute(drizzleSql`SET LOCAL TIME ZONE 'Asia/Kathmandu'`);
            const [row] = yield* tx
              .select({
                definition: formVersions.definition,
                publishedAt: formVersions.publishedAt,
                createdAt: forms.createdAt,
              })
              .from(formVersions)
              .innerJoin(forms, eq(forms.id, formVersions.formId))
              .where(eq(formVersions.id, versionId));
            return row;
          }),
        );

        const sql = yield* SqlClient.SqlClient;
        const [stored] = yield* sql<{ instant: boolean; title: string }>`
          SELECT published_at = '2026-10-21T01:02:03.456Z'::timestamptz AS instant,
                 definition->>'title' AS title
          FROM form_management.form_versions WHERE id = ${versionId}
        `;
        return { read, stored };
      }),
    );

    expect(read).toEqual({ definition, publishedAt, createdAt: publishedAt });
    expect(stored).toEqual({ instant: true, title: definition.title });
  });

  test("deleting a never-published form removes its draft by cascade", async () => {
    const remaining = await run(
      Effect.gen(function* () {
        const formId = crypto.randomUUID();
        yield* insertForm(formId);
        yield* insertDraft(formId);
        const sql = yield* SqlClient.SqlClient;
        yield* sql`DELETE FROM form_management.forms WHERE id = ${formId}`;
        return { forms: yield* count("forms"), drafts: yield* count("drafts") };
      }),
    );

    expect(remaining).toEqual({ forms: 0, drafts: 0 });
  });

  describe("published versions, their question keys and question identities never change", () => {
    type Published = Effect.Success<typeof publishedForm>;
    const forbidden: ReadonlyArray<
      [
        string,
        (sql: SqlClient.SqlClient, form: Published) => Effect.Effect<unknown, SqlError.SqlError>,
      ]
    > = [
      [
        "UPDATE on form_management.form_versions",
        (sql, { versionId }) =>
          sql`UPDATE form_management.form_versions SET published_by = 'someone-else' WHERE id = ${versionId}`,
      ],
      [
        "DELETE on form_management.form_versions",
        (sql, { versionId }) =>
          sql`DELETE FROM form_management.form_versions WHERE id = ${versionId}`,
      ],
      [
        "TRUNCATE on form_management.form_versions",
        (sql) => sql`TRUNCATE form_management.form_versions CASCADE`,
      ],
      [
        "UPDATE on form_management.form_version_questions",
        (sql, { versionId }) =>
          sql`UPDATE form_management.form_version_questions SET position = 1 WHERE version_id = ${versionId}`,
      ],
      [
        "DELETE on form_management.form_version_questions",
        (sql, { versionId }) =>
          sql`DELETE FROM form_management.form_version_questions WHERE version_id = ${versionId}`,
      ],
      [
        "TRUNCATE on form_management.form_version_questions",
        (sql) => sql`TRUNCATE form_management.form_version_questions`,
      ],
      [
        "UPDATE on form_management.question_identities",
        (sql, { questionId }) =>
          sql`UPDATE form_management.question_identities SET type = 'email' WHERE question_id = ${questionId}`,
      ],
      [
        "DELETE on form_management.question_identities",
        (sql, { questionId }) =>
          sql`DELETE FROM form_management.question_identities WHERE question_id = ${questionId}`,
      ],
      [
        "TRUNCATE on form_management.question_identities",
        (sql) => sql`TRUNCATE form_management.question_identities CASCADE`,
      ],
      ["TRUNCATE on form_management.forms", (sql) => sql`TRUNCATE form_management.forms CASCADE`],
    ];

    test.each(forbidden)("a trigger rejects %s", async (operation, statement) => {
      const error = await run(
        Effect.gen(function* () {
          const form = yield* publishedForm;
          const sql = yield* SqlClient.SqlClient;
          return yield* rejection(statement(sql, form));
        }),
      );

      expect(error).toEqual({ code: "23001", message: `${operation} is not allowed` });
    });
  });

  test("a raw DELETE of a published form fails even as the table owner", async () => {
    const { owner, error, remaining } = await run(
      Effect.gen(function* () {
        const { formId } = yield* publishedForm;
        yield* insertDraft(formId);
        const sql = yield* SqlClient.SqlClient;
        const [owner] = yield* sql<{ isOwner: boolean }>`
          SELECT pg_get_userbyid(relowner) = current_user AS "isOwner"
          FROM pg_class WHERE oid = 'form_management.forms'::regclass
        `;
        const error = yield* rejection(sql`DELETE FROM form_management.forms WHERE id = ${formId}`);
        return {
          owner,
          error,
          remaining: { forms: yield* count("forms"), drafts: yield* count("drafts") },
        };
      }),
    );

    expect(owner).toEqual({ isOwner: true });
    expect(error.code).toBe("23001");
    expect(error.message).toMatch(/has a published version and can't be deleted$/);
    expect(remaining).toEqual({ forms: 1, drafts: 1 });
  });

  test("a form's tenant never changes, while its other settings can", async () => {
    const { error, availability } = await run(
      Effect.gen(function* () {
        const { formId, versionId } = yield* publishedForm;
        const sql = yield* SqlClient.SqlClient;
        const error = yield* rejection(
          sql`UPDATE form_management.forms SET tenant = 'globex' WHERE id = ${formId}`,
        );
        const [row] = yield* sql<{ availability: string }>`
          UPDATE form_management.forms SET availability = 'open', current_version_id = ${versionId}
          WHERE id = ${formId} RETURNING availability
        `;
        return { error, availability: row?.availability };
      }),
    );

    expect(error).toEqual({ code: "23001", message: "a form's tenant never changes" });
    expect(availability).toBe("open");
  });

  describe("one question type per question identity", () => {
    test("an identity can't be inserted again with another type", async () => {
      const error = await run(
        Effect.gen(function* () {
          const formId = crypto.randomUUID();
          const questionId = crypto.randomUUID();
          yield* insertForm(formId);
          yield* insertIdentity(formId, questionId, "text");
          return yield* rejection(insertIdentity(formId, questionId, "email"));
        }),
      );

      expect(error.code).toBe("23505");
      expect(error.message).toContain("question_identities_pkey");
    });

    test("a version can't use an identity under another type", async () => {
      const error = await run(
        Effect.gen(function* () {
          const { formId } = yield* publishedForm;
          const versionId = crypto.randomUUID();
          const questionId = crypto.randomUUID();
          const sql = yield* SqlClient.SqlClient;
          yield* sql`
            INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
            VALUES (${versionId}, ${formId}, 2, '{}', now(), 'acme-admin')
          `;
          yield* insertIdentity(formId, questionId, "text");
          return yield* rejection(insertVersionQuestion(formId, versionId, questionId, "email"));
        }),
      );

      expect(error.code).toBe("23503");
    });
  });
};
