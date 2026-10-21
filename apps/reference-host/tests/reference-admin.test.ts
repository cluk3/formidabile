import { createFormApiClient } from "@fb/api-client";
import { declareLength } from "@fb/http-api/web";
import { afterEach, expect, test } from "vite-plus/test";
import { mintFormToken } from "../server/dev-users.ts";
import { loadReference } from "../src/reference-admin.ts";
import { answers, clientFor, projectForm, startApi } from "./api.ts";

let api = startApi();

afterEach(async () => {
  await api.dispose();
  api = startApi();
});

const admin = () => clientFor("acme-admin", (request) => api.handler(request));

const projectRef = (projectId: string) => ({ namespace: "project", refId: projectId });

// What `/token?project=` signs for the anonymous user: a grant bound to the form, carrying the given `refs`.
const submit = async (
  form: { readonly id: string; readonly versionId: string | null },
  refs: ReadonlyArray<{ readonly namespace: string; readonly refId: string }>,
) => {
  const respondent = createFormApiClient({
    baseUrl: "http://localhost",
    getToken: () => mintFormToken(null, { tenant: "acme", id: form.id }, refs),
    fetch: async (request) => api.handler(await declareLength(request)),
  });
  const { data } = await respondent.POST("/respond/forms/{formId}/responses", {
    params: { path: { formId: form.id } },
    body: { versionId: form.versionId!, answers, idempotencyKey: crypto.randomUUID() },
  });
  return data!.responseId;
};

test("loads the forms carrying the reference, the tenant's other forms, and the responses submitted under it", async () => {
  const ref = projectRef("acme-spring-orders");
  const form = await projectForm(admin(), ref.refId, "open", "Spring orders");
  const other = await projectForm(admin(), "acme-other", "open", "Other project");
  const first = await submit(form, [ref]);
  await submit(form, []);
  await submit(other, [projectRef("acme-other")]);
  const second = await submit(form, [ref]);

  const loaded = await loadReference(admin(), ref);

  expect(loaded.forms.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: form.id, title: "Spring orders" },
  ]);
  expect(loaded.otherForms.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: other.id, title: "Other project" },
  ]);
  expect(loaded.nextCursor).toBeNull();
  // Ids made in one millisecond needn't sort in submit order, so the order isn't asserted.
  expect(loaded.responses.toSorted((a, b) => a.id.localeCompare(b.id))).toEqual(
    [first, second]
      .toSorted()
      .map((id) =>
        expect.objectContaining({ id, formId: form.id, respondentId: null, externalRefs: [ref] }),
      ),
  );
});
