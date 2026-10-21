import { afterAll, describe, expect, test } from "vite-plus/test";
import { startApi } from "./api.ts";

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

const admin = api.clientAs("acme-admin");

const createForm = async (title: string) => {
  const { data, response } = await admin.POST("/forms", {
    body: { definition: definition(title) },
  });
  if (data === undefined) throw new Error(`create gave ${response.status}`);
  return data;
};

const publish = async (formId: string, expectedRevision: string) => {
  const { data, response } = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId } },
    body: { expectedRevision },
  });
  if (data === undefined) throw new Error(`publish gave ${response.status}`);
  return data;
};

const publishedForm = async (title: string) => {
  const { form, draft } = await createForm(title);
  return publish(form.id, draft.revision);
};

describe("drafts and versions", () => {
  test("an admin saves a draft, publishes it as v1, and reads it back from the history", async () => {
    const { form, draft } = await createForm("Before edit");
    const edited = definition("After edit");

    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: draft.revision, definition: edited },
    });
    const published = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: saved.data?.revision ?? "" },
    });
    const versions = await admin.GET("/forms/{formId}/versions", {
      params: { path: { formId: form.id } },
    });
    const versionId = published.data?.version.id ?? "";
    const version = await admin.GET("/forms/{formId}/versions/{versionId}", {
      params: { path: { formId: form.id, versionId } },
    });
    const afterwards = await admin.GET("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
    });

    expect(saved.response.status).toBe(200);
    expect(saved.data).toEqual({
      formId: form.id,
      revision: expect.stringMatching(/^\d+$/),
      basedOnVersionId: null,
      definition: edited,
      updatedAt: expect.any(String),
    });
    expect(published.response.status).toBe(201);
    const summary = {
      id: versionId,
      number: 1,
      publishedAt: expect.any(String),
      publishedBy: "acme-admin",
      derivedFromVersionId: null,
      isCurrent: true,
    };
    expect(published.data).toEqual({
      form: { ...form, currentVersionId: versionId, updatedAt: expect.any(String) },
      version: summary,
    });
    expect(versions.data).toEqual({ versions: [summary] });
    expect(version.data).toEqual({ ...summary, definition: edited });
    expect(afterwards.data).toEqual({ draft: null });
  });

  test("an admin discards a published form's draft with 204", async () => {
    const { form } = await publishedForm("Discarded edit");
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: null, definition: definition("Unwanted") },
    });

    const { response } = await admin.DELETE("/forms/{formId}/draft", {
      params: {
        path: { formId: form.id },
        query: { expectedRevision: saved.data?.revision ?? "" },
      },
    });

    expect(response.status).toBe(204);
  });

  test.each([
    ["a stale save", "RevisionConflict"],
    ["a save after a publish", "NoDraft"],
  ])("%s gets 409 %s", async (_, tag) => {
    const { form, draft } = await createForm("Conflicts");
    const fresh = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: draft.revision, definition: definition("Fresh") },
    });
    if (tag === "NoDraft") await publish(form.id, fresh.data?.revision ?? "");

    const { response, error } = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: draft.revision, definition: definition("Stale") },
    });

    expect(response.status).toBe(409);
    expect(error).toEqual({ _tag: tag });
  });

  test("discarding a never-published form's draft gets 409 FormNotPublished", async () => {
    const { form, draft } = await createForm("Never published");

    const { response, error } = await admin.DELETE("/forms/{formId}/draft", {
      params: { path: { formId: form.id }, query: { expectedRevision: draft.revision } },
    });

    expect(response.status).toBe(409);
    expect(error).toEqual({ _tag: "FormNotPublished" });
  });

  test("publishing an incomplete draft gets 422 with every issue", async () => {
    const { form, draft } = await createForm("Complete for now");
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: {
        expectedRevision: draft.revision,
        definition: { format: 1, title: "", questions: [] },
      },
    });

    const { response, error } = await admin.POST("/forms/{formId}/draft/publish", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: saved.data?.revision ?? "" },
    });

    expect(response.status).toBe(422);
    expect(error).toEqual({
      _tag: "ValidationFailed",
      issues: [
        { path: ["title"], message: expect.any(String) },
        { path: ["questions"], message: expect.any(String) },
      ],
    });
  });
});

describe("authorization", () => {
  test("acme-analyst gets 403 for saving, publishing and reading the draft", async () => {
    const { form, draft } = await createForm("Analyst can't edit");
    const analyst = api.clientAs("acme-analyst");
    const path = { formId: form.id };

    const results = await Promise.all([
      analyst.PUT("/forms/{formId}/draft", {
        params: { path },
        body: { expectedRevision: draft.revision, definition: definition("Analyst edit") },
      }),
      analyst.POST("/forms/{formId}/draft/publish", {
        params: { path },
        body: { expectedRevision: draft.revision },
      }),
      analyst.DELETE("/forms/{formId}/draft", {
        params: { path, query: { expectedRevision: draft.revision } },
      }),
      analyst.GET("/forms/{formId}/draft", { params: { path } }),
    ]);

    for (const { response, error } of results) {
      expect(response.status).toBe(403);
      expect(error).toEqual({ _tag: "Forbidden", capability: "forms:manage" });
    }
  });

  test("acme-analyst reads the versions", async () => {
    const { form, version } = await publishedForm("Analyst reads history");
    const analyst = api.clientAs("acme-analyst");

    const list = await analyst.GET("/forms/{formId}/versions", {
      params: { path: { formId: form.id } },
    });
    const one = await analyst.GET("/forms/{formId}/versions/{versionId}", {
      params: { path: { formId: form.id, versionId: version.id } },
    });

    expect(list.data?.versions).toEqual([version]);
    expect(one.data).toMatchObject(version);
  });

  test("another tenant's admin gets 404 for every draft and version endpoint", async () => {
    const { form, version } = await publishedForm("Acme only");
    const saved = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: form.id } },
      body: { expectedRevision: null, definition: definition("Acme edit") },
    });
    const revision = saved.data?.revision ?? "";
    const other = api.clientAs("globex-admin");
    const path = { formId: form.id };

    const results = await Promise.all([
      other.GET("/forms/{formId}/draft", { params: { path } }),
      other.PUT("/forms/{formId}/draft", {
        params: { path },
        body: { expectedRevision: revision, definition: definition("Globex edit") },
      }),
      other.DELETE("/forms/{formId}/draft", {
        params: { path, query: { expectedRevision: revision } },
      }),
      other.POST("/forms/{formId}/draft/publish", {
        params: { path },
        body: { expectedRevision: revision },
      }),
      other.GET("/forms/{formId}/versions", { params: { path } }),
      other.GET("/forms/{formId}/versions/{versionId}", {
        params: { path: { ...path, versionId: version.id } },
      }),
    ]);

    for (const { response, error } of results) {
      expect(response.status).toBe(404);
      expect(error).toEqual({ _tag: "NotFound" });
    }
  });
});
