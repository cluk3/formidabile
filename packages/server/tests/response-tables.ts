import { Database } from "@fb/server/database";
import { Effect, Layer, Schema } from "effect";
import { SqlClient, SqlError } from "effect/sql";
import { describe, expect, test } from "vite-plus/test";

type Services = Database | SqlClient.SqlClient;

const DriverError = Schema.Struct({ code: Schema.String, message: Schema.String });

// The driver's own error, so a test can tell which constraint or trigger rejected a statement.
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

const insertVersion = (formId: string, versionId: string, number: number) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
      VALUES (${versionId}, ${formId}, ${number}, '{}', now(), 'acme-admin')
    `,
  );

const insertQuestion = (formId: string, versionId: string, questionId: string) =>
  SqlClient.SqlClient.use((sql) =>
    sql`
      INSERT INTO form_management.question_identities (form_id, question_id, type)
      VALUES (${formId}, ${questionId}, 'text')
      ON CONFLICT DO NOTHING
    `.pipe(
      Effect.andThen(
        sql`
          INSERT INTO form_management.form_version_questions (version_id, question_id, form_id, type, position)
          VALUES (${versionId}, ${questionId}, ${formId}, 'text', 0)
        `,
      ),
    ),
  );

// A form published once, with one text question.
const publishedForm = Effect.gen(function* () {
  const formId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  yield* insertForm(formId);
  yield* insertVersion(formId, versionId, 1);
  yield* insertQuestion(formId, versionId, questionId);
  return { formId, versionId, questionId };
});

interface ResponseRow {
  readonly formId: string;
  readonly versionId: string;
  readonly respondentId?: string | null;
  readonly limited?: boolean;
  readonly idempotencyKey?: string;
}

const insertResponse = ({
  formId,
  versionId,
  respondentId = "alice",
  limited = false,
  idempotencyKey = crypto.randomUUID(),
}: ResponseRow) =>
  SqlClient.SqlClient.use((sql) => {
    const responseId = crypto.randomUUID();
    return sql`
      INSERT INTO form_management.responses
        (id, form_id, version_id, respondent_id, limited, revision, idempotency_key, submitted_at)
      VALUES (${responseId}, ${formId}, ${versionId}, ${respondentId}, ${limited}, 1, ${idempotencyKey}, now())
    `.pipe(Effect.as(responseId));
  });

const insertAnswer = (responseId: string, versionId: string, questionId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.answers (response_id, question_id, version_id, value)
      VALUES (${responseId}, ${questionId}, ${versionId}, '"an answer"')
    `,
  );

const insertFormRef = (formId: string, namespace: string, refId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.form_external_refs (form_id, namespace, ref_id)
      VALUES (${formId}, ${namespace}, ${refId})
    `,
  );

const insertResponseRef = (responseId: string, namespace: string, refId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.response_external_refs (response_id, namespace, ref_id)
      VALUES (${responseId}, ${namespace}, ${refId})
    `,
  );

const countFormRefs = (formId: string) =>
  SqlClient.SqlClient.use((sql) =>
    sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.form_external_refs WHERE form_id = ${formId}
    `.pipe(Effect.map(([row]) => row?.count ?? 0)),
  );

const countResponses = (formId: string) =>
  SqlClient.SqlClient.use((sql) =>
    sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.responses WHERE form_id = ${formId}
    `.pipe(Effect.map(([row]) => row?.count ?? 0)),
  );

export const describeResponseTables = (database: Layer.Layer<Services, unknown>) => {
  const run = <A, E>(effect: Effect.Effect<A, E, Services>) =>
    Effect.runPromise(effect.pipe(Effect.provide(database)));

  test("an answer must be to a question in its response's version", async () => {
    const { outsideVersion, otherVersion } = await run(
      Effect.gen(function* () {
        const { formId, versionId, questionId } = yield* publishedForm;
        const laterVersionId = crypto.randomUUID();
        const laterQuestionId = crypto.randomUUID();
        yield* insertVersion(formId, laterVersionId, 2);
        yield* insertQuestion(formId, laterVersionId, laterQuestionId);
        const responseId = yield* insertResponse({ formId, versionId });

        yield* insertAnswer(responseId, versionId, questionId);
        return {
          // The question exists, but only in version 2.
          outsideVersion: yield* rejection(insertAnswer(responseId, versionId, laterQuestionId)),
          // Version 2 has the question, but the response is on version 1.
          otherVersion: yield* rejection(insertAnswer(responseId, laterVersionId, laterQuestionId)),
        };
      }),
    );

    expect(outsideVersion.code).toBe("23503");
    expect(outsideVersion.message).toContain("answers_question_fkey");
    expect(otherVersion.code).toBe("23503");
    expect(otherVersion.message).toContain("answers_response_fkey");
  });

  describe("one response per respondent on limited forms", () => {
    test("a second limited response by the same respondent is rejected", async () => {
      const { error, otherForm } = await run(
        Effect.gen(function* () {
          const form = yield* publishedForm;
          const other = yield* publishedForm;
          yield* insertResponse({ ...form, limited: true });
          return {
            error: yield* rejection(insertResponse({ ...form, limited: true })),
            otherForm: yield* insertResponse({ ...other, limited: true }),
          };
        }),
      );

      expect(error.code).toBe("23505");
      expect(error.message).toContain("responses_one_per_respondent");
      expect(otherForm).toEqual(expect.any(String));
    });

    test("duplicates collected while unlimited stay, and still leave room for one limited response", async () => {
      const { error, responses } = await run(
        Effect.gen(function* () {
          const form = yield* publishedForm;
          yield* insertResponse(form);
          yield* insertResponse(form);
          yield* insertResponse({ ...form, limited: true });
          return {
            error: yield* rejection(insertResponse({ ...form, limited: true })),
            responses: yield* countResponses(form.formId),
          };
        }),
      );

      expect(error.message).toContain("responses_one_per_respondent");
      expect(responses).toBe(3);
    });

    test("a limited response needs an identified respondent", async () => {
      const error = await run(
        Effect.gen(function* () {
          const form = yield* publishedForm;
          return yield* rejection(insertResponse({ ...form, respondentId: null, limited: true }));
        }),
      );

      expect(error.code).toBe("23514");
      expect(error.message).toContain("responses_limited_needs_respondent_check");
    });
  });

  describe("one response per idempotency key", () => {
    test("a key is unique per form and respondent, anonymous respondents included", async () => {
      const { identified, anonymous, responses } = await run(
        Effect.gen(function* () {
          const form = yield* publishedForm;
          const other = yield* publishedForm;
          const idempotencyKey = crypto.randomUUID();
          yield* insertResponse({ ...form, idempotencyKey });
          yield* insertResponse({ ...form, respondentId: "bob", idempotencyKey });
          yield* insertResponse({ ...form, respondentId: null, idempotencyKey });
          yield* insertResponse({ ...other, idempotencyKey });
          return {
            identified: yield* rejection(insertResponse({ ...form, idempotencyKey })),
            anonymous: yield* rejection(
              insertResponse({ ...form, respondentId: null, idempotencyKey }),
            ),
            responses: (yield* countResponses(form.formId)) + (yield* countResponses(other.formId)),
          };
        }),
      );

      expect(identified.code).toBe("23505");
      expect(identified.message).toContain("responses_idempotency_key_unique");
      expect(anonymous.code).toBe("23505");
      expect(anonymous.message).toContain("responses_idempotency_key_unique");
      expect(responses).toBe(4);
    });

    test("a response can't be stored without a key", async () => {
      const error = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* publishedForm;
          const sql = yield* SqlClient.SqlClient;
          return yield* rejection(sql`
            INSERT INTO form_management.responses
              (id, form_id, version_id, respondent_id, limited, revision, submitted_at)
            VALUES (${crypto.randomUUID()}, ${formId}, ${versionId}, 'alice', false, 1, now())
          `);
        }),
      );

      expect(error.code).toBe("23502");
      expect(error.message).toContain("idempotency_key");
    });
  });

  describe("a response's fixed columns", () => {
    const changes: ReadonlyArray<
      readonly [
        column: string,
        change: (
          sql: SqlClient.SqlClient,
          response: { readonly responseId: string; readonly otherVersionId: string },
        ) => Effect.Effect<unknown, SqlError.SqlError>,
      ]
    > = [
      [
        "id",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET id = ${crypto.randomUUID()} WHERE id = ${responseId}`,
      ],
      [
        "form_id",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET form_id = ${crypto.randomUUID()} WHERE id = ${responseId}`,
      ],
      [
        "version_id",
        (sql, { responseId, otherVersionId }) =>
          sql`UPDATE form_management.responses SET version_id = ${otherVersionId} WHERE id = ${responseId}`,
      ],
      [
        "respondent_id",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET respondent_id = 'bob' WHERE id = ${responseId}`,
      ],
      [
        "limited",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET limited = true WHERE id = ${responseId}`,
      ],
      [
        "idempotency_key",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET idempotency_key = ${crypto.randomUUID()} WHERE id = ${responseId}`,
      ],
      [
        "submitted_at",
        (sql, { responseId }) =>
          sql`UPDATE form_management.responses SET submitted_at = now() + interval '1 day' WHERE id = ${responseId}`,
      ],
    ];

    test.each(changes)("a trigger rejects changing %s", async (column, change) => {
      const error = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* publishedForm;
          // Version 2 of the same form, so only the trigger stands in the way of moving to it.
          const otherVersionId = crypto.randomUUID();
          yield* insertVersion(formId, otherVersionId, 2);
          const responseId = yield* insertResponse({ formId, versionId });
          const sql = yield* SqlClient.SqlClient;
          return yield* rejection(change(sql, { responseId, otherVersionId }));
        }),
      );

      expect(error).toEqual({ code: "23001", message: `responses.${column} never changes` });
    });

    test("an edit can change the revision and the edit time, and rewrite the answers", async () => {
      const edited = await run(
        Effect.gen(function* () {
          const { formId, versionId, questionId } = yield* publishedForm;
          const responseId = yield* insertResponse({ formId, versionId });
          yield* insertAnswer(responseId, versionId, questionId);
          const sql = yield* SqlClient.SqlClient;
          yield* sql`DELETE FROM form_management.answers WHERE response_id = ${responseId}`;
          yield* insertAnswer(responseId, versionId, questionId);
          const [row] = yield* sql<{ revision: number; edited: boolean }>`
            UPDATE form_management.responses
            SET revision = revision + 1, edited_at = now(), form_id = form_id, version_id = version_id
            WHERE id = ${responseId}
            RETURNING revision, edited_at IS NOT NULL AS edited
          `;
          return row;
        }),
      );

      expect(edited).toEqual({ revision: 2, edited: true });
    });

    test("a trigger rejects changing a response's stored references", async () => {
      const error = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* publishedForm;
          const responseId = yield* insertResponse({ formId, versionId });
          yield* insertResponseRef(responseId, "project", "p-1");
          const sql = yield* SqlClient.SqlClient;
          return yield* rejection(
            sql`UPDATE form_management.response_external_refs SET ref_id = 'p-2' WHERE response_id = ${responseId}`,
          );
        }),
      );

      expect(error).toEqual({
        code: "23001",
        message: "UPDATE on form_management.response_external_refs is not allowed",
      });
    });
  });

  describe("external references", () => {
    test("deleting a never-published form removes its references by cascade", async () => {
      const { remaining, kept } = await run(
        Effect.gen(function* () {
          const formId = crypto.randomUUID();
          const published = yield* publishedForm;
          yield* insertForm(formId);
          yield* insertFormRef(formId, "project", "p-1");
          yield* insertFormRef(formId, "crm.account", "a-1");
          yield* insertFormRef(published.formId, "project", "p-1");
          const sql = yield* SqlClient.SqlClient;
          yield* sql`DELETE FROM form_management.forms WHERE id = ${formId}`;
          return {
            remaining: yield* countFormRefs(formId),
            kept: yield* countFormRefs(published.formId),
          };
        }),
      );

      expect(remaining).toBe(0);
      expect(kept).toBe(1);
    });

    test("deleting responses removes their answers and references by cascade, without firing any immutability trigger", async () => {
      const { remaining, publisherChange } = await run(
        Effect.gen(function* () {
          const { formId, versionId, questionId } = yield* publishedForm;
          const responseIds = [
            yield* insertResponse({ formId, versionId }),
            yield* insertResponse({ formId, versionId, respondentId: "bob" }),
          ];
          for (const responseId of responseIds) {
            yield* insertAnswer(responseId, versionId, questionId);
            yield* insertResponseRef(responseId, "project", "p-1");
          }
          const sql = yield* SqlClient.SqlClient;
          // The version's last responses, as an erasure would delete them.
          yield* sql`DELETE FROM form_management.responses WHERE form_id = ${formId}`;
          const [remaining] = yield* sql<Record<string, number>>`
            SELECT
              (SELECT count(*)::int FROM form_management.responses WHERE form_id = ${formId}) AS responses,
              (SELECT count(*)::int FROM form_management.answers WHERE response_id IN ${sql.in(responseIds)}) AS answers,
              (SELECT count(*)::int FROM form_management.response_external_refs WHERE response_id IN ${sql.in(responseIds)}) AS refs,
              (SELECT count(*)::int FROM form_management.form_versions WHERE id = ${versionId}) AS versions,
              (SELECT count(*)::int FROM form_management.form_version_questions WHERE version_id = ${versionId}) AS "questionKeys"
          `;
          return {
            remaining,
            publisherChange: yield* rejection(
              sql`UPDATE form_management.form_versions SET published_by = 'erased' WHERE id = ${versionId}`,
            ),
          };
        }),
      );

      expect(remaining).toEqual({
        responses: 0,
        answers: 0,
        refs: 0,
        versions: 1,
        questionKeys: 1,
      });
      expect(publisherChange).toEqual({
        code: "23001",
        message: "UPDATE on form_management.form_versions is not allowed",
      });
    });

    test.each([
      ["an empty namespace", "", "r-1", "namespace_check"],
      ["a namespace of 65 characters", "a".repeat(65), "r-1", "namespace_check"],
      ["a namespace starting with a digit", "1project", "r-1", "namespace_check"],
      ["an uppercase namespace", "Project", "r-1", "namespace_check"],
      ["an empty reference id", "project", "", "ref_id_check"],
      ["a reference id of 256 code points", "project", "☕".repeat(256), "ref_id_check"],
    ])("a reference with %s is rejected", async (_, namespace, refId, constraint) => {
      const { formRef, responseRef } = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* publishedForm;
          const responseId = yield* insertResponse({ formId, versionId });
          return {
            formRef: yield* rejection(insertFormRef(formId, namespace, refId)),
            responseRef: yield* rejection(insertResponseRef(responseId, namespace, refId)),
          };
        }),
      );

      expect(formRef.code).toBe("23514");
      expect(formRef.message).toContain(`form_external_refs_${constraint}`);
      expect(responseRef.code).toBe("23514");
      expect(responseRef.message).toContain(`response_external_refs_${constraint}`);
    });

    test("references at the shape limits are stored", async () => {
      const stored = await run(
        Effect.gen(function* () {
          const { formId, versionId } = yield* publishedForm;
          const responseId = yield* insertResponse({ formId, versionId });
          const namespace = `a${"z0_.-".repeat(12)}abc`;
          yield* insertFormRef(formId, namespace, "☕".repeat(255));
          yield* insertResponseRef(responseId, namespace, "☕".repeat(255));
          return yield* countFormRefs(formId);
        }),
      );

      expect(stored).toBe(1);
    });
  });
};
