import { afterAll, describe, expect, test } from "vite-plus/test";
import { type DevUser, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const createForm = async (title: string, user: DevUser = "acme-admin") => {
  const { data, response } = await api.clientAs(user).POST("/forms", {
    body: {
      definition: {
        format: 1,
        title,
        questions: [
          { id: crypto.randomUUID(), type: "boolean", label: "Ready?", required: true, config: {} },
        ],
      },
    },
  });
  if (data === undefined) throw new Error(`create gave ${response.status}`);
  return data.form;
};

const attach = (
  formId: string,
  ref: { namespace: string; refId: string },
  user: DevUser = "acme-admin",
) =>
  api.clientAs(user).POST("/forms/{formId}/external-refs", {
    params: { path: { formId } },
    body: ref,
  });

const detach = (
  formId: string,
  ref: { namespace: string; refId: string },
  user: DevUser = "acme-admin",
) =>
  api.clientAs(user).DELETE("/forms/{formId}/external-refs", {
    params: { path: { formId }, query: ref },
  });

const lookUp = (refNamespace: string, refId: string, user: DevUser = "acme-admin") =>
  api.clientAs(user).GET("/forms", { params: { query: { refNamespace, refId } } });

/** Each test's own reference, so tests sharing the database never see each other's forms. */
const uniqueRef = (namespace = "project") => ({ namespace, refId: crypto.randomUUID() });

describe("attaching and detaching references", () => {
  test("attaching returns the whole set, and attaching the same reference again changes nothing", async () => {
    const form = await createForm("Referenced");
    const ref = uniqueRef();

    const first = await attach(form.id, ref);
    const again = await attach(form.id, ref);
    const detail = await api.clientAs("acme-analyst").GET("/forms/{formId}", {
      params: { path: { formId: form.id } },
    });

    expect(first.response.status).toBe(200);
    expect(first.data).toEqual({ externalRefs: [ref] });
    expect(again.data).toEqual({ externalRefs: [ref] });
    expect(detail.data?.externalRefs).toEqual([ref]);
  });

  test("detaching returns what's left, and detaching a missing reference is a no-op", async () => {
    const form = await createForm("Detaching");
    const kept = uniqueRef("crm.account");
    const dropped = uniqueRef("project");
    await attach(form.id, kept);
    await attach(form.id, dropped);

    const removed = await detach(form.id, dropped);
    const missing = await detach(form.id, dropped);

    expect(removed.response.status).toBe(200);
    expect(removed.data).toEqual({ externalRefs: [kept] });
    expect(missing.response.status).toBe(200);
    expect(missing.data).toEqual({ externalRefs: [kept] });
  });

  test("the 101st reference gets 409 ExternalRefLimitReached", async () => {
    const form = await createForm("Full");
    for (let i = 0; i < 100; i++) {
      const { response } = await attach(form.id, { namespace: "n", refId: `ref-${i}` });
      if (response.status !== 200) throw new Error(`attach ${i} gave ${response.status}`);
    }

    const { response, error } = await attach(form.id, { namespace: "n", refId: "ref-100" });

    expect(response.status).toBe(409);
    expect(error).toEqual({ _tag: "ExternalRefLimitReached", limit: 100 });
  });

  test("acme-analyst gets 403 for attaching and detaching", async () => {
    const form = await createForm("Analyst can't manage");
    const ref = uniqueRef();

    for (const { response, error } of [
      await attach(form.id, ref, "acme-analyst"),
      await detach(form.id, ref, "acme-analyst"),
    ]) {
      expect(response.status).toBe(403);
      expect(error).toEqual({ _tag: "Forbidden", capability: "forms:manage" });
    }
  });

  test("another tenant's admin gets 404 for attaching and detaching", async () => {
    const form = await createForm("Acme only");
    const ref = uniqueRef();

    for (const { response, error } of [
      await attach(form.id, ref, "globex-admin"),
      await detach(form.id, ref, "globex-admin"),
    ]) {
      expect(response.status).toBe(404);
      expect(error).toEqual({ _tag: "NotFound" });
    }
  });

  test.each([
    ["an uppercase namespace", { namespace: "Project", refId: "p-1" }],
    ["a namespace starting with a digit", { namespace: "1project", refId: "p-1" }],
    ["a 65-code-point namespace", { namespace: "a".repeat(65), refId: "p-1" }],
    ["an empty refId", { namespace: "project", refId: "" }],
    ["a 256-code-point refId", { namespace: "project", refId: "é".repeat(256) }],
  ])("%s gets 422 from the edge", async (_, ref) => {
    const form = await createForm("Strict references");

    const { response, error } = await attach(form.id, ref);

    expect(response.status).toBe(422);
    expect(error).toMatchObject({ _tag: "ValidationFailed" });
  });
});

describe("looking forms up by reference", () => {
  test.each(["project", "crm.account", "x", "billing_v2.customer-id", "z9.-_"])(
    "a reference in the %s namespace finds its form",
    async (namespace) => {
      const form = await createForm(`In ${namespace}`);
      const ref = { namespace, refId: `🎯 ${crypto.randomUUID()}` };
      await attach(form.id, ref);

      const { response, data } = await lookUp(ref.namespace, ref.refId);

      expect(response.status).toBe(200);
      expect(data?.forms.map((summary) => summary.id)).toEqual([form.id]);
    },
  );

  test("one reference on two forms returns both, newest first, and not another tenant's", async () => {
    const ref = uniqueRef();
    const older = await createForm("Older");
    const newer = await createForm("Newer");
    const globex = await createForm("Globex", "globex-admin");
    await attach(older.id, ref);
    await attach(newer.id, ref);
    await attach(globex.id, ref, "globex-admin");

    const { data } = await lookUp(ref.namespace, ref.refId, "acme-analyst");

    expect(data?.forms.map((summary) => summary.title)).toEqual(["Newer", "Older"]);
    expect(data?.forms[0]).toEqual({
      id: newer.id,
      title: "Newer",
      availability: "closed",
      responseLimit: "unlimited",
      currentVersion: null,
      hasDraft: true,
      updatedAt: newer.updatedAt,
    });
  });

  test("an unknown reference gets 200 with an empty list", async () => {
    const ref = uniqueRef();

    const { response, data } = await lookUp(ref.namespace, ref.refId);

    expect(response.status).toBe(200);
    expect(data).toEqual({ forms: [] });
  });

  test.each([
    ["only refNamespace", { refNamespace: "project" }],
    ["only refId", { refId: "p-1" }],
  ])("a lookup with %s gets 422", async (_, query) => {
    const { response, error } = await api
      .clientAs("acme-admin")
      .GET("/forms", { params: { query } });

    expect(response.status).toBe(422);
    expect(error).toMatchObject({ _tag: "ValidationFailed" });
  });
});
