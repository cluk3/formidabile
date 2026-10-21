import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const textQuestion = (label: string): QuestionSnapshot => ({
  id: crypto.randomUUID(),
  type: "text",
  label,
  required: true,
  config: { display: "single_line" },
});

const definitionOf = (title: string, questions: QuestionSnapshot[] = []): FormDefinition => ({
  format: 1,
  title,
  questions,
});

type Version = { id: string; number: number; definition: FormDefinition };
type Draft = { definition: FormDefinition; revision: string; basedOnVersionId: string | null };

/** One form as the API holds it: its published versions (oldest first) and its draft. */
type Stored = { versions: Version[]; draft: Draft | null };

type PublishHost = {
  stored: Stored;
  fetch: typeof globalThis.fetch;
  requests: string[];
  /** Publishes the draft the way the API would. */
  commitPublish: () => Version;
};

const at = "2026-10-21T08:00:00.000Z";

/** A host for one form. A publish turns the draft into the next current version, unless `publish` answers it. */
const publishHost = (stored: Stored, publish?: (host: PublishHost) => Response) => {
  const summary = (version: Version) => ({
    id: version.id,
    number: version.number,
    publishedAt: at,
    publishedBy: "acme-admin",
    derivedFromVersionId: null,
    isCurrent: version === host.stored.versions.at(-1),
  });
  const draftBody = (draft: Draft) => ({ formId, ...draft, updatedAt: at });
  const host: PublishHost = {
    stored,
    requests: [],
    commitPublish: () => {
      const { draft, versions } = host.stored;
      if (draft === null) throw new Error("no draft to publish");
      const version = {
        id: crypto.randomUUID(),
        number: versions.length + 1,
        definition: draft.definition,
      };
      host.stored = { versions: [...versions, version], draft: null };
      return version;
    },
    fetch: fakeHost(async (route, request) => {
      host.requests.push(route);
      const { versions, draft } = host.stored;
      const current = versions.at(-1);
      if (route === `GET /forms/${formId}/draft`) {
        return json(200, { draft: draft === null ? null : draftBody(draft) });
      }
      if (route === `GET /forms/${formId}`) {
        return json(200, {
          id: formId,
          availability: "open",
          responseLimit: "unlimited",
          currentVersion: current === undefined ? null : summary(current),
          draft:
            draft === null
              ? null
              : {
                  revision: draft.revision,
                  basedOnVersionId: draft.basedOnVersionId,
                  updatedAt: at,
                },
          externalRefs: [],
          createdAt: at,
          updatedAt: at,
        });
      }
      if (route === `GET /forms/${formId}/versions`) {
        return json(200, { versions: versions.toReversed().map(summary) });
      }
      const read = versions.find((v) => route === `GET /forms/${formId}/versions/${v.id}`);
      if (read !== undefined) return json(200, { ...summary(read), definition: read.definition });
      if (route === `PUT /forms/${formId}/draft`) {
        const body: { definition: FormDefinition } = await request.json();
        const revision = `r${host.requests.length}`;
        host.stored = {
          versions,
          draft: { definition: body.definition, revision, basedOnVersionId: current?.id ?? null },
        };
        return json(200, draftBody(host.stored.draft!));
      }
      if (route === `POST /forms/${formId}/draft/publish`) {
        if (publish !== undefined) return publish(host);
        const version = host.commitPublish();
        return json(201, {
          form: {
            id: formId,
            availability: "open",
            responseLimit: "unlimited",
            currentVersionId: version.id,
            createdAt: at,
            updatedAt: at,
          },
          version: summary(version),
        });
      }
      return json(404, { _tag: "NotFound" });
    }),
  };
  return host;
};

const renderEditor = (fetch: typeof globalThis.fetch) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

test("the preview shows the unsaved definition and validates it without calling the API", async () => {
  const host = publishHost({
    versions: [],
    draft: {
      definition: definitionOf("Survey", [textQuestion("Name")]),
      revision: "r0",
      basedOnVersionId: null,
    },
  });
  const screen = await renderEditor(host.fetch);
  await screen.getByLabelText("Form title").fill("Edited survey");
  const loads = host.requests.length;

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByRole("heading", { name: "Edited survey" })).toBeVisible();

  await preview.getByRole("button", { name: "Submit" }).click();
  await expect.element(preview.getByLabelText(/^Name/)).toHaveAttribute("aria-invalid", "true");
  await preview.getByLabelText(/^Name/).fill("Ada");
  await preview.getByRole("button", { name: "Submit" }).click();
  await expect
    .element(preview.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(host.requests.slice(loads)).toEqual([]);
});

test("a refused publish lists every problem at once", async () => {
  const host = publishHost(
    {
      versions: [],
      draft: { definition: definitionOf("Survey"), revision: "r0", basedOnVersionId: null },
    },
    () =>
      json(422, {
        _tag: "ValidationFailed",
        issues: [
          { path: ["questions"], message: "A form needs at least one question" },
          { path: ["title"], message: "The title is too short" },
        ],
      }),
  );
  const screen = await renderEditor(host.fetch);

  await screen.getByRole("button", { name: "Publish" }).click();

  const alert = screen.getByRole("alert");
  await expect.element(alert.getByText("The draft couldn't be published:")).toBeVisible();
  await expect.element(alert.getByText("A form needs at least one question")).toBeVisible();
  await expect.element(alert.getByText("The title is too short")).toBeVisible();
  expect(host.requests.filter((r) => r.startsWith("POST"))).toEqual([
    `POST /forms/${formId}/draft/publish`,
  ]);
});

test("an unknown outcome on publish says so and reloads the form", async () => {
  const host = publishHost(
    {
      versions: [],
      draft: { definition: definitionOf("Survey"), revision: "r0", basedOnVersionId: null },
    },
    (host) => {
      host.commitPublish();
      return json(502, { message: "Bad gateway" });
    },
  );
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByRole("button", { name: "Delete form" })).toBeVisible();

  await screen.getByRole("button", { name: "Publish" }).click();

  await expect
    .element(
      screen.getByText(
        "We couldn't confirm the draft was published, so the form has been reloaded.",
      ),
    )
    .toBeVisible();
  const publishAt = host.requests.indexOf(`POST /forms/${formId}/draft/publish`);
  expect(host.requests.slice(publishAt + 1)).toEqual(
    expect.arrayContaining([`GET /forms/${formId}/draft`, `GET /forms/${formId}`]),
  );
  await expect.element(screen.getByRole("button", { name: "Delete form" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
});

test("the history lists the versions, reads one, and marks the current one against the draft", async () => {
  const v1 = { id: crypto.randomUUID(), number: 1, definition: definitionOf("First") };
  const host = publishHost({
    versions: [v1],
    draft: { definition: definitionOf("Second"), revision: "r0", basedOnVersionId: v1.id },
  });
  const screen = await renderEditor(host.fetch);
  const history = screen.getByRole("region", { name: "Publication history" });

  await expect.element(history.getByText("Version 1 is current.")).toBeVisible();
  await expect
    .element(history.getByText("An unpublished draft, based on version 1, is open in the editor."))
    .toBeVisible();
  const first = history.getByRole("listitem").filter({ hasText: "Version 1" });
  await expect.element(first.getByText("Current", { exact: true })).toBeVisible();

  await first.getByRole("button", { name: "Read version 1" }).click();
  await expect.element(history.getByRole("heading", { name: "First" })).toBeVisible();

  await screen.getByRole("button", { name: "Publish" }).click();

  await expect.element(history.getByText("Version 2 is current.")).toBeVisible();
  await expect
    .element(history.getByText("No unpublished draft: the editor shows version 2."))
    .toBeVisible();
  const items = history.getByRole("listitem");
  await expect.element(items.nth(0).getByText("Version 2", { exact: true })).toBeVisible();
  await expect.element(items.nth(0).getByText("Current", { exact: true })).toBeVisible();
  await expect.element(items.nth(1).getByText("Version 1", { exact: true })).toBeVisible();
  await expect.element(items.nth(1).getByText("Current", { exact: true })).not.toBeInTheDocument();
});

test("a form that was never published says so in its history", async () => {
  const host = publishHost({
    versions: [],
    draft: { definition: definitionOf("Survey"), revision: "r0", basedOnVersionId: null },
  });
  const screen = await renderEditor(host.fetch);

  await expect
    .element(
      screen.getByRole("region", { name: "Publication history" }).getByText("Not published yet."),
    )
    .toBeVisible();
  expect(host.requests).not.toContain(`GET /forms/${formId}/versions`);
});
