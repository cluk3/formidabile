import type { JWTPayload } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { type DevUser, signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const as = (claims: JWTPayload) => api.clientWithToken(() => signToken(claims));

const readyId = "0192f5a0-7c3e-7b1a-9d2e-000000000002";
const definition = {
  format: 1 as const,
  title: "Survey",
  questions: [{ id: readyId, type: "boolean", label: "Ready?", required: true, config: {} }],
};

const createForm = async () => {
  const { data } = await api
    .clientAs("acme-admin")
    .POST("/forms", { body: { definition: definition as never } });
  return data!.form.id;
};

/** An open form with one published version and one response. */
const answeredForm = async () => {
  const client = api.clientAs("acme-admin");
  const formId = await createForm();
  const { data: draft } = await client.GET("/forms/{formId}/draft", {
    params: { path: { formId } },
  });
  const { data: published } = await client.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId } },
    body: { expectedRevision: draft!.draft!.revision },
  });
  await client.PATCH("/forms/{formId}", {
    params: { path: { formId } },
    body: { availability: "open" },
  });
  const respondent = { sub: `respondent-${crypto.randomUUID()}`, tenant: "acme", capabilities: [] };
  const submitted = await as(respondent).POST("/respond/forms/{formId}/responses", {
    params: { path: { formId } },
    body: {
      versionId: published!.version.id,
      answers: { [readyId]: true },
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(submitted.response.status).toBe(201);
  return { formId, version: published!.version };
};

const analyticsAs = (user: DevUser, formId: string) =>
  api.clientAs(user).GET("/forms/{formId}/analytics", { params: { path: { formId } } });

describe("GET /forms/{formId}/analytics", () => {
  test("a never-published form gives 200 with empty analytics", async () => {
    const formId = await createForm();

    const { data, response } = await analyticsAs("acme-admin", formId);

    expect(response.status).toBe(200);
    expect(data).toEqual({ formId, totalResponses: 0, versions: [], questions: [] });
  });

  test("an analyst with responses:read gets the FormAnalytics body", async () => {
    const { formId, version } = await answeredForm();

    const { data, response } = await analyticsAs("acme-analyst", formId);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      formId,
      totalResponses: 1,
      versions: [
        { versionId: version.id, number: 1, publishedAt: version.publishedAt, responses: 1 },
      ],
      questions: [
        {
          questionId: readyId,
          type: "boolean",
          label: "Ready?",
          otherLabels: [],
          inCurrentVersion: true,
          combined: {
            responses: 1,
            answered: 1,
            skipped: 0,
            absentResponses: 0,
            summary: { type: "boolean", trueCount: 1, falseCount: 0 },
          },
          byVersion: [
            {
              version: 1,
              present: true,
              responses: 1,
              answered: 1,
              skipped: 0,
              summary: { type: "boolean", trueCount: 1, falseCount: 0 },
              constraints: null,
            },
          ],
        },
      ],
    });
  });

  test("without responses:read gives 403, for a form manager and an anonymous grant alike", async () => {
    const formId = await createForm();
    const results = await Promise.all(
      [
        { sub: "manager", tenant: "acme", capabilities: ["forms:manage"] },
        { anonymous: true, tenant: "acme", form: formId },
      ].map((claims) =>
        as(claims).GET("/forms/{formId}/analytics", { params: { path: { formId } } }),
      ),
    );

    expect(results.map(({ response, error }) => [response.status, error])).toEqual([
      [403, { _tag: "Forbidden", capability: "responses:read" }],
      [403, { _tag: "Forbidden", capability: "responses:read" }],
    ]);
  });

  test("another tenant's form and an unknown form give 404", async () => {
    const { formId } = await answeredForm();

    const results = await Promise.all([
      analyticsAs("globex-admin", formId),
      analyticsAs("acme-admin", crypto.randomUUID()),
    ]);

    expect(results.map(({ response, error }) => [response.status, error])).toEqual([
      [404, { _tag: "NotFound" }],
      [404, { _tag: "NotFound" }],
    ]);
  });

  test("a formId that isn't a UUID gives 422", async () => {
    const { response } = await analyticsAs("acme-admin", "not-a-uuid");

    expect(response.status).toBe(422);
  });
});
