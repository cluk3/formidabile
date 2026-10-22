import type { FormDefinition } from "@fb/core/definition";
import { expect, test, vi } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

type Definition = { title: string; [key: string]: unknown };
type Version = { id: string; number: number; definition: Definition };
type Draft = { definition: Definition; revision: string; basedOnVersionId: string | null };
type Stored = { versions: Version[]; draft: Draft | null };
type Recorded = { route: string; body?: unknown };

const textQuestion = (id: string) => ({
  id,
  type: "text",
  label: "Name",
  required: true,
  config: { display: "single_line" },
});

const draftOf = (title: string, questions: unknown[] = []): Definition => ({
  format: 1,
  title,
  questions,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isDefinition = (value: unknown): value is Definition =>
  isRecord(value) && typeof value.title === "string";

const isSave = (
  value: unknown,
): value is { expectedRevision: string | null; definition: Definition } => {
  if (!isRecord(value) || !("expectedRevision" in value) || !("definition" in value)) return false;
  const revision = value.expectedRevision;
  return (revision === null || typeof revision === "string") && isDefinition(value.definition);
};

/** One form, plus whatever `POST /forms` creates. A draft save follows the API's revision rules. */
const formHost = (stored: Stored) => {
  const copyId = crypto.randomUUID();
  const host: {
    stored: Stored;
    requests: Recorded[];
    copyId: string;
    fetch: typeof globalThis.fetch;
  } = {
    stored,
    requests: [],
    copyId,
    fetch: fakeHost(async (route, request) => {
      const body =
        request.method === "GET" || request.method === "HEAD" ? undefined : await request.json();
      host.requests.push({ route, body });
      const { versions, draft } = host.stored;
      const current = versions.at(-1);
      const summary = (version: Version) => ({
        id: version.id,
        number: version.number,
        publishedAt: at,
        publishedBy: "acme-admin",
        derivedFromVersionId: null,
        isCurrent: version.id === current?.id,
      });
      if (route === `GET /forms/${formId}/draft`) {
        return json(200, {
          draft: draft === null ? null : { formId, ...draft, updatedAt: at },
        });
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
          externalRefs: [{ namespace: "project", refId: "source-ref" }],
          createdAt: at,
          updatedAt: at,
        });
      }
      if (route === `GET /forms/${formId}/versions`) {
        return json(200, { versions: versions.toReversed().map(summary) });
      }
      const read = versions.find(
        (version) => route === `GET /forms/${formId}/versions/${version.id}`,
      );
      if (read !== undefined) return json(200, { ...summary(read), definition: read.definition });
      if (route === "POST /forms") {
        const posted = isRecord(body) ? body.definition : undefined;
        if (!isDefinition(posted)) return json(400, { _tag: "ValidationFailed" });
        return json(201, {
          form: {
            id: copyId,
            availability: "closed",
            responseLimit: "unlimited",
            currentVersionId: null,
            createdAt: at,
            updatedAt: at,
          },
          draft: {
            formId: copyId,
            revision: "1",
            basedOnVersionId: null,
            definition: posted,
            updatedAt: at,
          },
        });
      }
      if (route === `PUT /forms/${formId}/draft`) {
        if (!isSave(body)) return json(400, { _tag: "ValidationFailed" });
        const currentDraft = host.stored.draft;
        if (body.expectedRevision === null) {
          if (currentDraft !== null) return json(409, { _tag: "RevisionConflict" });
        } else if (currentDraft === null || currentDraft.revision !== body.expectedRevision) {
          return json(409, { _tag: "RevisionConflict" });
        }
        const next: Draft = {
          definition: body.definition,
          revision: "r-next",
          basedOnVersionId:
            currentDraft === null ? (current?.id ?? null) : currentDraft.basedOnVersionId,
        };
        host.stored = { versions, draft: next };
        return json(200, { formId, ...next, updatedAt: at });
      }
      return json(404, { _tag: "NotFound" });
    }),
  };
  return host;
};

const renderEditor = (fetch: typeof globalThis.fetch, onDuplicated = () => {}) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
    onDuplicated,
  });

const posted = (host: { requests: Recorded[] }, route: string) =>
  host.requests.filter((request) => request.route === route).map((request) => request.body);

test("duplicate posts a version's stored definition, with the title marked as a copy, and opens the new form", async () => {
  const versionId = crypto.randomUUID();
  const pageId = "00000000-0000-4000-8000-0000000000b1";
  const questionId = "00000000-0000-4000-8000-0000000000c1";
  const versionDefinition = {
    format: 2,
    title: "Paged survey",
    pages: [{ id: pageId, title: "Start" }],
    questions: [
      {
        id: questionId,
        type: "single_choice_matrix",
        label: "Rate",
        required: false,
        rows: [{ value: "speed", label: "Speed" }],
        config: { options: [{ value: "good", label: "Good" }] },
      },
    ],
  };
  const host = formHost({
    versions: [{ id: versionId, number: 1, definition: versionDefinition }],
    draft: {
      definition: draftOf("Working draft"),
      revision: "r0",
      basedOnVersionId: versionId,
    },
  });
  const onDuplicated = vi.fn();
  const screen = await renderEditor(host.fetch, onDuplicated);
  const history = screen.getByRole("region", { name: "Publication history" });

  await expect.element(history.getByRole("button", { name: "Duplicate draft" })).toBeVisible();
  await history.getByRole("button", { name: "Duplicate version 1" }).click();

  await expect.poll(() => onDuplicated.mock.calls).toEqual([[host.copyId]]);
  expect(posted(host, "POST /forms")).toEqual([
    { definition: { ...versionDefinition, title: "Paged survey (copy)" } },
  ]);
  expect(posted(host, `GET /forms/${formId}/versions/${versionId}`)).toEqual([undefined]);
});

test("duplicate reads the saved draft, ignoring unsaved edits", async () => {
  const questionId = "00000000-0000-4000-8000-0000000000d1";
  const host = formHost({
    versions: [],
    draft: {
      definition: draftOf("Survey", [textQuestion(questionId)]),
      revision: "r0",
      basedOnVersionId: null,
    },
  });
  const onDuplicated = vi.fn();
  const screen = await renderEditor(host.fetch, onDuplicated);
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Survey");
  await screen.getByLabelText("Form title").fill("Unsaved survey");

  await screen.getByRole("button", { name: "Duplicate draft" }).click();

  await expect.poll(() => onDuplicated.mock.calls).toEqual([[host.copyId]]);
  expect(posted(host, "POST /forms")).toEqual([
    { definition: draftOf("Survey (copy)", [textQuestion(questionId)]) },
  ]);
  expect(host.requests.some((request) => request.route.startsWith("PUT"))).toBe(false);
});

test("a 200-code-point title is shortened so the copy title stays within 200", async () => {
  const title = "😀".repeat(200);
  const host = formHost({
    versions: [],
    draft: { definition: draftOf(title), revision: "r0", basedOnVersionId: null },
  });
  const screen = await renderEditor(host.fetch, () => {});
  await expect.element(screen.getByRole("button", { name: "Duplicate draft" })).toBeVisible();

  await screen.getByRole("button", { name: "Duplicate draft" }).click();

  await expect
    .poll(() => posted(host, "POST /forms"))
    .toEqual([{ definition: draftOf(`${"😀".repeat(193)} (copy)`) }]);
});

test("restore asks before replacing a draft, and cancel does not save", async () => {
  const versionId = crypto.randomUUID();
  const versionDefinition: FormDefinition = { format: 1, title: "Published", questions: [] };
  const host = formHost({
    versions: [{ id: versionId, number: 1, definition: versionDefinition }],
    draft: { definition: draftOf("Draft edits"), revision: "r0", basedOnVersionId: versionId },
  });
  const screen = await renderEditor(host.fetch);
  const history = screen.getByRole("region", { name: "Publication history" });
  await history.getByRole("button", { name: "Restore version 1" }).click();

  await expect.element(screen.getByText(/Replace the open draft with version 1/)).toBeVisible();
  await screen.getByRole("button", { name: "Cancel" }).click();

  await expect
    .element(screen.getByRole("button", { name: "Replace draft" }))
    .not.toBeInTheDocument();
  expect(posted(host, `PUT /forms/${formId}/draft`)).toEqual([]);
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Draft edits");
});

test("restore posts the stored version unchanged and leaves that draft open", async () => {
  const versionId = crypto.randomUUID();
  const pageId = "00000000-0000-4000-8000-0000000000b2";
  const versionDefinition = {
    format: 2,
    title: "Published",
    pages: [{ id: pageId }],
    questions: [{ id: "00000000-0000-4000-8000-0000000000c2", rows: [{ value: "row-1" }] }],
  };
  const host = formHost({
    versions: [{ id: versionId, number: 1, definition: versionDefinition }],
    draft: { definition: draftOf("Draft edits"), revision: "r0", basedOnVersionId: versionId },
  });
  const screen = await renderEditor(host.fetch);
  const history = screen.getByRole("region", { name: "Publication history" });
  await history.getByRole("button", { name: "Restore version 1" }).click();
  await screen.getByRole("button", { name: "Replace draft" }).click();

  await expect
    .poll(() => posted(host, `PUT /forms/${formId}/draft`))
    .toEqual([{ expectedRevision: "r0", definition: versionDefinition }]);
});

test("restoring when there is no draft saves a null revision and opens a draft", async () => {
  const versionId = crypto.randomUUID();
  const versionDefinition: FormDefinition = { format: 1, title: "Published", questions: [] };
  const host = formHost({
    versions: [{ id: versionId, number: 1, definition: versionDefinition }],
    draft: null,
  });
  const screen = await renderEditor(host.fetch);
  await expect
    .element(screen.getByText("No unpublished draft: the editor shows version 1."))
    .toBeVisible();

  await screen.getByRole("button", { name: "Restore version 1" }).click();

  await expect
    .element(screen.getByRole("button", { name: "Replace draft" }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByText("An unpublished draft, based on version 1, is open in the editor."))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Discard draft" })).toBeVisible();
  expect(posted(host, `PUT /forms/${formId}/draft`)).toEqual([
    { expectedRevision: null, definition: versionDefinition },
  ]);
});

test("a save that landed in the meantime is reported the same way as any other draft save", async () => {
  const versionId = crypto.randomUUID();
  const host = formHost({
    versions: [
      {
        id: versionId,
        number: 1,
        definition: { format: 1, title: "Published", questions: [] },
      },
    ],
    draft: { definition: draftOf("Draft edits"), revision: "r0", basedOnVersionId: versionId },
  });
  const screen = await renderEditor(host.fetch);
  const history = screen.getByRole("region", { name: "Publication history" });
  await expect.element(history.getByRole("button", { name: "Restore version 1" })).toBeVisible();
  host.stored.draft!.revision = "r-landed";

  await history.getByRole("button", { name: "Restore version 1" }).click();
  await screen.getByRole("button", { name: "Replace draft" }).click();

  await expect
    .element(screen.getByText(/This draft has changed since you opened it/))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Reload" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Keep my changes" })).toBeVisible();
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Draft edits");
  expect(posted(host, `PUT /forms/${formId}/draft`)).toEqual([
    {
      expectedRevision: "r0",
      definition: { format: 1, title: "Published", questions: [] },
    },
  ]);
});

test("restoring the current version discards draft edits and leaves a draft open", async () => {
  const versionId = crypto.randomUUID();
  const versionDefinition: FormDefinition = { format: 1, title: "Published", questions: [] };
  const host = formHost({
    versions: [{ id: versionId, number: 1, definition: versionDefinition }],
    draft: { definition: draftOf("Draft edits"), revision: "r0", basedOnVersionId: versionId },
  });
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Draft edits");
  const history = screen.getByRole("region", { name: "Publication history" });
  await history.getByRole("button", { name: "Restore version 1" }).click();
  await screen.getByRole("button", { name: "Replace draft" }).click();

  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Published");
  await expect.element(screen.getByRole("button", { name: "Discard draft" })).toBeVisible();
  await expect.element(history.getByText("Version 2", { exact: true })).not.toBeInTheDocument();
  expect(posted(host, `PUT /forms/${formId}/draft`)).toEqual([
    { expectedRevision: "r0", definition: versionDefinition },
  ]);
});
