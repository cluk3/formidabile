import { Effect, Schema } from "effect";
import { SqlClient, SqlError } from "effect/sql";

const DriverError = Schema.Struct({ code: Schema.String, message: Schema.String });

/** The driver's own error, so a test can tell a trigger's rejection from any other failure. */
export const rejection = <A, R>(statement: Effect.Effect<A, SqlError.SqlError, R>) =>
  statement.pipe(
    Effect.flip,
    Effect.map((error) => Schema.decodeUnknownSync(DriverError)(error.reason.cause)),
  );

export const insertForm = (formId: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.forms (id, tenant, availability, response_limit, created_at, updated_at)
      VALUES (${formId}, 'acme', 'closed', 'unlimited', now(), now())
    `,
  );

export const insertVersion = (formId: string, versionId: string, number = 1) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.form_versions (id, form_id, number, definition, published_at, published_by)
      VALUES (${versionId}, ${formId}, ${number}, '{}', now(), 'acme-admin')
    `,
  );

export const insertIdentity = (formId: string, questionId: string, type: string) =>
  SqlClient.SqlClient.use(
    (sql) => sql`
      INSERT INTO form_management.question_identities (form_id, question_id, type)
      VALUES (${formId}, ${questionId}, ${type})
    `,
  );

export const insertVersionQuestion = (
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

/** A form published once, with one text question. */
export const publishedForm = Effect.gen(function* () {
  const formId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const questionId = crypto.randomUUID();
  yield* insertForm(formId);
  yield* insertVersion(formId, versionId);
  yield* insertIdentity(formId, questionId, "text");
  yield* insertVersionQuestion(formId, versionId, questionId, "text");
  return { formId, versionId, questionId };
});
