import { afterAll, describe, expect, test } from "vite-plus/test";
import { devUsers, signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const definition = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    {
      id: crypto.randomUUID(),
      type: "boolean" as const,
      label: "Ready?",
      required: true,
      config: {},
    },
  ],
});

const createForm = async (title: string, sent = definition(title)) => {
  const { data, response } = await api.clientAs("acme-admin").POST("/forms", {
    body: { definition: sent },
  });
  if (response.status !== 201 || data === undefined)
    throw new Error(`create gave ${response.status}`);
  return data;
};

describe("authentication", () => {
  const listWith = (token: string | null) => api.clientWithToken(() => token).GET("/forms");

  test("a request with no token gets 401 missing", async () => {
    const { response, error } = await listWith(null);

    expect(response.status).toBe(401);
    expect(error).toEqual({ _tag: "Unauthenticated", reason: "missing" });
  });

  test.each([
    ["expired", { expiresAt: new Date(Date.now() - 60_000) }],
    ["wrongly signed", { secret: "another secret that is long enough for HS256" }],
    ["wrong-audience", { audience: "another-module" }],
  ])("an %s token gets 401 invalid", async (_, options) => {
    const { response, error } = await listWith(await signToken(devUsers["acme-admin"], options));

    expect(response.status).toBe(401);
    expect(error).toEqual({ _tag: "Unauthenticated", reason: "invalid" });
  });
});

describe("creating a form", () => {
  test("an admin creates a closed, unpublished form with its first draft", async () => {
    const sent = definition("Customer survey");

    const { form, draft } = await createForm("Customer survey", sent);

    expect(form).toEqual({
      id: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
      availability: "closed",
      responseLimit: "unlimited",
      currentVersionId: null,
      createdAt: expect.any(String),
      updatedAt: form.createdAt,
    });
    expect(draft).toEqual({
      formId: form.id,
      revision: expect.stringMatching(/^\d+$/),
      basedOnVersionId: null,
      definition: sent,
      updatedAt: form.createdAt,
    });
  });

  test("the draft holds the definition as core parsed it, with text trimmed", async () => {
    const { draft } = await createForm("  Padded title  ");

    expect(draft.definition).toMatchObject({ title: "Padded title" });
  });

  test("creating without forms:manage gets 403", async () => {
    const { response, error } = await api.clientAs("acme-analyst").POST("/forms", {
      body: { definition: definition("Not allowed") },
    });

    expect(response.status).toBe(403);
    expect(error).toEqual({ _tag: "Forbidden", capability: "forms:manage" });
  });

  test("a definition that doesn't parse gets 422 with every issue", async () => {
    const { response, error } = await api.clientAs("acme-admin").POST("/forms", {
      body: { definition: { format: 2, title: "Broken", questions: "none" } as never },
    });

    expect(response.status).toBe(422);
    expect(error).toEqual({
      _tag: "ValidationFailed",
      issues: [
        { path: ["format"], message: expect.any(String) },
        { path: ["questions"], message: expect.any(String) },
      ],
    });
  });

  test("a body without a definition gets 422 from the edge", async () => {
    const { response, error } = await api.clientAs("acme-admin").POST("/forms", {
      body: {} as never,
    });

    expect(response.status).toBe(422);
    expect(error).toEqual({
      _tag: "ValidationFailed",
      issues: [{ path: ["definition"], message: expect.any(String) }],
    });
  });
});

describe("reading forms", () => {
  test("the list shows each form's draft title, most recently updated first", async () => {
    const first = await createForm("First of two");
    const second = await createForm("Second of two");

    const { data } = await api.clientAs("acme-admin").GET("/forms");

    const ids = data?.forms.map((form) => form.id) ?? [];
    expect(ids.indexOf(second.form.id)).toBeLessThan(ids.indexOf(first.form.id));
    expect(data?.forms.find((form) => form.id === first.form.id)).toEqual({
      id: first.form.id,
      title: "First of two",
      availability: "closed",
      responseLimit: "unlimited",
      currentVersion: null,
      hasDraft: true,
      updatedAt: first.form.updatedAt,
    });
  });

  test("the detail shows the settings and a summary of the draft", async () => {
    const { form, draft } = await createForm("Detailed");

    const { data } = await api.clientAs("acme-admin").GET("/forms/{formId}", {
      params: { path: { formId: form.id } },
    });

    expect(data).toEqual({
      id: form.id,
      availability: "closed",
      responseLimit: "unlimited",
      currentVersion: null,
      draft: { revision: draft.revision, basedOnVersionId: null, updatedAt: draft.updatedAt },
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    });
  });

  test("acme-analyst reads the list and the detail", async () => {
    const { form } = await createForm("For the analyst");
    const analyst = api.clientAs("acme-analyst");

    const list = await analyst.GET("/forms");
    const detail = await analyst.GET("/forms/{formId}", {
      params: { path: { formId: form.id } },
    });

    expect(list.data?.forms.map((summary) => summary.id)).toContain(form.id);
    expect(detail.data?.id).toBe(form.id);
  });

  test("another tenant's admin gets 404 for the form and doesn't see it listed", async () => {
    const { form } = await createForm("Acme only");
    const globex = api.clientAs("globex-admin");

    const detail = await globex.GET("/forms/{formId}", {
      params: { path: { formId: form.id } },
    });
    const list = await globex.GET("/forms");

    expect(detail.response.status).toBe(404);
    expect(detail.error).toEqual({ _tag: "NotFound" });
    expect(list.data?.forms.map((summary) => summary.id)).not.toContain(form.id);
  });

  test("a form id that isn't a UUID gets 422", async () => {
    const { response, error } = await api.clientAs("acme-admin").GET("/forms/{formId}", {
      params: { path: { formId: "not-a-uuid" } },
    });

    expect(response.status).toBe(422);
    expect(error).toMatchObject({ _tag: "ValidationFailed", issues: [{ path: ["formId"] }] });
  });
});
