import type { FormApiClient } from "@fb/api-client";
import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const id = "0192f5a0-7c3e-7b1a-9d2e-0000000000a1";

const definition = {
  format: 1 as const,
  title: "Arrival",
  questions: [
    {
      id,
      type: "date_time" as const,
      label: "When do you arrive?",
      required: true,
      config: { min: "2026-05-01T09:00", max: "2026-05-31T18:00" },
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

/** JSON Schema cannot compare two date-and-time strings, so only the server applies the bounds. */
const boundsGap = new Set(["before the earliest", "after the latest"]);

const cases: ReadonlyArray<{ name: string; value: unknown; accepted: boolean }> = [
  { name: "on the earliest bound", value: "2026-05-01T09:00", accepted: true },
  { name: "on the latest bound", value: "2026-05-31T18:00", accepted: true },
  { name: "between the bounds", value: "2026-05-04T15:30", accepted: true },
  { name: "before the earliest", value: "2026-05-01T08:59", accepted: false },
  { name: "after the latest", value: "2026-05-31T18:01", accepted: false },
  { name: "with seconds", value: "2026-05-04T15:30:00", accepted: false },
  { name: "with a zone", value: "2026-05-04T15:30Z", accepted: false },
  { name: "not a calendar day", value: "2026-02-31T10:00", accepted: false },
  { name: "a date without a time", value: "2026-05-04", accepted: false },
  { name: "missing", value: undefined, accepted: false },
];

describe("the date and time answer schema", () => {
  let form: { formId: string; versionId: string };
  beforeAll(async () => {
    form = await openForm();
  });

  test("carries the bounds as x-fb-minDateTime and x-fb-maxDateTime", async () => {
    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      "x-fb-authoritative": false,
      required: [id],
      properties: {
        [id]: {
          type: "string",
          pattern: expect.any(String),
          "x-fb-minDateTime": "2026-05-01T09:00",
          "x-fb-maxDateTime": "2026-05-31T18:00",
        },
      },
    });
  });

  test("agrees with the server except for the bounds, which only the server applies", async () => {
    const { data: schema } = await answerSchema(alice, form);
    const ajv = new Ajv2020({ allErrors: true });
    formats.default(ajv);
    ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDateTime", "x-fb-maxDateTime"]);
    const browser = ajv.compile(schema!);
    const server = parseDefinition(definition);
    if (!server.ok) throw new Error("The test definition doesn't parse");

    for (const { name, value, accepted } of cases) {
      const input = value === undefined ? {} : { [id]: value };
      expect(validateAnswers(server.value, input).ok, name).toBe(accepted);
      expect(browser(input), name).toBe(boundsGap.has(name) ? true : accepted);
    }
  });
});
