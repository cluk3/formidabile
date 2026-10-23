import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const respondent = api.clientAs("acme-analyst");

const consentId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c1";

const consent = (required: boolean) => ({
  format: 1 as const,
  title: "Consent",
  questions: [
    {
      id: consentId,
      type: "boolean" as const,
      label: "I agree to the terms",
      required,
      config: { mustBeYes: true },
    },
  ],
});

const openConsentForm = async () => {
  const created = await admin.POST("/forms", { body: { definition: consent(true) } });
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

const submit = (form: { formId: string; versionId: string }, answers: Record<string, boolean>) =>
  respondent.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: { versionId: form.versionId, idempotencyKey: crypto.randomUUID(), answers },
  });

describe("must be yes", () => {
  test("publish accepts the question, and an unticked checkbox is refused", async () => {
    const form = await openConsentForm();

    const missing = await submit(form, {});
    const no = await submit(form, { [consentId]: false });
    const yes = await submit(form, { [consentId]: true });

    expect(missing.response.status).toBe(422);
    expect(missing.error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: [consentId] }],
    });
    expect(no.response.status).toBe(422);
    expect(no.error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: [consentId] }],
    });
    expect(yes.response.status).toBe(201);
    expect(yes.data).toMatchObject({ responseId: expect.any(String), revision: "1" });
  });

  test("a must-be-yes question that is not required is refused before it can be stored", async () => {
    const { response, error } = await admin.POST("/forms", {
      body: { definition: consent(false) },
    });

    expect(response.status).toBe(422);
    expect(error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ path: ["questions", 0, "required"] }],
    });
  });

  test("the advisory answer schema requires true", async () => {
    const form = await openConsentForm();
    const { data, response } = await respondent.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: form } },
    );
    const parsed = parseDefinition(consent(true));
    if (!parsed.ok) throw new Error("consent definition does not parse");

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      required: [consentId],
      properties: { [consentId]: { const: true } },
    });

    const ajv = new Ajv2020({ allErrors: true });
    ajv.addVocabulary(["x-fb-authoritative"]);
    const browser = ajv.compile(data!);
    for (const answers of [{ [consentId]: true }, { [consentId]: false }, {}]) {
      expect(browser(answers)).toBe(validateAnswers(parsed.value, answers).ok);
    }
  });
});
