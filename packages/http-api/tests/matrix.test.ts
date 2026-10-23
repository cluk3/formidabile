import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const gridId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c1";
const checksId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c2";

const line = (value: string, label: string) => ({ value, label });
const rows = [line("speed", "Speed"), line("comfort", "Comfort")];
const columns = [line("good", "Good"), line("poor", "Poor")];

const definition = {
  format: 1 as const,
  title: "Trip",
  questions: [
    {
      id: gridId,
      type: "single_choice_matrix" as const,
      label: "Rate the trip",
      required: true,
      config: { rows, columns },
    },
    {
      id: checksId,
      type: "multiple_choice_matrix" as const,
      label: "What stood out",
      required: false,
      config: { rows, columns },
    },
  ],
};

const openForm = async () => {
  const created = await admin.POST("/forms", { body: { definition } });
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

const propertiesOf = (schema: { properties?: Record<string, unknown> }, id: string) => {
  const question = schema.properties?.[id];
  if (question === null || typeof question !== "object" || !("properties" in question))
    throw new Error(`no object schema for ${id}`);
  return question as { properties: Record<string, unknown>; required?: string[] };
};

describe("the matrix answer schema", () => {
  test("describes each matrix as an object with one property per row value", async () => {
    const form = await openForm();
    const { data, response } = await alice.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: form } },
    );

    expect(response.status).toBe(200);
    const schema = data as { properties?: Record<string, unknown>; required?: string[] };
    expect(schema.required).toEqual([gridId]);
    const single = propertiesOf(schema, gridId);
    const multiple = propertiesOf(schema, checksId);
    expect(Object.keys(single.properties).sort()).toEqual(["comfort", "speed"]);
    expect(Object.keys(multiple.properties).sort()).toEqual(["comfort", "speed"]);
    expect(single.required?.sort()).toEqual(["comfort", "speed"]);
    expect(multiple.required).toBeUndefined();
    expect(single.properties.speed).toMatchObject({ enum: ["good", "poor"] });
    expect(multiple.properties.speed).toMatchObject({
      type: "array",
      items: { enum: ["good", "poor"] },
    });
  });

  test("agrees with the server on a complete grid, a partial one, and a missing required row", async () => {
    const form = await openForm();
    const { data: schema } = await alice.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: form } },
    );
    const ajv = new Ajv2020({ allErrors: true });
    ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate", "x-fb-step"]);
    const browser = ajv.compile(schema!);
    const server = parseDefinition(definition);
    if (!server.ok) throw new Error("definition");

    const cases = [
      { answers: { [gridId]: { speed: "good", comfort: "poor" } }, accepted: true },
      {
        answers: { [gridId]: { speed: "good", comfort: "poor" }, [checksId]: { speed: ["good"] } },
        accepted: true,
      },
      { answers: { [gridId]: { speed: "good" } }, accepted: false },
      {
        answers: { [gridId]: { speed: "good", comfort: "poor" }, [checksId]: {} },
        accepted: false,
      },
      {
        answers: { [gridId]: { speed: "good", comfort: "poor" }, [checksId]: { speed: [] } },
        accepted: false,
      },
    ];
    for (const { answers, accepted } of cases) {
      expect(validateAnswers(server.value, answers).ok).toBe(accepted);
      expect(browser(answers)).toBe(accepted);
    }

    const submitted = await alice.POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.formId } },
      body: {
        versionId: form.versionId,
        answers: {
          [gridId]: { speed: "good", comfort: "good" },
          [checksId]: { comfort: ["poor", "good"] },
        },
        idempotencyKey: crypto.randomUUID(),
      },
    });
    expect(submitted.response.status).toBe(201);
  });
});

describe("matrix analytics over HTTP", () => {
  test("returns a count and a share per row and column, and no raw answers", async () => {
    const form = await openForm();
    const respondent = (name: string) =>
      api.clientWithToken(() => signToken({ sub: name, tenant: "acme", capabilities: [] }));
    const send = async (
      name: string,
      answers: Record<string, Record<string, string> | Record<string, string[]>>,
    ) => {
      const response = await respondent(name).POST("/respond/forms/{formId}/responses", {
        params: { path: { formId: form.formId } },
        body: { versionId: form.versionId, answers, idempotencyKey: crypto.randomUUID() },
      });
      expect(response.response.status).toBe(201);
    };
    await send("ann", { [gridId]: { speed: "good", comfort: "poor" } });
    await send("ben", {
      [gridId]: { speed: "good", comfort: "good" },
      [checksId]: { speed: ["good", "poor"] },
    });

    const { data, response } = await admin.GET("/forms/{formId}/analytics", {
      params: { path: { formId: form.formId } },
    });

    expect(response.status).toBe(200);
    const grid = data?.questions.find((question) => question.questionId === gridId);
    const checks = data?.questions.find((question) => question.questionId === checksId);
    expect(grid?.combined.summary).toMatchObject({
      type: "single_choice_matrix",
      cells: [
        { row: "speed", column: "good", count: 2, base: 2, share: 100 },
        { row: "speed", column: "poor", count: 0, base: 2, share: 0 },
        { row: "comfort", column: "good", count: 1, base: 2, share: 50 },
        { row: "comfort", column: "poor", count: 1, base: 2, share: 50 },
      ],
    });
    expect(checks?.combined.summary).toMatchObject({
      type: "multiple_choice_matrix",
      cells: [
        { row: "speed", column: "good", count: 1, base: 1, share: 100 },
        { row: "speed", column: "poor", count: 1, base: 1, share: 100 },
        { row: "comfort", column: "good", count: 0, base: 0, share: null },
        { row: "comfort", column: "poor", count: 0, base: 0, share: null },
      ],
    });
    expect(grid?.combined.summary).not.toHaveProperty("values");
    expect(checks?.combined.summary).not.toHaveProperty("values");
  });
});
