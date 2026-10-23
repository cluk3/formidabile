import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
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

const definitionOf = (title: string, questions: QuestionSnapshot[]): FormDefinition => ({
  format: 1,
  title,
  questions,
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const hostFor = (definition: FormDefinition) => {
  let draft = {
    formId,
    revision: "r0",
    basedOnVersionId: null,
    definition,
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
  const saves: SaveBody[] = [];
  const requests: string[] = [];
  const fetch = fakeHost(async (route, request) => {
    requests.push(route);
    if (route === `GET /forms/${formId}/draft`) return json(200, { draft });
    if (route === `GET /forms/${formId}`) {
      return json(200, {
        id: formId,
        availability: "closed",
        responseLimit: "unlimited",
        currentVersion: null,
        externalRefs: [],
      });
    }
    if (route === `PUT /forms/${formId}/draft`) {
      const body: SaveBody = await request.json();
      saves.push(body);
      draft = { ...draft, revision: `r${saves.length}`, definition: body.definition };
      return json(200, draft);
    }
    if (route === `POST /forms/${formId}/draft/publish`) {
      const checked = validateForPublish(draft.definition, []);
      if (!checked.ok) return json(422, { _tag: "ValidationFailed", issues: checked.issues });
      return json(201, {
        form: { id: formId },
        version: { id: crypto.randomUUID(), number: 1 },
      });
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves, requests };
};

const renderEditor = (fetch: typeof globalThis.fetch) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

test("pages can be added, titled, reordered, and removed, and the respondent never sees Page N", async () => {
  const host = hostFor(definitionOf("Survey", [textQuestion("Alpha")]));
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByRole("region", { name: "Page 1" })).toBeVisible();

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByRole("heading", { name: "Survey" })).toBeVisible();
  await expect.element(preview.getByText("Page 1")).not.toBeInTheDocument();
  await expect.element(preview.getByRole("button", { name: "Submit" })).toBeVisible();
  await screen.getByRole("button", { name: "Preview" }).click();

  await screen.getByRole("region", { name: "Page 1" }).getByLabelText("Page title").fill("Start");
  await screen.getByRole("button", { name: "Add page" }).click();
  const second = screen.getByRole("region", { name: "Page 2" });
  await expect.element(second).toBeVisible();
  await second.getByLabelText("Page description").fill("More detail");
  await second.getByLabelText("Page title").fill("Later");

  const later = screen.getByRole("region", { name: "Later" });
  await expect.element(later).toBeVisible();
  expect(screen.getByText("Page 2").elements()).toEqual([]);
  await later.getByRole("button", { name: "Move page up" }).click();

  const moved = later.element();
  const first = screen.getByRole("region", { name: "Start" }).element();
  expect(moved.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  await screen
    .getByRole("region", { name: "Start" })
    .getByRole("button", { name: "Remove page" })
    .click();
  await expect.element(screen.getByRole("region", { name: "Start" })).not.toBeInTheDocument();
  await expect
    .element(
      screen.getByRole("region", { name: "Later" }).getByRole("button", { name: "Remove page" }),
    )
    .toBeDisabled();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  const saved = host.saves[0]?.definition;
  expect(saved?.format).toBe(2);
  if (saved?.format !== 2) return;
  expect(saved.pages).toHaveLength(1);
  expect(saved.pages[0]).toMatchObject({
    title: "Later",
    description: "More detail",
    questions: [],
  });
});

test("a question moves to another page and keeps its identity", async () => {
  const alpha = textQuestion("Alpha");
  const beta = textQuestion("Beta");
  const host = hostFor(definitionOf("Survey", [alpha, beta]));
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByRole("region", { name: "Question 2" })).toBeVisible();

  await screen.getByRole("button", { name: "Add page" }).click();
  await screen
    .getByRole("region", { name: "Question 1" })
    .getByLabelText("Move to page")
    .selectOptions("Page 2");

  const first = screen.getByRole("region", { name: "Page 1" });
  const second = screen.getByRole("region", { name: "Page 2" });
  await expect.element(first.getByLabelText("Label")).toHaveValue("Beta");
  await expect.element(second.getByLabelText("Label")).toHaveValue("Alpha");

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  const saved = host.saves[0]?.definition;
  if (saved?.format !== 2) throw new Error("expected format 2");
  expect(saved.pages[0]?.questions.map((question) => question.id)).toEqual([beta.id]);
  expect(saved.pages[1]?.questions.map((question) => question.id)).toEqual([alpha.id]);
  expect(saved.pages[1]?.questions[0]).toMatchObject({
    id: alpha.id,
    label: "Alpha",
    type: "text",
  });
});

test("publishing a draft with an empty page is refused", async () => {
  const host = hostFor(definitionOf("Survey", [textQuestion("Alpha")]));
  const screen = await renderEditor(host.fetch);
  await expect.element(screen.getByRole("button", { name: "Add page" })).toBeVisible();

  await screen.getByRole("button", { name: "Add page" }).click();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  await screen.getByRole("button", { name: "Publish" }).click();

  const alert = screen.getByRole("alert");
  await expect.element(alert.getByText("The draft couldn't be published:")).toBeVisible();
  await expect
    .element(alert.getByText("A page needs at least one question before publishing"))
    .toBeVisible();
  expect(screen.getByText("Published version 1").elements()).toEqual([]);
  expect(host.requests.filter((route) => route.startsWith("POST"))).toEqual([
    `POST /forms/${formId}/draft/publish`,
  ]);
});
