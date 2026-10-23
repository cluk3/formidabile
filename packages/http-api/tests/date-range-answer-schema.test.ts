import type { Schemas } from "@fb/api-client";
import { Ajv2020 } from "ajv/dist/2020.js";
import formats from "ajv-formats";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const stayId = "0192f5a0-7c3e-7b1a-9d2e-0000000000d1";

const definition = {
  format: 1 as const,
  title: "Travel",
  questions: [
    {
      id: stayId,
      type: "date_range" as const,
      label: "Stay",
      required: false,
      config: { min: "2026-05-01", max: "2026-05-31" },
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

const respondent = () =>
  api.clientWithToken(() =>
    signToken({ sub: `respondent-${crypto.randomUUID()}`, tenant: "acme", capabilities: [] }),
  );

const submit = (form: { formId: string; versionId: string }, answers: Schemas["AnyAnswers"]) =>
  respondent().POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.formId } },
    body: { versionId: form.versionId, answers, idempotencyKey: crypto.randomUUID() },
  });

describe("date range answer schema", () => {
  test("carries the start-on-or-before-end rule, and the server stays final", async () => {
    const form = await openForm();
    const { data, response } = await respondent().GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: { formId: form.formId, versionId: form.versionId } } },
    );

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      "x-fb-authoritative": false,
      properties: {
        [stayId]: {
          type: "object",
          additionalProperties: false,
          required: ["start", "end"],
          properties: {
            start: { type: "string", format: "date" },
            end: { type: "string", format: "date" },
          },
          "x-fb-startOnOrBeforeEnd": true,
          "x-fb-minDate": "2026-05-01",
          "x-fb-maxDate": "2026-05-31",
        },
      },
    });

    const ajv = new Ajv2020({ allErrors: true });
    formats.default(ajv);
    ajv.addVocabulary([
      "x-fb-authoritative",
      "x-fb-minDate",
      "x-fb-maxDate",
      "x-fb-startOnOrBeforeEnd",
      "x-fb-step",
    ]);
    const browser = ajv.compile(data!);
    const ordered = { [stayId]: { start: "2026-05-10", end: "2026-05-01" } };
    const half = { [stayId]: { start: "2026-05-02" } };
    const stay = { [stayId]: { start: "2026-05-02", end: "2026-05-09" } };

    // JSON Schema cannot compare the two dates, so the advisory schema accepts the reversed range.
    expect(browser(ordered)).toBe(true);
    expect(browser(half)).toBe(false);
    expect(browser(stay)).toBe(true);
    expect(browser({})).toBe(true);

    const reversed = await submit(form, ordered);
    expect(reversed.response.status).toBe(422);
    expect(reversed.error).toMatchObject({
      _tag: "ValidationFailed",
      issues: [{ message: "The start must be on or before the end" }],
    });

    const missingEnd = await submit(form, half);
    expect(missingEnd.response.status).toBe(422);
    expect(missingEnd.error).toMatchObject({ _tag: "ValidationFailed" });

    const accepted = await submit(form, stay);
    expect(accepted.response.status).toBe(201);

    const omitted = await submit(form, {});
    expect(omitted.response.status).toBe(201);

    const analytics = await admin.GET("/forms/{formId}/analytics", {
      params: { path: { formId: form.formId } },
    });
    expect(analytics.response.status).toBe(200);
    expect(analytics.data).toMatchObject({
      formId: form.formId,
      totalResponses: 2,
      questions: [
        {
          questionId: stayId,
          type: "date_range",
          label: "Stay",
          combined: {
            responses: 2,
            answered: 1,
            skipped: 1,
            absentResponses: 0,
            summary: { type: "date_range" },
          },
          byVersion: [
            {
              version: 1,
              present: true,
              responses: 2,
              answered: 1,
              skipped: 1,
              summary: { type: "date_range" },
              constraints: null,
            },
          ],
        },
      ],
    });
  });
});
