import { validateAnswers } from "@fb/core/answers";
import { parseDefinition } from "@fb/core/definition";
import { Ajv2020 } from "ajv/dist/2020.js";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");
const alice = api.clientWithToken(() =>
  signToken({ sub: "alice", tenant: "acme", capabilities: [] }),
);

const id = "0192f5a0-7c3e-7b1a-9d2e-000000000091";

/** `HH:MM`, zero-padded, 24-hour, no seconds. Bounds stay on the server (ADR-018). */
const pattern = "^(?:[01]\\d|2[0-3]):[0-5]\\d$";

const definition = {
  format: 1 as const,
  title: "Hours",
  questions: [
    {
      id,
      type: "time_of_day" as const,
      label: "Arrival",
      required: false,
      config: { earliest: "09:00", latest: "17:00" },
    },
  ],
};

describe("the time of day answer schema", () => {
  test("expresses the HH:MM pattern and leaves the window to the server", async () => {
    const created = await admin.POST("/forms", { body: { definition } });
    expect(created.response.status).toBe(201);
    const { form, draft } = created.data!;
    const published = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: draft.revision },
    });
    expect(published.response.status).toBe(201);
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: form.id } },
      body: { availability: "open" },
    });
    const versionId = published.data!.version.id;

    const { data, response } = await alice.GET(
      "/respond/forms/{formId}/versions/{versionId}/answer-schema",
      { params: { path: { formId: form.id, versionId } } },
    );

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      properties: { [id]: { type: "string", pattern } },
    });

    const ajv = new Ajv2020({ allErrors: true });
    ajv.addVocabulary(["x-fb-authoritative", "x-fb-minDate", "x-fb-maxDate", "x-fb-step"]);
    const browser = ajv.compile(data!);
    const server = parseDefinition(definition);
    if (!server.ok) throw new Error("The test definition doesn't parse");
    const serverAccepts = (answers: Record<string, string>) =>
      validateAnswers(server.value, answers).ok;

    expect(browser({ [id]: "09:00" })).toBe(true);
    expect(serverAccepts({ [id]: "09:00" })).toBe(true);
    expect(browser({ [id]: "17:00" })).toBe(true);
    expect(serverAccepts({ [id]: "17:00" })).toBe(true);
    expect(browser({ [id]: "9:00" })).toBe(false);
    expect(browser({ [id]: "24:00" })).toBe(false);
    expect(browser({ [id]: "17:00:00" })).toBe(false);
    expect(serverAccepts({ [id]: "17:00:00" })).toBe(false);
    // A clock time inside the pattern but before the earliest bound: JSON Schema cannot say so.
    expect(browser({ [id]: "08:59" })).toBe(true);
    expect(serverAccepts({ [id]: "08:59" })).toBe(false);
    expect(browser({})).toBe(true);
    expect(serverAccepts({})).toBe(true);
  });
});
