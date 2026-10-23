import type { FormApiClient } from "@fb/api-client";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const gate = "00000000-0000-4000-8000-000000000001";
const conditional = "00000000-0000-4000-8000-000000000002";
const skipped = "00000000-0000-4000-8000-000000000003";
const landed = "00000000-0000-4000-8000-000000000004";
const pageA = "00000000-0000-4000-8000-0000000000a1";
const pageB = "00000000-0000-4000-8000-0000000000a2";
const pageC = "00000000-0000-4000-8000-0000000000a3";

const text = (id: string, label: string, required: boolean) => ({
  id,
  type: "text" as const,
  label,
  required,
  config: { display: "single_line" as const },
});

/**
 * Gate is on every path. The conditional question has a show condition. Skipped sits on a page the
 * jump can pass over. Landed is the jump's target, so the jump does not pass over it.
 */
const definition = {
  format: 2 as const,
  title: "Route",
  pages: [
    {
      id: pageA,
      questions: [
        text(gate, "Gate", true),
        {
          ...text(conditional, "Detail", true),
          showCondition: { questionId: gate, operator: "equals", constant: "yes" },
        },
      ],
      jumps: [
        { condition: { questionId: gate, operator: "equals", constant: "skip" }, target: pageC },
      ],
    },
    { id: pageB, questions: [text(skipped, "Skipped", true)], jumps: [] },
    { id: pageC, questions: [text(landed, "Landed", true)], jumps: [] },
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

const answerSchema = (client: FormApiClient, form: { formId: string; versionId: string }) =>
  client.GET("/respond/forms/{formId}/versions/{versionId}/answer-schema", {
    params: { path: form },
  });

const submit = (form: { formId: string; versionId: string }, answers: Record<string, string>) =>
  alice.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: { versionId: form.versionId, answers, idempotencyKey: crypto.randomUUID() },
  });

/** Bodies the advisory schema accepts and the server rejects, because required is not on every path. */
const advisoryGap = new Set([
  "the skipped page's question missing when the jump is not taken",
  "the conditional question missing when it is shown",
  "an answer for the skipped question on the early end",
]);

const cases: ReadonlyArray<{
  name: string;
  answers: Record<string, string | undefined>;
  accepted: boolean;
}> = [
  {
    name: "the early end, with only the questions on that path",
    answers: { [gate]: "skip", [landed]: "Done" },
    accepted: true,
  },
  {
    name: "the gate missing",
    answers: { [landed]: "Done" },
    accepted: false,
  },
  {
    name: "the landing question missing",
    answers: { [gate]: "skip" },
    accepted: false,
  },
  {
    name: "the skipped page's question missing when the jump is not taken",
    answers: { [gate]: "stay", [landed]: "Done" },
    accepted: false,
  },
  {
    name: "the conditional question missing when it is shown",
    answers: { [gate]: "yes", [skipped]: "Here", [landed]: "Done" },
    accepted: false,
  },
  {
    name: "every question on the long path answered",
    answers: { [gate]: "stay", [skipped]: "Here", [landed]: "Done" },
    accepted: true,
  },
  {
    name: "an answer for the skipped question on the early end",
    answers: { [gate]: "skip", [skipped]: "Hidden", [landed]: "Done" },
    accepted: false,
  },
];

describe("the advisory required list", () => {
  test("lists a question only when it is required on every path", async () => {
    const form = await openForm();

    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    const required = (data as { required?: readonly string[] } | undefined)?.required;
    expect(required).toEqual([gate, landed]);
  });

  test("the server still rejects a path the advisory schema cannot see", async () => {
    const form = await openForm();

    const early = await submit(form, { [gate]: "skip", [landed]: "Done" });
    expect(early.response.status).toBe(201);

    const missing = await submit(form, { [gate]: "stay", [landed]: "Done" });
    expect(missing.response.status).toBe(422);
    expect(missing.error).toMatchObject({ _tag: "ValidationFailed" });
  });
});

describe("the answer schema agrees with the server except where a question is not on every path", async () => {
  const form = await openForm();
  const { data: schema } = await answerSchema(alice, form);
  const ajv = new Ajv2020({ allErrors: true });
  formats.default(ajv);
  ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate"]);
  const browser = ajv.compile(schema!);
  const server = parseDefinition(definition);
  if (!server.ok) throw new Error("The test definition doesn't parse");

  test.each(cases)("on $name", ({ name, answers, accepted }) => {
    const input = Object.fromEntries(
      Object.entries(answers).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    expect(validateAnswers(server.value, input).ok).toBe(accepted);
    expect(browser(input)).toBe(advisoryGap.has(name) ? true : accepted);
  });
});
