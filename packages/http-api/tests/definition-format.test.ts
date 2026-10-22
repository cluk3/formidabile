import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const respondent = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const question = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  type: "boolean" as const,
  label: "Ready?",
  required: n === 1,
  config: {},
});

const format1 = {
  format: 1 as const,
  title: "Survey",
  questions: [question(1)],
};

const format2 = {
  format: 2 as const,
  title: "Survey",
  pages: [
    {
      id: "00000000-0000-4000-8000-000000000010",
      questions: [question(1)],
      jumps: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000011",
      title: "Next",
      questions: [question(2)],
      jumps: [] as [],
    },
  ],
};

describe("definition formats on the API", () => {
  test("create and draft save accept format 1 and format 2, and format 1 is stored unchanged", async () => {
    const created = await admin.POST("/forms", { body: { definition: format1 } });
    expect(created.response.status).toBe(201);
    expect(created.data?.draft.definition).toEqual(format1);

    const formId = created.data?.form.id ?? "";
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId } },
      body: { expectedRevision: created.data?.draft.revision ?? "", definition: format2 },
    });
    expect(saved.response.status).toBe(200);
    expect(saved.data?.definition).toEqual(format2);

    const again = await admin.POST("/forms", { body: { definition: format2 } });
    expect(again.response.status).toBe(201);
    expect(again.data?.draft.definition).toEqual(format2);
  });

  test("a missing format or a key the format does not define is 422 on create and on save", async () => {
    const { format: _format, ...missing } = format1;
    const created = await admin.POST("/forms", { body: { definition: missing as never } });
    expect(created.response.status).toBe(422);
    expect(created.error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: ["format"] }],
    });

    const extra = await admin.POST("/forms", {
      body: { definition: { ...format1, name: "Survey" } as never },
    });
    expect(extra.response.status).toBe(422);
    expect(extra.error).toMatchObject({ _tag: "ValidationFailed", issues: [{ path: [] }] });

    const { form, draft } = (await admin.POST("/forms", { body: { definition: format1 } })).data!;
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: {
        expectedRevision: draft.revision,
        definition: { ...format2, questions: [] } as never,
      },
    });
    expect(saved.response.status).toBe(422);
    expect(saved.error).toMatchObject({ _tag: "ValidationFailed", issues: [{ path: [] }] });
  });

  test("a draft may hold an empty page, and publishing that page is 422", async () => {
    const created = await admin.POST("/forms", { body: { definition: format1 } });
    const formId = created.data?.form.id ?? "";
    const empty = {
      format: 2 as const,
      title: "Survey",
      pages: [{ id: "00000000-0000-4000-8000-000000000010", questions: [], jumps: [] }],
    };
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId } },
      body: { expectedRevision: created.data?.draft.revision ?? "", definition: empty },
    });
    expect(saved.response.status).toBe(200);
    expect(saved.data?.definition).toEqual(empty);

    const published = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId } },
      body: { expectedRevision: saved.data?.revision ?? "" },
    });
    expect(published.response.status).toBe(422);
    expect(published.error).toEqual({
      _tag: "ValidationFailed",
      issues: [
        {
          path: ["pages", 0, "questions"],
          message: "A page needs at least one question before publishing",
        },
      ],
    });
  });

  test("a published format-2 form is stored as pages and still collects a response", async () => {
    const created = await admin.POST("/forms", { body: { definition: format2 } });
    const formId = created.data?.form.id ?? "";
    const published = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId } },
      body: { expectedRevision: created.data?.draft.revision ?? "" },
    });
    expect(published.response.status).toBe(201);
    const versionId = published.data?.version.id ?? "";

    const version = await admin.GET("/forms/{formId}/versions/{versionId}", {
      params: { path: { formId, versionId } },
    });
    expect(version.data?.definition).toEqual(format2);

    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId } },
      body: { availability: "open" },
    });
    const loaded = await respondent.GET("/respond/forms/{formId}", {
      params: { path: { formId } },
    });
    expect(loaded.response.status).toBe(200);
    expect(loaded.data?.version.definition).toEqual(format2);

    const submitted = await respondent.POST("/respond/forms/{formId}/responses", {
      params: { path: { formId } },
      body: {
        versionId,
        answers: { [question(1).id]: true },
        idempotencyKey: crypto.randomUUID(),
      },
    });
    expect(submitted.response.status).toBe(201);
  });
});
