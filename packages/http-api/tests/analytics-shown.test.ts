import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const gateId = "0192f5a0-7c3e-7b1a-9d2e-0000000000e1";
const whyId = "0192f5a0-7c3e-7b1a-9d2e-0000000000e2";
const noteId = "0192f5a0-7c3e-7b1a-9d2e-0000000000e3";
const pageId = "0192f5a0-7c3e-7b1a-9d2e-0000000000e4";
const secret = "secret-note-9f3a";

const definition = {
  format: 2 as const,
  title: "Survey",
  pages: [
    {
      id: pageId,
      questions: [
        { id: gateId, type: "boolean", label: "Stay?", required: true, config: {} },
        {
          id: whyId,
          type: "single_choice",
          label: "Why not?",
          required: false,
          config: {
            display: "radio",
            options: [
              { value: "price", label: "Price" },
              { value: "time", label: "Time" },
            ],
          },
          showCondition: { questionId: gateId, operator: "is_no" },
        },
        {
          id: noteId,
          type: "text",
          label: "Note",
          required: false,
          config: { display: "single_line" },
        },
      ],
      jumps: [],
    },
  ],
};

const submit = async (
  formId: string,
  versionId: string,
  answers: { [key: string]: string | number | boolean | string[] },
) => {
  const response = await api
    .clientWithToken(() =>
      signToken({ sub: `respondent-${crypto.randomUUID()}`, tenant: "acme", capabilities: [] }),
    )
    .POST("/respond/forms/{formId}/responses", {
      params: { path: { formId } },
      body: { versionId, answers, idempotencyKey: crypto.randomUUID() },
    });
  expect(response.response.status).toBe(201);
};

describe("GET /forms/{formId}/analytics shown counts", () => {
  test("reports shown, skipped and not shown from the stored path, and leaves raw answers out", async () => {
    const client = api.clientAs("acme-admin");
    const created = await client.POST("/forms", { body: { definition: definition as never } });
    const formId = created.data!.form.id;
    const draft = await client.GET("/forms/{formId}/draft", { params: { path: { formId } } });
    const published = await client.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId } },
      body: { expectedRevision: draft.data!.draft!.revision },
    });
    expect(published.response.status).toBe(201);
    await client.PATCH("/forms/{formId}", {
      params: { path: { formId } },
      body: { availability: "open" },
    });
    const versionId = published.data!.version.id;

    await submit(formId, versionId, { [gateId]: false, [whyId]: "price", [noteId]: secret });
    await submit(formId, versionId, { [gateId]: false });
    await submit(formId, versionId, { [gateId]: true });

    const { data, response } = await api
      .clientAs("acme-analyst")
      .GET("/forms/{formId}/analytics", { params: { path: { formId } } });

    expect(response.status).toBe(200);
    const why = data!.questions.find((question) => question.questionId === whyId)!;
    expect(why.combined).toMatchObject({
      responses: 3,
      shown: 2,
      answered: 1,
      skipped: 1,
      notShown: 1,
    });
    expect(why.byVersion[0]).toMatchObject({
      version: 1,
      present: true,
      responses: 3,
      shown: 2,
      answered: 1,
      skipped: 1,
      notShown: 1,
    });
    expect(why.combined.summary).toEqual({
      type: "single_choice",
      options: [
        { value: "price", label: "Price", otherLabels: [], count: 1, base: 1, offeredIn: [1] },
        { value: "time", label: "Time", otherLabels: [], count: 0, base: 1, offeredIn: [1] },
      ],
    });

    const note = data!.questions.find((question) => question.questionId === noteId)!;
    expect(note.combined).toMatchObject({
      responses: 3,
      shown: 3,
      answered: 1,
      skipped: 2,
      notShown: 0,
      summary: { type: "text" },
    });
    expect(JSON.stringify(data)).not.toContain(secret);
  });
});
