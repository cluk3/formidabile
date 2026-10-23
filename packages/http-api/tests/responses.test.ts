import type { FormApiClient } from "@fb/api-client";
import type { JWTPayload } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { type DevUser, signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const as = (claims: JWTPayload) => api.clientWithToken(() => signToken(claims));

/** A respondent of its own, so tests sharing the database never see each other's responses. */
const newRespondent = (tenant = "acme") => ({
  sub: `respondent-${crypto.randomUUID()}`,
  tenant,
  capabilities: [],
});

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";
const colourId = "0192f5a0-7c3e-7b1a-9d2e-000000000003";

const ready = { id: readyId, type: "boolean", label: "Ready?", required: true, config: {} };
const colour = (green: string) => ({
  id: colourId,
  type: "single_choice",
  label: "Colour",
  required: true,
  config: {
    display: "radio",
    options: [
      { value: "red", label: "Red" },
      { value: "green", label: green },
    ],
  },
});
const definition = (title: string, questions: ReadonlyArray<object> = [ready]) => ({
  format: 1 as const,
  title,
  questions,
});

/** Saves and publishes `next` as the form's next version. */
const publish = async (client: FormApiClient, formId: string, next: object) => {
  const { data: current } = await client.GET("/forms/{formId}/draft", {
    params: { path: { formId } },
  });
  const { data: draft } = await client.PUT("/forms/{formId}/draft", {
    params: { path: { formId } },
    body: { expectedRevision: current?.draft?.revision ?? null, definition: next as never },
  });
  const { data } = await client.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId } },
    body: { expectedRevision: draft!.revision },
  });
  return data!.version;
};

/** An open, unlimited form with one published version. */
const openForm = async (owner: DevUser = "acme-admin", first: object = definition("Survey")) => {
  const client = api.clientAs(owner);
  const { data } = await client.POST("/forms", { body: { definition: first as never } });
  const formId = data!.form.id;
  const v1 = await publish(client, formId, first);
  await client.PATCH("/forms/{formId}", {
    params: { path: { formId } },
    body: { availability: "open" },
  });
  return { formId, v1 };
};

const submit = async (
  claims: JWTPayload,
  form: { formId: string; v1: { id: string } },
  answers: Record<string, string | boolean> = { [readyId]: true },
) => {
  const { data, response } = await as(claims).POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: { versionId: form.v1.id, answers, idempotencyKey: crypto.randomUUID() },
  });
  if (data === undefined) throw new Error(`submit gave ${response.status}`);
  return data.responseId;
};

interface ListQuery {
  formId?: string;
  versionId?: string;
  refNamespace?: string;
  refId?: string;
  respondentId?: string;
  cursor?: string;
  limit?: number;
}

const list = (query: ListQuery, user: DevUser = "acme-admin") =>
  api.clientAs(user).GET("/responses", { params: { query } });

const listedIds = async (query: ListQuery, user?: DevUser) =>
  (await list(query, user)).data!.responses.map((response) => response.id);

const read = (responseId: string, user: DevUser = "acme-admin") =>
  api.clientAs(user).GET("/responses/{responseId}", { params: { path: { responseId } } });

const deleteOne = (responseId: string, client: FormApiClient = api.clientAs("acme-admin")) =>
  client.DELETE("/responses/{responseId}", { params: { path: { responseId } } });

const erase = (respondentId: string, client: FormApiClient = api.clientAs("acme-admin")) =>
  client.DELETE("/respondents/{respondentId}/responses", { params: { path: { respondentId } } });

const analytics = async (form: { formId: string }) => {
  const { data, response } = await api
    .clientAs("acme-admin")
    .GET("/forms/{formId}/analytics", { params: { path: { formId: form.formId } } });
  if (data === undefined) throw new Error(`analytics gave ${response.status}`);
  return data;
};

/** The form's total and its first question's combined counts. */
const counted = async (form: { formId: string }) => {
  const { totalResponses, questions } = await analytics(form);
  const { responses, answered } = questions[0]!.combined;
  return { total: totalResponses, responses, answered };
};

const versionRead = (form: { formId: string; v1: { id: string } }) =>
  api.clientAs("acme-admin").GET("/forms/{formId}/versions/{versionId}", {
    params: { path: { formId: form.formId, versionId: form.v1.id } },
  });

/** UUIDv7 ids order by time only across milliseconds, so newest-first needs a gap between submits. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

describe("GET /responses/{responseId}", () => {
  test("a v1 response after v2 dropped a question and relabelled an option gives v1's snapshots and the raw answers", async () => {
    const v1Definition = definition("Survey", [ready, colour("Green")]);
    const form = await openForm("acme-admin", v1Definition);
    const alice = newRespondent();
    const responseId = await submit(alice, form, { [readyId]: true, [colourId]: "green" });
    await publish(
      api.clientAs("acme-admin"),
      form.formId,
      definition("Survey, revised", [colour("Lime")]),
    );

    const { data, response } = await read(responseId, "acme-analyst");

    expect(response.status).toBe(200);
    expect(data).toEqual({
      response: {
        id: responseId,
        formId: form.formId,
        versionId: form.v1.id,
        versionNumber: 1,
        respondentId: alice.sub,
        submittedAt: expect.any(String),
        editedAt: null,
        externalRefs: [],
        answers: { [readyId]: true, [colourId]: "green" },
      },
      path: [readyId, colourId],
      version: { id: form.v1.id, number: 1, definition: v1Definition },
    });
  });
});

describe("GET /responses", () => {
  test("pagination is stable across edits", async () => {
    const form = await openForm();
    const alice = newRespondent();
    const submitted: Array<string> = [];
    for (let i = 0; i < 5; i++) {
      submitted.unshift(await submit(alice, form));
      await tick();
    }

    const first = await list({ formId: form.formId, limit: 2 });
    for (const responseId of [submitted[1]!, submitted[3]!]) {
      const edited = await as(alice).PUT("/respond/responses/{responseId}", {
        params: { path: { responseId } },
        body: { expectedRevision: "1", answers: { [readyId]: false } },
      });
      expect(edited.response.status).toBe(200);
    }
    const second = await list({ formId: form.formId, limit: 2, cursor: first.data!.nextCursor! });
    const third = await list({ formId: form.formId, limit: 2, cursor: second.data!.nextCursor! });

    expect(
      [first, second, third].map(({ data }) => data!.responses.map((response) => response.id)),
    ).toEqual([submitted.slice(0, 2), submitted.slice(2, 4), submitted.slice(4)]);
    expect(third.data!.nextCursor).toBeNull();
  });

  test("respondentId with no formId lists that respondent's responses across every form in the tenant, and none from another tenant", async () => {
    const a = await openForm();
    const b = await openForm();
    const g = await openForm("globex-admin");
    const alice = newRespondent();
    const onA = await submit(alice, a);
    await tick();
    await submit(newRespondent(), a);
    const onB = await submit(alice, b);
    const inGlobex = await submit({ ...alice, tenant: "globex" }, g);

    const listed = await listedIds({ respondentId: alice.sub });

    expect(listed).toEqual([onB, onA]);
    expect(listed).not.toContain(inGlobex);
  });

  test("by reference, finds a response submitted under that refs claim", async () => {
    const form = await openForm();
    const ref = { namespace: "project", refId: crypto.randomUUID() };
    const referenced = await submit({ ...newRespondent(), form: form.formId, refs: [ref] }, form);
    await submit(newRespondent(), form);

    const { data } = await list({ refNamespace: ref.namespace, refId: ref.refId });

    expect(data!.responses).toEqual([
      expect.objectContaining({ id: referenced, formId: form.formId, externalRefs: [ref] }),
    ]);
  });

  test("respondentId counts code points: 255 is accepted and 256 gives 422", async () => {
    const accepted = await list({ respondentId: "😀".repeat(255) });
    const refused = await list({ respondentId: "😀".repeat(256) });

    expect(accepted.response.status).toBe(200);
    expect(refused.response.status).toBe(422);
    expect(refused.error).toMatchObject({ _tag: "ValidationFailed" });
  });

  test("limit is 1 to 200, and refNamespace needs refId", async () => {
    const statuses = await Promise.all(
      [{ limit: 200 }, { limit: 0 }, { limit: 201 }, { refNamespace: "project" }].map(
        async (query) => (await list(query)).response.status,
      ),
    );

    expect(statuses).toEqual([200, 422, 422, 422]);
  });
});

describe("DELETE /responses/{responseId}", () => {
  test("deletes one response and gives 204, then 404", async () => {
    const form = await openForm();
    const alice = newRespondent();
    const responseId = await submit(alice, form);
    const kept = await submit(alice, form);

    const deleted = await deleteOne(responseId);
    const again = await deleteOne(responseId);

    expect(deleted.response.status).toBe(204);
    expect(again.response.status).toBe(404);
    expect((await read(responseId)).response.status).toBe(404);
    expect(await listedIds({ formId: form.formId })).toEqual([kept]);
  });

  test("after the last response of a version is deleted, that version and its question keys still read", async () => {
    const form = await openForm();
    await deleteOne(await submit(newRespondent(), form));

    const emptied = await analytics(form);
    const version = await versionRead(form);
    // An answer row needs its question key in the version.
    const resubmitted = await submit(newRespondent(), form);

    expect(version.response.status).toBe(200);
    expect(version.data!.definition).toEqual(definition("Survey"));
    expect(resubmitted).toEqual(expect.any(String));
    expect(emptied.versions).toEqual([
      { versionId: form.v1.id, number: 1, publishedAt: form.v1.publishedAt, responses: 0 },
    ]);
    expect(emptied.questions.map((q) => q.byVersion)).toEqual([
      [
        {
          version: 1,
          present: true,
          responses: 0,
          answered: 0,
          skipped: 0,
          summary: { type: "boolean", trueCount: 0, falseCount: 0 },
          constraints: null,
        },
      ],
    ]);
  });
});

describe("DELETE /respondents/{respondentId}/responses", () => {
  test("erases the respondent across the whole tenant, and gives { deleted: 0 } when there's nothing to delete", async () => {
    const a = await openForm();
    const b = await openForm();
    const g = await openForm("globex-admin");
    const alice = newRespondent();
    const bob = newRespondent();
    await submit(alice, a);
    await submit(alice, b);
    const bobs = await submit(bob, a);
    const inGlobex = await submit({ ...alice, tenant: "globex" }, g);
    const before = [await counted(a), await counted(b)];

    const erased = await erase(alice.sub);
    const again = await erase(alice.sub);

    // Alice gave one of form a's two responses and form b's only one.
    expect(before).toEqual([
      { total: 2, responses: 2, answered: 2 },
      { total: 1, responses: 1, answered: 1 },
    ]);
    expect([await counted(a), await counted(b)]).toEqual([
      { total: 1, responses: 1, answered: 1 },
      { total: 0, responses: 0, answered: 0 },
    ]);
    expect(erased.response.status).toBe(200);
    expect(erased.data).toEqual({ deleted: 2 });
    expect(again.data).toEqual({ deleted: 0 });
    expect(await listedIds({ respondentId: alice.sub })).toEqual([]);
    expect(await listedIds({ respondentId: bob.sub })).toEqual([bobs]);
    expect(await listedIds({ respondentId: alice.sub }, "globex-admin")).toEqual([inGlobex]);
    for (const form of [a, b]) expect((await versionRead(form)).response.status).toBe(200);
  });

  test("afterwards the same respondent can submit again to a one-per-respondent form", async () => {
    const form = await openForm();
    await api.clientAs("acme-admin").PATCH("/forms/{formId}", {
      params: { path: { formId: form.formId } },
      body: { responseLimit: "one_per_respondent" },
    });
    const alice = newRespondent();
    await submit(alice, form);
    const blocked = await as(alice).POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.formId } },
      body: {
        versionId: form.v1.id,
        answers: { [readyId]: true },
        idempotencyKey: crypto.randomUUID(),
      },
    });

    await erase(alice.sub);

    expect(blocked.response.status).toBe(409);
    expect(await submit(alice, form)).toEqual(expect.any(String));
  });

  test("respondentId counts code points: 255 is accepted and 256 gives 422", async () => {
    const accepted = await erase("😀".repeat(255));
    const refused = await erase("😀".repeat(256));

    expect(accepted.data).toEqual({ deleted: 0 });
    expect(refused.response.status).toBe(422);
    expect(refused.error).toMatchObject({ _tag: "ValidationFailed" });
  });
});

describe("authorization", () => {
  test("without responses:delete, both deletes give 403", async () => {
    const form = await openForm();
    const alice = newRespondent();
    const responseId = await submit(alice, form);
    const analyst = api.clientAs("acme-analyst");

    const deleted = await deleteOne(responseId, analyst);
    const erased = await erase(alice.sub, analyst);

    expect(deleted.response.status).toBe(403);
    expect(deleted.error).toEqual({ _tag: "Forbidden", capability: "responses:delete" });
    expect(erased.response.status).toBe(403);
    expect(erased.error).toEqual({ _tag: "Forbidden", capability: "responses:delete" });
    expect((await read(responseId)).response.status).toBe(200);
  });

  test("another tenant's admin gets 404 deleting a response, and erases nothing", async () => {
    const form = await openForm();
    const alice = newRespondent();
    const responseId = await submit(alice, form);
    const globex = api.clientAs("globex-admin");

    const deleted = await deleteOne(responseId, globex);
    const erased = await erase(alice.sub, globex);

    expect(deleted.response.status).toBe(404);
    expect(deleted.error).toEqual({ _tag: "NotFound" });
    expect(erased.data).toEqual({ deleted: 0 });
    expect(await listedIds({ respondentId: alice.sub })).toEqual([responseId]);
  });

  test("without responses:read, listing and reading give 403", async () => {
    const form = await openForm();
    const responseId = await submit(newRespondent(), form);
    const manager = as({ sub: "manager", tenant: "acme", capabilities: ["forms:manage"] });

    const listed = await manager.GET("/responses", { params: { query: {} } });
    const readOne = await manager.GET("/responses/{responseId}", {
      params: { path: { responseId } },
    });

    expect(listed.response.status).toBe(403);
    expect(readOne.response.status).toBe(403);
    expect(readOne.error).toEqual({ _tag: "Forbidden", capability: "responses:read" });
  });

  test("another tenant's admin gets 404 on a read", async () => {
    const form = await openForm();
    const responseId = await submit(newRespondent(), form);

    const { response, error } = await read(responseId, "globex-admin");

    expect(response.status).toBe(404);
    expect(error).toEqual({ _tag: "NotFound" });
  });
});
