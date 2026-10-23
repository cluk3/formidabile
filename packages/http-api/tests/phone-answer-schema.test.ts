import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const respondent = api.clientAs("acme-analyst");

const phoneId = "0192f5a0-7c3e-7b1a-9d2e-000000000071";

const definition = {
  format: 1 as const,
  title: "Contact",
  questions: [
    {
      id: phoneId,
      type: "phone" as const,
      label: "Phone",
      required: true,
      config: {},
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

const submit = (form: { formId: string; versionId: string }, phone: string) =>
  respondent.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: {
      versionId: form.versionId,
      idempotencyKey: crypto.randomUUID(),
      answers: { [phoneId]: phone },
    },
  });

describe("phone answers", () => {
  test("the advisory schema states the E.164 pattern, and the server stores the stripped number", async () => {
    const form = await openForm();
    const schema = await respondent.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: form } },
    );
    const parsed = parseDefinition(definition);
    if (!parsed.ok) throw new Error("phone definition does not parse");

    expect(schema.response.status).toBe(200);
    expect(schema.data).toMatchObject({
      required: [phoneId],
      properties: { [phoneId]: { type: "string", pattern: "^\\+[0-9]{1,15}$" } },
    });

    const ajv = new Ajv2020({ allErrors: true });
    ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate", "x-fb-step"]);
    const browser = ajv.compile(schema.data!);
    const serverAccepts = (phone: string) => validateAnswers(parsed.value, { [phoneId]: phone }).ok;
    expect(browser({ [phoneId]: "+14155550100" })).toBe(true);
    expect(serverAccepts("+14155550100")).toBe(true);
    expect(browser({ [phoneId]: "4155550100" })).toBe(false);
    expect(serverAccepts("4155550100")).toBe(false);
    expect(browser({ [phoneId]: `+${"1".repeat(16)}` })).toBe(false);
    expect(serverAccepts(`+${"1".repeat(16)}`)).toBe(false);
    // JSON Schema can state the stored pattern, not the stripping that happens before it.
    expect(browser({ [phoneId]: "+1 (415) 555-0100" })).toBe(false);
    expect(serverAccepts("+1 (415) 555-0100")).toBe(true);

    const sent = await submit(form, "+1 (415) 555-0100");
    expect(sent.response.status).toBe(201);
    const read = await admin.GET("/responses/{responseId}", {
      params: { path: { responseId: sent.data!.responseId } },
    });
    expect(read.response.status).toBe(200);
    expect(read.data?.response.answers).toEqual({ [phoneId]: "+14155550100" });

    const local = await submit(form, "4155550100");
    expect(local.response.status).toBe(422);
    expect(local.error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: [phoneId], message: "Include a country code, starting with +" }],
    });

    const analytics = await admin.GET("/forms/{formId}/analytics", {
      params: { path: { formId: form.formId } },
    });
    expect(analytics.response.status).toBe(200);
    expect(analytics.data?.questions[0]).toMatchObject({
      type: "phone",
      combined: { answered: 1, skipped: 0, summary: { type: "phone" } },
    });
    expect(JSON.stringify(analytics.data)).not.toContain("+14155550100");
  });
});
