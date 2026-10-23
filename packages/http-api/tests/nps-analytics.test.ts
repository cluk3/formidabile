import { afterAll, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const as = (subject: string) =>
  api.clientWithToken(() => signToken({ sub: subject, tenant: "acme", capabilities: [] }));

const recommendId = "0192f5a0-7c3e-7b1a-9d2e-0000000000e1";

const definition = {
  format: 1 as const,
  title: "Recommend",
  questions: [
    {
      id: recommendId,
      type: "number" as const,
      label: "Recommend?",
      required: true,
      config: {
        integer: true,
        min: 0,
        max: 10,
        display: "nps" as const,
        minLabel: "Not likely",
        maxLabel: "Very likely",
      },
    },
  ],
};

test("GET analytics reports the NPS score for a version that uses the NPS display", async () => {
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
  // 10, 10 and 0: two promoters and one detractor, so the score is 33, not the count difference 1.
  for (const [subject, value] of [
    ["alice", 10],
    ["bob", 10],
    ["carol", 0],
  ] as const) {
    const submitted = await as(subject).POST("/respond/forms/{formId}/responses", {
      params: { path: { formId: form.id } },
      body: { versionId, idempotencyKey: crypto.randomUUID(), answers: { [recommendId]: value } },
    });
    expect(submitted.response.status).toBe(201);
  }

  const { data, response } = await admin.GET("/forms/{formId}/analytics", {
    params: { path: { formId: form.id } },
  });

  expect(response.status).toBe(200);
  expect(data?.questions[0]?.combined.summary).toEqual({
    type: "number",
    count: 3,
    min: 0,
    max: 10,
    mean: expect.closeTo(20 / 3, 5),
    median: 10,
    nps: { promoters: 2, passives: 0, detractors: 1, answered: 3, score: 33 },
  });
  expect(data?.questions[0]?.byVersion[0]).toMatchObject({
    summary: { nps: { promoters: 2, passives: 0, detractors: 1, answered: 3, score: 33 } },
  });
});
