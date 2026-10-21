import type { FormDefinition } from "@fb/core/definition";
import { expect, test, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const versionId = crypto.randomUUID();

const definitionOf = (title: string): FormDefinition => ({ format: 1, title, questions: [] });

type Settings = {
  availability: "open" | "closed";
  responseLimit: "unlimited" | "one_per_respondent";
};

/** One form as the API holds it: an optional published version, an optional draft, settings and references. */
type Stored = {
  published: FormDefinition | null;
  draft: { definition: FormDefinition; revision: string } | null;
  settings: Settings;
  externalRefs: { namespace: string; refId: string }[];
};

type Overrides = Partial<Record<"discard" | "delete" | "patch", (host: FormHost) => Response>>;

type FormHost = {
  stored: Stored | null;
  fetch: typeof globalThis.fetch;
  requests: string[];
  patches: unknown[];
  /** Applies a request the way the API would, ignoring `overrides`. */
  commit: (route: "discard" | "delete" | "patch", body?: Partial<Settings>) => void;
};

const formHost = (initial: Stored, overrides: Overrides = {}) => {
  const host: FormHost = {
    stored: initial,
    requests: [],
    patches: [],
    commit: (route, body) => {
      if (host.stored === null) return;
      if (route === "discard") host.stored.draft = null;
      else if (route === "delete") host.stored = null;
      else host.stored.settings = { ...host.stored.settings, ...body };
    },
    fetch: fakeHost(async (route, request) => {
      const { search } = new URL(request.url);
      host.requests.push(`${route}${search}`);
      const stored = host.stored;
      if (stored === null) return json(404, { _tag: "NotFound" });
      const detail = () => ({
        id: formId,
        ...stored.settings,
        currentVersion:
          stored.published === null ? null : { id: versionId, number: 1, isCurrent: true },
        draft: stored.draft === null ? null : { revision: stored.draft.revision },
        externalRefs: stored.externalRefs,
      });
      if (route === `GET /forms/${formId}/draft`) {
        const { draft } = stored;
        return json(200, {
          draft:
            draft === null
              ? null
              : { formId, revision: draft.revision, definition: draft.definition },
        });
      }
      if (route === `GET /forms/${formId}`) return json(200, detail());
      if (route === `GET /forms/${formId}/versions/${versionId}` && stored.published !== null)
        return json(200, { id: versionId, number: 1, definition: stored.published });
      if (route === `DELETE /forms/${formId}/draft`) {
        if (overrides.discard !== undefined) return overrides.discard(host);
        host.commit("discard");
        return new Response(null, { status: 204 });
      }
      if (route === `DELETE /forms/${formId}`) {
        if (overrides.delete !== undefined) return overrides.delete(host);
        host.commit("delete");
        return new Response(null, { status: 204 });
      }
      if (route === `PATCH /forms/${formId}`) {
        const body: Partial<Settings> = await request.json();
        host.patches.push(body);
        if (overrides.patch !== undefined) return overrides.patch(host);
        host.commit("patch", body);
        return json(200, { id: formId, ...host.stored?.settings, currentVersionId: null });
      }
      return json(404, { _tag: "NotFound" });
    }),
  };
  return host;
};

const unlimitedClosed: Settings = { availability: "closed", responseLimit: "unlimited" };

const publishedWithDraft = (): Stored => ({
  published: definitionOf("Published"),
  draft: { definition: definitionOf("Draft"), revision: "r1" },
  settings: unlimitedClosed,
  externalRefs: [],
});

const neverPublished = (): Stored => ({
  published: null,
  draft: { definition: definitionOf("New"), revision: "r1" },
  settings: unlimitedClosed,
  externalRefs: [],
});

const renderEditor = (fetch: typeof globalThis.fetch, onDeleted = () => {}) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted,
  });

const badGateway = () => new Response("Bad Gateway", { status: 502 });

test("discarding a published form's draft returns the editor to the current version", async () => {
  const host = formHost(publishedWithDraft());
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Draft");
  await expect.element(screen.getByRole("button", { name: "Delete form" })).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Discard draft" }).click();

  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Published");
  await expect.element(screen.getByText("Draft discarded")).toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Discard draft" }))
    .not.toBeInTheDocument();
  expect(host.requests).toContain(`DELETE /forms/${formId}/draft?expectedRevision=r1`);
});

test("a never-published form is deleted, after confirming, instead of discarding its draft", async () => {
  const host = formHost(neverPublished());
  const onDeleted = vi.fn();
  const screen = await renderEditor(host.fetch, onDeleted);
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("New");
  await expect
    .element(screen.getByRole("button", { name: "Discard draft" }))
    .not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Delete form" }).click();
  await screen.getByRole("button", { name: "Cancel" }).click();
  expect(host.requests.filter((r) => r.startsWith("DELETE"))).toEqual([]);

  await screen.getByRole("button", { name: "Delete form" }).click();
  await screen.getByRole("button", { name: "Delete permanently" }).click();

  await expect.poll(() => onDeleted.mock.calls.length).toBe(1);
  expect(host.requests).toContain(`DELETE /forms/${formId}?expectedRevision=r1`);
  expect(host.stored).toBeNull();
});

test("deleting a form someone else has just published offers the discard instead", async () => {
  const host = formHost(neverPublished(), {
    delete: ({ stored }) => {
      if (stored !== null) stored.published = definitionOf("Published elsewhere");
      return json(409, { _tag: "FormPublished" });
    },
  });
  const onDeleted = vi.fn();
  const screen = await renderEditor(host.fetch, onDeleted);

  await screen.getByRole("button", { name: "Delete form" }).click();
  await screen.getByRole("button", { name: "Delete permanently" }).click();

  await expect.element(screen.getByText(/published since you opened it/i)).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Discard draft" })).toBeVisible();
  expect(onDeleted).not.toHaveBeenCalled();
});

test("settings change the form's availability and response limit", async () => {
  const host = formHost(publishedWithDraft());
  const screen = await renderEditor(host.fetch);
  const open = screen.getByLabelText("Open for responses");
  await expect.element(open).not.toBeChecked();

  await open.click();
  await expect.element(open).toBeChecked();
  await screen.getByLabelText("Response limit").selectOptions("One per respondent");
  await expect.element(screen.getByText("Settings saved")).toBeVisible();

  expect(host.patches).toEqual([{ availability: "open" }, { responseLimit: "one_per_respondent" }]);
  expect(host.stored?.settings).toEqual({
    availability: "open",
    responseLimit: "one_per_respondent",
  });
});

test("a never-published form can't be opened", async () => {
  const host = formHost(neverPublished());
  const screen = await renderEditor(host.fetch);

  await expect.element(screen.getByLabelText("Open for responses")).toBeDisabled();
  await expect.element(screen.getByText(/publish the form to open it/i)).toBeVisible();
});

test("a form's external references are listed read-only", async () => {
  const host = formHost({
    ...publishedWithDraft(),
    externalRefs: [
      { namespace: "acme.project", refId: "p-1" },
      { namespace: "crm", refId: "campaign/42" },
    ],
  });
  const screen = await renderEditor(host.fetch);
  const refs = screen.getByRole("region", { name: "External references" });

  await expect.element(refs.getByText("acme.project")).toBeVisible();
  await expect.element(refs.getByText("campaign/42")).toBeVisible();
  expect(refs.getByRole("textbox").all()).toEqual([]);
  expect(refs.getByRole("button").all()).toEqual([]);
});

test("an unknown outcome on discard says so and reloads the form", async () => {
  // The discard commits, but the reply is lost to a proxy's 502.
  const host = formHost(publishedWithDraft(), {
    discard: (h) => {
      h.commit("discard");
      return badGateway();
    },
  });
  const screen = await renderEditor(host.fetch);

  await screen.getByRole("button", { name: "Discard draft" }).click();

  await expect.element(screen.getByText(/couldn.t confirm the draft was discarded/i)).toBeVisible();
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Published");
});

test("an unknown outcome on delete says so and reloads the form", async () => {
  const host = formHost(neverPublished(), {
    delete: (h) => {
      h.commit("delete");
      return badGateway();
    },
  });
  const onDeleted = vi.fn();
  const screen = await renderEditor(host.fetch, onDeleted);

  await screen.getByRole("button", { name: "Delete form" }).click();
  await screen.getByRole("button", { name: "Delete permanently" }).click();

  await expect.element(screen.getByText(/couldn.t confirm the form was deleted/i)).toBeVisible();
  await expect.element(screen.getByText("This form no longer exists.")).toBeVisible();
  expect(onDeleted).not.toHaveBeenCalled();
});

test("an unknown outcome on a settings change says so and reloads the settings", async () => {
  // The change doesn't commit; only the reload can tell.
  const host = formHost(publishedWithDraft(), { patch: badGateway });
  const screen = await renderEditor(host.fetch);
  await screen.getByLabelText("Form title").fill("Unsaved edit");

  await screen.getByLabelText("Open for responses").click();

  await expect
    .element(screen.getByText(/couldn.t confirm the settings were changed/i))
    .toBeVisible();
  await expect.element(screen.getByLabelText("Open for responses")).not.toBeChecked();
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Unsaved edit");
});
