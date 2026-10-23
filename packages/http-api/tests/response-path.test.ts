import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import { createFormModuleHandler, declareLength } from "@fb/http-api/web";
import { Database } from "@fb/server/database";
import { DatabaseTest } from "@fb/server/testing";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { SqlClient } from "effect/sql";
import type { JWTPayload } from "jose";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { baseUrl, devUsers, jwt, signToken } from "./api.ts";

const database = ManagedRuntime.make(DatabaseTest);
let handler: ReturnType<typeof createFormModuleHandler>;

beforeAll(async () => {
  const shared = Layer.succeed(Database, Context.get(await database.context(), Database));
  handler = createFormModuleHandler({ database: shared, jwt });
});

afterAll(async () => {
  await handler.dispose();
  await database.dispose();
});

const clientOf = (getToken: () => Promise<string | null> | null): FormApiClient =>
  createFormApiClient({
    baseUrl,
    getToken,
    fetch: async (request) => handler.fetch(await declareLength(request)),
  });

const as = (claims: JWTPayload) => clientOf(() => signToken(claims));
const admin = clientOf(() => signToken(devUsers["acme-admin"]));
const respondent = (sub: string) => as({ sub, tenant: "acme", capabilities: [] });

const gateId = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000002";
const consentId = "00000000-0000-4000-8000-000000000003";

const text = (id: string, label: string, required: boolean) => ({
  id,
  type: "text" as const,
  label,
  required,
  config: { display: "single_line" as const },
});

/** Gate is always shown. The note is optional and always shown. Consent is required only when the gate is "yes". */
const definition = {
  format: 2 as const,
  title: "Conditional",
  pages: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      questions: [text(gateId, "Gate", true)],
      jumps: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000011",
      questions: [
        text(noteId, "Note", false),
        {
          id: consentId,
          type: "boolean" as const,
          label: "Consent",
          required: true,
          config: { mustBeYes: true },
          showCondition: { questionId: gateId, operator: "equals", constant: "yes" },
        },
      ],
      jumps: [],
    },
  ],
};

const plain = {
  format: 1 as const,
  title: "Plain",
  questions: [text(gateId, "Name", true), text(noteId, "Note", false)],
};

const openForm = async (body: object = definition) => {
  const created = await admin.POST("/forms", { body: { definition: body as never } });
  const formId = created.data!.form.id;
  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId } },
    body: { expectedRevision: created.data!.draft.revision },
  });
  await admin.PATCH("/forms/{formId}", {
    params: { path: { formId } },
    body: { availability: "open" },
  });
  return { formId, versionId: published.data!.version.id };
};

const submit = (
  who: FormApiClient,
  form: { formId: string; versionId: string },
  answers: Record<string, string | boolean>,
) =>
  who.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: { versionId: form.versionId, answers, idempotencyKey: crypto.randomUUID() },
  });

const edit = (
  who: FormApiClient,
  responseId: string,
  answers: Record<string, string | boolean>,
  expectedRevision = "1",
) =>
  who.PUT("/respond/responses/{responseId}", {
    params: { path: { responseId } },
    body: { expectedRevision, answers },
  });

const read = (responseId: string) =>
  admin.GET("/responses/{responseId}", { params: { path: { responseId } } });

const query = <A>(statement: (sql: SqlClient.SqlClient) => Effect.Effect<A, unknown>) =>
  database.runPromise(SqlClient.SqlClient.use(statement).pipe(Effect.orDie));

const storedPath = (responseId: string) =>
  query(
    (sql) => sql<{ questionId: string }>`
      SELECT path.question_id AS "questionId"
      FROM form_management.response_path AS path
      INNER JOIN form_management.form_version_questions AS question
        ON question.version_id = path.version_id AND question.question_id = path.question_id
      WHERE path.response_id = ${responseId}
      ORDER BY question.position, path.question_id
    `,
  ).then((rows) => rows.map((row) => row.questionId));

const pathCount = (responseId: string) =>
  query(
    (sql) => sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.response_path WHERE response_id = ${responseId}
    `,
  ).then(([row]) => row?.count ?? 0);

describe("the stored path", () => {
  test("a format-1 response is shown every question of its version, including one left unanswered", async () => {
    const form = await openForm(plain);
    const sent = await submit(respondent("ada"), form, { [gateId]: "Ada" });

    expect(sent.response.status).toBe(201);
    const responseId = sent.data!.responseId;
    expect(await storedPath(responseId)).toEqual([gateId, noteId]);
    expect((await read(responseId)).data?.path).toEqual([gateId, noteId]);
  });

  test("submit stores the questions on the path, and a required hidden question does not block", async () => {
    const form = await openForm();
    const sent = await submit(respondent("bea"), form, { [gateId]: "no" });

    expect(sent.response.status).toBe(201);
    const responseId = sent.data!.responseId;
    const detail = await read(responseId);

    expect(detail.response.status).toBe(200);
    expect(detail.data?.path).toEqual([gateId, noteId]);
    expect(detail.data?.response.answers).toEqual({ [gateId]: "no" });
    expect(await storedPath(responseId)).toEqual([gateId, noteId]);
  });

  test("a question whose condition holds is on the path, and an unanswered question on the path is kept", async () => {
    const form = await openForm();
    const sent = await submit(respondent("cara"), form, { [gateId]: "yes", [consentId]: true });

    expect(sent.response.status).toBe(201);
    const responseId = sent.data!.responseId;
    expect((await read(responseId)).data?.path).toEqual([gateId, noteId, consentId]);
    expect(await storedPath(responseId)).toEqual([gateId, noteId, consentId]);
  });

  test("submit rejects an off-path answer with 422 ValidationFailed and stores nothing", async () => {
    const form = await openForm();
    const sent = await submit(respondent("dora"), form, { [gateId]: "no", [consentId]: true });

    expect(sent.response.status).toBe(422);
    expect(sent.error).toMatchObject({ _tag: "ValidationFailed" });
    expect(JSON.stringify(sent.error)).toContain(consentId);
    expect(
      await query(
        (sql) => sql<{ count: number }>`
          SELECT count(*)::int AS count FROM form_management.responses WHERE form_id = ${form.formId}
        `,
      ).then(([row]) => row?.count ?? 0),
    ).toBe(0);
  });

  test("edit replaces the path in the same change as the answers, and an off-path edit leaves both", async () => {
    const form = await openForm();
    const who = respondent("eden");
    const sent = await submit(who, form, { [gateId]: "yes", [consentId]: true });
    const responseId = sent.data!.responseId;

    const rejected = await edit(who, responseId, { [gateId]: "no", [consentId]: true });
    expect(rejected.response.status).toBe(422);
    expect(rejected.error).toMatchObject({ _tag: "ValidationFailed" });
    expect(await storedPath(responseId)).toEqual([gateId, noteId, consentId]);
    const unchanged = await who.GET("/respond/responses/{responseId}", {
      params: { path: { responseId } },
    });
    expect(unchanged.data?.response.revision).toBe("1");
    expect(unchanged.data?.response.answers).toEqual({ [gateId]: "yes", [consentId]: true });

    const edited = await edit(who, responseId, { [gateId]: "no" });
    expect(edited.response.status).toBe(200);
    expect(edited.data?.revision).toBe("2");
    const detail = await read(responseId);
    expect(detail.data?.path).toEqual([gateId, noteId]);
    expect(detail.data?.response.answers).toEqual({ [gateId]: "no" });
    expect(await storedPath(responseId)).toEqual([gateId, noteId]);
  });

  test("deleting a response and erasing a respondent remove the stored path", async () => {
    const form = await openForm();
    const kept = await submit(respondent("kept-path"), form, { [gateId]: "no" });
    const dropped = await submit(respondent("dropped-path"), form, { [gateId]: "no" });
    const keptId = kept.data!.responseId;
    const droppedId = dropped.data!.responseId;

    const deleted = await admin.DELETE("/responses/{responseId}", {
      params: { path: { responseId: droppedId } },
    });
    expect(deleted.response.status).toBe(204);
    expect(await pathCount(droppedId)).toBe(0);
    expect(await pathCount(keptId)).toBe(2);

    const erased = await admin.DELETE("/respondents/{respondentId}/responses", {
      params: { path: { respondentId: "kept-path" } },
    });
    expect(erased.response.status).toBe(200);
    expect(erased.data).toEqual({ deleted: 1 });
    expect(await pathCount(keptId)).toBe(0);
  });
});
