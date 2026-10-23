import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const stepped = "0192f5a0-7c3e-7b1a-9d2e-000000000031";
const plain = "0192f5a0-7c3e-7b1a-9d2e-000000000032";

const definition = {
  format: 1 as const,
  title: "Amounts",
  questions: [
    {
      id: stepped,
      type: "number" as const,
      label: "Hours",
      required: false,
      config: { integer: false, min: 0, max: 2, step: 0.5 },
    },
    {
      id: plain,
      type: "number" as const,
      label: "Count",
      required: false,
      config: { integer: true },
    },
  ],
};

test("the advisory answer schema carries a number's step, and the server still checks it", async () => {
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
  const versionId = published.data!.version.id;

  const { data: schema, response } = await alice.GET(
    "/respond/forms/{formId}/versions/{versionId}/answer-schema",
    { params: { path: { formId: form.id, versionId } } },
  );

  expect(response.status).toBe(200);
  expect(schema).toMatchObject({
    properties: {
      [stepped]: { "x-fb-step": 0.5, minimum: 0, maximum: 2 },
    },
  });
  expect(schema).not.toMatchObject({
    properties: { [plain]: { "x-fb-step": expect.anything() } },
  });

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const browser = ajv.compile(schema!);
  const parsed = parseDefinition(definition);
  if (!parsed.ok) throw new Error("definition");

  expect(browser({ [stepped]: 0.25 })).toBe(true);
  expect(validateAnswers(parsed.value, { [stepped]: 0.25 }).ok).toBe(false);
  expect(validateAnswers(parsed.value, { [stepped]: 0.5 }).ok).toBe(true);

  const submit = (value: number) =>
    alice.POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.id } },
      body: {
        versionId,
        idempotencyKey: crypto.randomUUID(),
        answers: { [stepped]: value },
      },
    });
  expect((await submit(0.5)).response.status).toBe(201);
  expect((await submit(0.25)).response.status).toBe(422);
});
