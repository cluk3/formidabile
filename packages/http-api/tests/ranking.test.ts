import type { FormApiClient } from "@fb/api-client";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const as = (subject: string) =>
  api.clientWithToken(() => signToken({ sub: subject, tenant: "acme", capabilities: [] }));

const prioritiesId = "0192f5a0-7c3e-7b1a-9d2e-0000000000b1";
const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

const definition = {
  format: 1 as const,
  title: "Priorities",
  questions: [
    {
      id: prioritiesId,
      type: "ranking" as const,
      label: "Priorities",
      required: false,
      config: { options },
    },
  ],
};

const openForm = async (body: typeof definition = definition) => {
  const created = await admin.POST("/forms", { body: { definition: body } });
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

const answerSchema = (client: FormApiClient, form: { formId: string; versionId: string }) =>
  client.GET("/respond/forms/{formId}/versions/{versionId}/answer-schema", {
    params: { path: form },
  });

test("the advisory schema describes a ranking as every option value once", async () => {
  const form = await openForm();
  const { data, response } = await answerSchema(as("alice"), form);
  expect(response.status).toBe(200);
  expect(data).toMatchObject({
    "x-fb-authoritative": false,
    properties: {
      [prioritiesId]: {
        type: "array",
        uniqueItems: true,
        minItems: 3,
        maxItems: 3,
        items: { enum: ["a", "b", "c"] },
      },
    },
  });
  expect(data?.required ?? []).not.toContain(prioritiesId);

  const ajv = new Ajv2020({ allErrors: true });
  const browser = ajv.compile(data!);
  const server = parseDefinition(definition);
  if (!server.ok) throw new Error("The ranking definition doesn't parse");
  const cases: ReadonlyArray<[string, Record<string, unknown>, boolean]> = [
    ["a permutation", { [prioritiesId]: ["b", "c", "a"] }, true],
    ["no answer", {}, true],
    ["a partial ranking", { [prioritiesId]: ["a", "b"] }, false],
    ["a repeated option", { [prioritiesId]: ["a", "a", "b"] }, false],
    ["an option the question does not have", { [prioritiesId]: ["a", "b", "z"] }, false],
  ];
  for (const [name, answers, accepted] of cases) {
    expect(validateAnswers(server.value, answers).ok, name).toBe(accepted);
    expect(browser(answers), name).toBe(accepted);
  }
});

test("GET analytics reports mean position and first place, combined across option sets", async () => {
  const form = await openForm();
  for (const [subject, ranking] of [
    ["alice", ["a", "b", "c"]],
    ["bob", ["b", "a", "c"]],
    ["carol", undefined],
  ] as const) {
    const submitted = await as(subject).POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.formId } },
      body: {
        versionId: form.versionId,
        idempotencyKey: crypto.randomUUID(),
        answers: ranking === undefined ? {} : { [prioritiesId]: ranking },
      },
    });
    expect(submitted.response.status).toBe(201);
  }

  const next = await admin.PUT("/forms/{formId}/draft", {
    params: { path: { formId: form.formId } },
    body: {
      expectedRevision: null,
      definition: {
        ...definition,
        questions: [
          {
            ...definition.questions[0],
            config: { options: options.slice(0, 2) },
          },
        ],
      },
    },
  });
  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId: form.formId } },
    body: { expectedRevision: next.data!.revision },
  });
  const versionId = published.data!.version.id;
  for (const [subject, ranking] of [
    ["dave", ["b", "a"]],
    ["erin", undefined],
  ] as const) {
    const submitted = await as(subject).POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.formId } },
      body: {
        versionId,
        idempotencyKey: crypto.randomUUID(),
        answers: ranking === undefined ? {} : { [prioritiesId]: ranking },
      },
    });
    expect(submitted.response.status).toBe(201);
  }

  const { data, response } = await admin.GET("/forms/{formId}/analytics", {
    params: { path: { formId: form.formId } },
  });
  expect(response.status).toBe(200);
  const summary = data?.questions[0]?.combined.summary;
  expect(summary).toEqual({
    type: "ranking",
    options: [
      {
        value: "a",
        label: "Alpha",
        otherLabels: [],
        meanPosition: expect.closeTo(5 / 3, 5),
        firstPlace: 1,
        base: 3,
        offeredIn: [1, 2],
      },
      {
        value: "b",
        label: "Beta",
        otherLabels: [],
        meanPosition: expect.closeTo(4 / 3, 5),
        firstPlace: 2,
        base: 3,
        offeredIn: [1, 2],
      },
      {
        value: "c",
        label: "Gamma",
        otherLabels: [],
        meanPosition: 3,
        firstPlace: 0,
        base: 2,
        offeredIn: [1],
      },
    ],
  });
  expect(JSON.stringify(summary)).not.toContain("Gamma,");
});
