import type { FormApiClient } from "@fb/api-client";
import { validateAnswers } from "@fb/core/answers";
import { countryCodes, parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const id = "0192f5a0-7c3e-7b1a-9d2e-000000000014";

const definition = {
  format: 1 as const,
  title: "Delivery",
  questions: [
    {
      id,
      type: "address" as const,
      label: "Delivery address",
      required: false,
      config: {
        lines: {
          line1: { shown: true, required: true },
          line2: { shown: false, required: false },
          city: { shown: true, required: false },
          region: { shown: false, required: false },
          postalCode: { shown: true, required: false },
          country: { shown: true, required: true },
        },
      },
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

const answerSchema = (client: FormApiClient, form: { formId: string; versionId: string }) =>
  client.GET("/respond/forms/{formId}/versions/{versionId}/answer-schema", {
    params: { path: form },
  });

const cases: ReadonlyArray<{ name: string; answers: Record<string, unknown>; accepted: boolean }> =
  [
    { name: "no answer for an optional address", answers: {}, accepted: true },
    {
      name: "the required lines",
      answers: { [id]: { line1: "10 High Street", country: "GB" } },
      accepted: true,
    },
    {
      name: "an optional line with no postal format",
      answers: {
        [id]: { line1: "10 High Street", postalCode: "not a postcode", country: "FR" },
      },
      accepted: true,
    },
    { name: "an empty object", answers: { [id]: {} }, accepted: false },
    { name: "a required line missing", answers: { [id]: { country: "GB" } }, accepted: false },
    {
      name: "whitespace only",
      answers: { [id]: { line1: "   ", country: "GB" } },
      accepted: false,
    },
    {
      name: "a hidden line",
      answers: { [id]: { line1: "10 High Street", line2: "Flat 2", country: "GB" } },
      accepted: false,
    },
    {
      name: "a line of 200 code points",
      answers: { [id]: { line1: "a".repeat(200), country: "GB" } },
      accepted: true,
    },
    {
      name: "a line of 201 code points",
      answers: { [id]: { line1: "a".repeat(201), country: "GB" } },
      accepted: false,
    },
    {
      name: "a country that is not alpha-2",
      answers: { [id]: { line1: "10 High Street", country: "UK" } },
      accepted: false,
    },
    {
      name: "a lowercase country code",
      answers: { [id]: { line1: "10 High Street", country: "gb" } },
      accepted: false,
    },
  ];

describe("the address answer schema", () => {
  test("describes the shown lines and not the hidden ones", async () => {
    const form = await openForm();
    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      properties: {
        [id]: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          required: ["line1", "country"],
          properties: {
            line1: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
            city: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
            postalCode: { type: "string", minLength: 1, maxLength: 200, pattern: "\\S" },
            country: { type: "string", enum: [...countryCodes] },
          },
        },
      },
    });
    const property = (data as { properties: Record<string, { properties: object }> }).properties[
      id
    ]!;
    expect(property.properties).not.toHaveProperty("line2");
    expect(property.properties).not.toHaveProperty("region");
  });

  test("agrees with the server's validation", async () => {
    const form = await openForm();
    const { data: schema } = await answerSchema(alice, form);
    const ajv = new Ajv2020({ allErrors: true });
    ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate", "x-fb-step"]);
    const browser = ajv.compile(schema!);
    const server = parseDefinition(definition);
    if (!server.ok) throw new Error("The test definition doesn't parse");

    for (const { name, answers, accepted } of cases) {
      expect(validateAnswers(server.value, answers).ok, name).toBe(accepted);
      expect(browser(answers), name).toBe(accepted);
    }
  });
});
