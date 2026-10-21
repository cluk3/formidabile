import { createFormApiClient, type FormApiClient } from "@fb/api-client";
import { createFormModuleHandler, declareLength } from "@fb/http-api/web";
import { Actor, type ExternalRef, TenantId } from "@fb/server/actor";
import { Database } from "@fb/server/database";
import { DatabaseTest } from "@fb/server/testing";
import { Context, Effect, Layer, ManagedRuntime, Option } from "effect";
import { SqlClient } from "effect/sql";
import type { JWTPayload } from "jose";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { baseUrl, devUsers, jwt, signToken } from "./api.ts";

// One database behind the JWT handler and a custom resolver's, so the test can read what either stored.
const database = ManagedRuntime.make(DatabaseTest);
let viaJwt: ReturnType<typeof createFormModuleHandler>;
let viaResolver: ReturnType<typeof createFormModuleHandler>;
let resolved: Actor | null = null;

beforeAll(async () => {
  const shared = Layer.succeed(Database, Context.get(await database.context(), Database));
  viaJwt = createFormModuleHandler({ database: shared, jwt });
  viaResolver = createFormModuleHandler({ database: shared, resolveActor: async () => resolved });
});

afterAll(async () => {
  await viaJwt.dispose();
  await viaResolver.dispose();
  await database.dispose();
});

const clientOf = (
  handler: () => ReturnType<typeof createFormModuleHandler>,
  getToken: () => Promise<string | null> | null,
): FormApiClient =>
  createFormApiClient({
    baseUrl,
    getToken,
    fetch: async (request) => handler().fetch(await declareLength(request)),
  });

const as = (claims: JWTPayload) =>
  clientOf(
    () => viaJwt,
    () => signToken(claims),
  );
const admin = as(devUsers["acme-admin"]);
const alice = { sub: "alice", tenant: "acme", capabilities: [] };

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";
const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    { id: readyId, type: "boolean" as const, label: "Ready?", required: true, config: {} },
  ],
});
const answers = { [readyId]: true };

/** An open, unlimited form in `acme` with one published version. */
const openForm = async (title = "Survey") => {
  const created = await admin.POST("/forms", { body: { definition: definition(title) } });
  const { form, draft } = created.data!;
  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId: form.id } },
    body: { expectedRevision: draft.revision },
  });
  await admin.PATCH("/forms/{formId}", {
    params: { path: { formId: form.id } },
    body: { availability: "open" },
  });
  return { formId: form.id, versionId: published.data!.version.id };
};

const load = (client: FormApiClient, formId: string) =>
  client.GET("/respond/forms/{formId}", { params: { path: { formId } } });

const submit = (
  client: FormApiClient,
  form: { formId: string; versionId: string },
  body: Record<string, unknown> = {},
) =>
  client.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: {
      versionId: form.versionId,
      answers,
      idempotencyKey: crypto.randomUUID(),
      ...body,
    } as never,
  });

const query = <A>(statement: (sql: SqlClient.SqlClient) => Effect.Effect<A, unknown>) =>
  database.runPromise(SqlClient.SqlClient.use(statement).pipe(Effect.orDie));

const storedRefs = (responseId: string) =>
  query(
    (sql) => sql<ExternalRef>`
      SELECT namespace, ref_id AS "refId" FROM form_management.response_external_refs
      WHERE response_id = ${responseId} ORDER BY namespace, ref_id
    `,
  );

const responseCount = (formId: string) =>
  query(
    (sql) => sql<{ count: number }>`
      SELECT count(*)::int AS count FROM form_management.responses WHERE form_id = ${formId}
    `,
  ).then(([row]) => row!.count);

describe("load", () => {
  test("gives the current published version and who is responding", async () => {
    const form = await openForm("Loaded");

    const { data, response } = await load(as(alice), form.formId);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      formId: form.formId,
      responseLimit: "unlimited",
      respondent: "identified",
      version: { id: form.versionId, number: 1, definition: definition("Loaded") },
      myResponseId: null,
    });
  });
});

describe("submit", () => {
  test("stores a response and gives 201 with its id and revision", async () => {
    const form = await openForm();
    const key = crypto.randomUUID();

    const { data, response } = await submit(as(alice), form, { idempotencyKey: key });
    const [stored] = await query(
      (sql) => sql<{ idempotencyKey: string }>`
        SELECT idempotency_key AS "idempotencyKey" FROM form_management.responses
        WHERE id = ${data!.responseId}
      `,
    );

    expect(response.status).toBe(201);
    expect(data).toEqual({ responseId: expect.any(String), revision: "1" });
    expect(stored).toEqual({ idempotencyKey: key });
  });

  test("a replay gives a 201 body identical to the original, and stores nothing more", async () => {
    const form = await openForm();
    const body = { idempotencyKey: crypto.randomUUID() };
    const send = () =>
      as(alice).POST("/respond/forms/{formId}/responses", {
        params: { path: { formId: form.formId } },
        body: { versionId: form.versionId, answers, ...body },
        parseAs: "text",
      });

    const original = await send();
    const replayed = await send();

    expect(original.response.status).toBe(201);
    expect(replayed.response.status).toBe(201);
    expect(replayed.data).toBe(original.data);
    expect(await responseCount(form.formId)).toBe(1);
  });

  test("externalRefs in the body gives 422, and nothing is stored", async () => {
    const form = await openForm();

    const { error, response } = await submit(as(alice), form, {
      externalRefs: [{ namespace: "project", refId: "apollo" }],
    });

    expect(response.status).toBe(422);
    expect(error).toMatchObject({ _tag: "ValidationFailed" });
    expect(await responseCount(form.formId)).toBe(0);
  });

  test.each([
    ["missing", undefined],
    ["malformed", "not-a-uuid"],
  ])("a %s idempotencyKey gives 422", async (_, idempotencyKey) => {
    const form = await openForm();

    const { error, response } = await submit(as(alice), form, { idempotencyKey });

    expect(response.status).toBe(422);
    expect(error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: ["idempotencyKey"] }],
    });
    expect(await responseCount(form.formId)).toBe(0);
  });

  test("against a superseded version gives 409 VersionSuperseded with the current version", async () => {
    const form = await openForm();
    const { data: draft } = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.formId } },
      body: { expectedRevision: null, definition: definition("Revised") },
    });
    const { data: v2 } = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.formId } },
      body: { expectedRevision: draft!.revision },
    });

    const { error, response } = await submit(as(alice), form);

    expect(response.status).toBe(409);
    expect(error).toEqual({ _tag: "VersionSuperseded", currentVersionId: v2!.version.id });
  });

  test("a respondent from another tenant gets 404", async () => {
    const form = await openForm();

    const { error, response } = await submit(as({ ...alice, tenant: "globex" }), form);

    expect(response.status).toBe(404);
    expect(error).toEqual({ _tag: "NotFound" });
    expect(await responseCount(form.formId)).toBe(0);
  });

  test("a submit declaring 1 MiB plus one byte gives 413", async () => {
    const form = await openForm();
    const response = await viaJwt.fetch(
      new Request(`${baseUrl}/respond/forms/${form.formId}/responses`, {
        method: "POST",
        body: "{}",
        headers: {
          authorization: `Bearer ${await signToken(alice)}`,
          "content-type": "application/json",
          "content-length": String(1024 * 1024 + 1),
        },
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ _tag: "PayloadTooLarge", limit: 1024 * 1024 });
  });
});

describe("references and the form binding", () => {
  const refs = [
    { namespace: "crm.account", refId: "A-1" },
    { namespace: "project", refId: "apollo" },
  ];

  test("a token with form and refs submits, and the references are stored", async () => {
    const form = await openForm();

    const { data, response } = await submit(as({ ...alice, form: form.formId, refs }), form);

    expect(response.status).toBe(201);
    expect(await storedRefs(data!.responseId)).toEqual(refs);
  });

  test("an identified token bound to form A gets 404 on form B's load and submit", async () => {
    const a = await openForm("A");
    const b = await openForm("B");
    const boundToA = as({ ...alice, form: a.formId, refs });

    const loaded = await load(boundToA, b.formId);
    const submitted = await submit(boundToA, b);

    expect(loaded.response.status).toBe(404);
    expect(loaded.error).toEqual({ _tag: "NotFound" });
    expect(submitted.response.status).toBe(404);
    expect(submitted.error).toEqual({ _tag: "NotFound" });
    expect(await responseCount(b.formId)).toBe(0);
    expect((await load(boundToA, a.formId)).response.status).toBe(200);
  });

  test("a custom resolver returning refs gets them stored", async () => {
    const form = await openForm();
    resolved = Actor.Identified({
      subject: "alice",
      tenant: TenantId.make("acme"),
      capabilities: [],
      formId: Option.some(form.formId),
      refs,
    });

    const { data, response } = await submit(
      clientOf(
        () => viaResolver,
        () => null,
      ),
      form,
    );

    expect(response.status).toBe(201);
    expect(await storedRefs(data!.responseId)).toEqual(refs);
  });
});
