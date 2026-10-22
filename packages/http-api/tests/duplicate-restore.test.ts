import type { JWTPayload } from "jose";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { signToken, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");

const questionId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c1";

const choice = (title: string) => ({
  format: 1 as const,
  title,
  questions: [
    {
      id: questionId,
      type: "single_choice" as const,
      label: "Plan",
      required: true,
      config: {
        display: "radio" as const,
        options: [
          { value: "basic", label: "Basic" },
          { value: "plus", label: "Plus" },
        ],
      },
    },
  ],
});

const create = async (title: string, definition = choice(title)) => {
  const { data, response } = await admin.POST("/forms", { body: { definition } });
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

const readDraft = async (formId: string) => {
  const { data, response } = await admin.GET("/forms/{formId}/draft", {
    params: { path: { formId } },
  });
  if (data === undefined) throw new Error(`draft gave ${response.status}`);
  return data.draft;
};

const readVersion = async (formId: string, versionId: string) => {
  const { data, response } = await admin.GET("/forms/{formId}/versions/{versionId}", {
    params: { path: { formId, versionId } },
  });
  if (data === undefined) throw new Error(`version gave ${response.status}`);
  return data;
};

const versionsOf = async (formId: string) => {
  const { data, response } = await admin.GET("/forms/{formId}/versions", {
    params: { path: { formId } },
  });
  if (data === undefined) throw new Error(`versions gave ${response.status}`);
  return data.versions;
};

const detailOf = async (formId: string, user: "acme-admin" | "globex-admin" = "acme-admin") => {
  const result = await api.clientAs(user).GET("/forms/{formId}", { params: { path: { formId } } });
  return result;
};

const submit = async (formId: string, versionId: string, answer: string) => {
  const respondent: JWTPayload = {
    sub: `respondent-${crypto.randomUUID()}`,
    tenant: "acme",
    capabilities: [],
  };
  const { response } = await api
    .clientWithToken(() => signToken(respondent))
    .POST("/respond/forms/{formId}/responses", {
      params: { path: { formId } },
      body: {
        versionId,
        answers: { [questionId]: answer },
        idempotencyKey: crypto.randomUUID(),
      },
    });
  if (response.status !== 201) throw new Error(`submit gave ${response.status}`);
};

const choiceSummary = async (formId: string) => {
  const { data, response } = await admin.GET("/forms/{formId}/analytics", {
    params: { path: { formId } },
  });
  if (data === undefined) throw new Error(`analytics gave ${response.status}`);
  const question = data.questions.find((item) => item.questionId === questionId);
  return { totalResponses: data.totalResponses, summary: question?.combined.summary };
};

describe("duplicate a form", () => {
  test("a published version is read and posted as a new form that keeps identities and shares no analytics", async () => {
    const source = await create("Customer survey");
    const ref = { namespace: "project", refId: crypto.randomUUID() };
    const attached = await admin.POST("/forms/{formId}/external-refs", {
      params: { path: { formId: source.form.id } },
      body: ref,
    });
    const published = await publish(source.form.id, source.draft.revision);
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: source.form.id } },
      body: { availability: "open", responseLimit: "one_per_respondent" },
    });
    await submit(source.form.id, published.version.id, "basic");
    const version = await readVersion(source.form.id, published.version.id);
    const copied = {
      ...version.definition,
      title: `${version.definition.title} (copy)`,
    };

    const created = await admin.POST("/forms", { body: { definition: copied } });
    const copyId = created.data?.form.id ?? "";
    const copyDetail = await detailOf(copyId);
    const sourceDetail = await detailOf(source.form.id);

    expect(created.response.status).toBe(201);
    expect(created.data?.draft.definition).toEqual(copied);
    expect(created.data?.form).toMatchObject({
      availability: "closed",
      responseLimit: "unlimited",
      currentVersionId: null,
    });
    expect(copyDetail.data).toMatchObject({
      availability: "closed",
      responseLimit: "unlimited",
      currentVersion: null,
      externalRefs: [],
    });
    expect(sourceDetail.data).toMatchObject({
      availability: "open",
      responseLimit: "one_per_respondent",
      externalRefs: [ref],
    });
    expect(attached.response.status).toBe(200);

    const copyPublished = await publish(copyId, created.data?.draft.revision ?? "");
    await admin.PATCH("/forms/{formId}", {
      params: { path: { formId: copyId } },
      body: { availability: "open" },
    });
    await submit(copyId, copyPublished.version.id, "plus");

    expect(await choiceSummary(source.form.id)).toEqual({
      totalResponses: 1,
      summary: {
        type: "single_choice",
        options: [
          {
            value: "basic",
            label: "Basic",
            otherLabels: [],
            count: 1,
            base: 1,
            offeredIn: [1],
          },
          { value: "plus", label: "Plus", otherLabels: [], count: 0, base: 1, offeredIn: [1] },
        ],
      },
    });
    expect(await choiceSummary(copyId)).toEqual({
      totalResponses: 1,
      summary: {
        type: "single_choice",
        options: [
          {
            value: "basic",
            label: "Basic",
            otherLabels: [],
            count: 0,
            base: 1,
            offeredIn: [1],
          },
          { value: "plus", label: "Plus", otherLabels: [], count: 1, base: 1, offeredIn: [1] },
        ],
      },
    });
  });

  test("a draft is read and posted, the copy stays never published, and it can be deleted", async () => {
    const source = await create("Working draft");
    const draft = await readDraft(source.form.id);
    const copied = { ...draft!.definition, title: "Working draft (copy)" };

    const created = await admin.POST("/forms", { body: { definition: copied } });
    const copyId = created.data?.form.id ?? "";
    const removed = await admin.DELETE("/forms/{formId}", {
      params: {
        path: { formId: copyId },
        query: { expectedRevision: created.data?.draft.revision ?? "" },
      },
    });
    const gone = await detailOf(copyId);
    const stillThere = await detailOf(source.form.id);

    expect(created.response.status).toBe(201);
    expect(created.data?.form.currentVersionId).toBeNull();
    expect(created.data?.draft.definition).toEqual(copied);
    expect(removed.response.status).toBe(204);
    expect(gone.response.status).toBe(404);
    expect(stillThere.response.status).toBe(200);
  });

  test("the api stores the copied title it is sent, including one already shortened to 200 code points", async () => {
    const title = `${"n".repeat(193)} (copy)`;

    const { draft } = await create(title, choice(title));

    expect(title).toHaveLength(200);
    expect(draft.definition).toMatchObject({ title });
  });
});

describe("restore a version into the draft", () => {
  test("with no draft, a null revision creates the draft and does not publish a version", async () => {
    const source = await create("Version one");
    const published = await publish(source.form.id, source.draft.revision);
    const version = await readVersion(source.form.id, published.version.id);
    expect(await readDraft(source.form.id)).toBeNull();

    const restored = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: null, definition: version.definition },
    });
    const versions = await versionsOf(source.form.id);

    expect(restored.response.status).toBe(200);
    expect(restored.data?.definition).toEqual(version.definition);
    expect(restored.data?.basedOnVersionId).toBe(published.version.id);
    expect(versions).toEqual([published.version]);
  });

  test("over an existing draft, the draft's revision replaces it and a stale revision conflicts", async () => {
    const source = await create("Version one");
    const published = await publish(source.form.id, source.draft.revision);
    const version = await readVersion(source.form.id, published.version.id);
    const edited = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: null, definition: choice("Draft edits") },
    });
    const landed = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: edited.data?.revision ?? "", definition: choice("Landed since") },
    });

    const stale = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: edited.data?.revision ?? "", definition: version.definition },
    });
    const replaced = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: landed.data?.revision ?? "", definition: version.definition },
    });
    const versions = await versionsOf(source.form.id);
    const detail = await detailOf(source.form.id);

    expect(stale.response.status).toBe(409);
    expect(stale.error).toEqual({ _tag: "RevisionConflict" });
    expect(replaced.response.status).toBe(200);
    expect(replaced.data?.definition).toEqual(version.definition);
    expect(detail.data?.draft).not.toBeNull();
    expect(detail.data?.currentVersion?.id).toBe(published.version.id);
    expect(versions).toEqual([published.version]);
  });

  test("restoring the current version discards the draft's edits and leaves a draft open", async () => {
    const source = await create("Current");
    const published = await publish(source.form.id, source.draft.revision);
    const version = await readVersion(source.form.id, published.version.id);
    const edited = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: null, definition: choice("Unsaved direction") },
    });

    const restored = await admin.PUT("/forms/{formId}/draft", {
      params: { path: { formId: source.form.id } },
      body: { expectedRevision: edited.data?.revision ?? "", definition: version.definition },
    });
    const detail = await detailOf(source.form.id);
    const versions = await versionsOf(source.form.id);

    expect(restored.response.status).toBe(200);
    expect(restored.data?.definition).toEqual(version.definition);
    expect(detail.data?.draft?.revision).toBe(restored.data?.revision);
    expect(versions.map((item) => item.id)).toEqual([published.version.id]);
  });
});

describe("a host posts a template definition", () => {
  const template = choice("Onboarding template");

  test("the same definition becomes a new form in whichever tenant the token names", async () => {
    const acme = await admin.POST("/forms", { body: { definition: template } });
    const globex = await api
      .clientAs("globex-admin")
      .POST("/forms", { body: { definition: template } });
    const acmeSeesGlobex = await detailOf(globex.data?.form.id ?? "", "acme-admin");
    const globexSeesAcme = await detailOf(acme.data?.form.id ?? "", "globex-admin");

    expect(acme.response.status).toBe(201);
    expect(globex.response.status).toBe(201);
    expect(acme.data?.form.id).not.toBe(globex.data?.form.id);
    expect(acme.data?.draft.definition).toEqual(template);
    expect(globex.data?.draft.definition).toEqual(template);
    expect(acmeSeesGlobex.response.status).toBe(404);
    expect(globexSeesAcme.response.status).toBe(404);
  });

  test("a missing format or an unknown key is still 422", async () => {
    const missing = await admin.POST("/forms", {
      body: { definition: { title: "Onboarding template", questions: [] } as never },
    });
    const unknown = await admin.POST("/forms", {
      body: { definition: { ...template, theme: "blue" } as never },
    });

    expect(missing.response.status).toBe(422);
    expect(missing.error).toEqual({
      _tag: "ValidationFailed",
      issues: [{ path: ["format"], message: expect.any(String) }],
    });
    expect(unknown.response.status).toBe(422);
    expect(unknown.error).toMatchObject({ _tag: "ValidationFailed" });
    expect(unknown.error && "issues" in unknown.error ? unknown.error.issues : []).toEqual([
      { path: [], message: expect.any(String) },
    ]);
  });
});
