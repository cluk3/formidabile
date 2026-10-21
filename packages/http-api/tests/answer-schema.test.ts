import type { FormApiClient } from "@fb/api-client";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const ids = {
  text: "0192f5a0-7c3e-7b1a-9d2e-000000000001",
  email: "0192f5a0-7c3e-7b1a-9d2e-000000000002",
};

const definition = {
  format: 1 as const,
  title: "Signup",
  questions: [
    {
      id: ids.text,
      type: "text" as const,
      label: "Name",
      required: true,
      config: { maxLength: 5, display: "single_line" as const },
    },
    { id: ids.email, type: "email" as const, label: "Email", required: false, config: {} },
  ],
};

/** An open form in `acme` with one published version. */
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

describe("the answer schema", () => {
  test("is the version's JSON Schema 2020-12, marked advisory", async () => {
    const form = await openForm();

    const { data, response } = await answerSchema(alice, form);

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      "x-fb-authoritative": false,
      description: expect.stringContaining("the server validates every submission and edit"),
      required: [ids.text],
      additionalProperties: false,
    });
  });
});
