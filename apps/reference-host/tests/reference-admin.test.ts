import { createFormApiClient } from "@fb/api-client";
import { declareLength } from "@fb/http-api/web";
import { afterAll, expect, test } from "vite-plus/test";
import { mintFormToken } from "../server/dev-users.ts";
import {
  addReference,
  loadReference,
  moreResponses,
  removeReference,
} from "../src/reference-admin.ts";
import { answers, clientFor, projectForm, startApi } from "./api.ts";

const api = startApi();

afterAll(() => api.dispose());

const admin = () => clientFor("acme-admin", (request) => api.handler(request));

// Every test shares the database, so each makes up projects of its own.
const projectRef = (name: string) => ({
  namespace: "project",
  refId: `acme-${name}-${crypto.randomUUID()}`,
});

const ids = (forms: ReadonlyArray<{ readonly id: string }>) => forms.map(({ id }) => id);

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
  const ref = projectRef("spring");
  const otherRef = projectRef("other");
  const form = await projectForm(admin(), ref.refId, "open", "Spring orders");
  const other = await projectForm(admin(), otherRef.refId, "open", "Other project");
  const first = await submit(form, [ref]);
  await submit(form, []);
  await submit(other, [otherRef]);
  const second = await submit(form, [ref]);

  const loaded = await loadReference(admin(), ref);

  expect(loaded.forms.map(({ id, title }) => ({ id, title }))).toEqual([
    { id: form.id, title: "Spring orders" },
  ]);
  expect(ids(loaded.otherForms)).toContain(other.id);
  expect(ids(loaded.otherForms)).not.toContain(form.id);
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

test("adding the reference to a form moves it to the reference's forms, and removing it moves it back", async () => {
  const ref = projectRef("autumn");
  const form = await projectForm(admin(), projectRef("other").refId, "closed");

  await addReference(admin(), form.id, ref);
  const added = await loadReference(admin(), ref);
  await removeReference(admin(), form.id, ref);
  const removed = await loadReference(admin(), ref);

  expect(ids(added.forms)).toEqual([form.id]);
  expect(ids(added.otherForms)).not.toContain(form.id);
  expect(removed.forms).toEqual([]);
  expect(ids(removed.otherForms)).toContain(form.id);
});

test("pages through the reference's responses from the cursor", async () => {
  const ref = projectRef("paged");
  const form = await projectForm(admin(), ref.refId, "open");
  const submitted = [
    await submit(form, [ref]),
    await submit(form, [ref]),
    await submit(form, [ref]),
  ];

  const first = await loadReference(admin(), ref, 2);
  const rest = await moreResponses(admin(), ref, first.nextCursor!, 2);

  expect(first.responses).toHaveLength(2);
  expect(rest.nextCursor).toBeNull();
  expect(ids([...first.responses, ...rest.responses]).toSorted()).toEqual(submitted.toSorted());
});

test("a refused change fails with the module's status and tag", async () => {
  const form = await projectForm(admin(), projectRef("refused").refId, "open");
  const globexForm = await projectForm(
    clientFor("globex-admin", (request) => api.handler(request)),
    "globex-partner-summit",
    "open",
  );

  await expect(addReference(admin(), globexForm.id, projectRef("theirs"))).rejects.toThrow(
    "Adding the reference failed with 404 (NotFound)",
  );
  await expect(
    removeReference(
      clientFor("acme-analyst", (request) => api.handler(request)),
      form.id,
      projectRef("refused"),
    ),
  ).rejects.toThrow("Removing the reference failed with 403 (Forbidden)");
});
