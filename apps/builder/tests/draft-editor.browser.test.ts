import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const textQuestion = (label: string): QuestionSnapshot => ({
  id: crypto.randomUUID(),
  type: "text",
  label,
  required: false,
  config: { display: "single_line" },
});

const definitionOf = (title: string, questions: QuestionSnapshot[] = []): FormDefinition => ({
  format: 1,
  title,
  questions,
});

const draftOf = (definition: unknown, revision: string) => ({
  formId,
  revision,
  basedOnVersionId: null,
  definition,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

const detailOf = (currentVersion: { id: string; number: number } | null) => ({
  id: formId,
  availability: "closed",
  responseLimit: "unlimited",
  currentVersion,
  externalRefs: [],
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

type DraftHost = {
  fetch: typeof globalThis.fetch;
  saves: SaveBody[];
  draftReads: number;
  /** Replaces the stored draft, under a new revision. */
  store: (definition: unknown) => void;
};

/**
 * A host holding one form's draft. A save stores the definition under a new revision, unless `save` answers it
 * instead.
 */
const draftHost = (
  definition: FormDefinition,
  save?: (body: SaveBody, host: DraftHost) => Response,
) => {
  let draft = draftOf(definition, "r0");
  const host: DraftHost = {
    saves: [],
    draftReads: 0,
    store: (stored: unknown) => {
      draft = draftOf(stored, `r${host.saves.length}`);
    },
    fetch: fakeHost(async (route, request) => {
      if (route === `GET /forms/${formId}/draft`) {
        host.draftReads += 1;
        return json(200, { draft });
      }
      if (route === `GET /forms/${formId}`) return json(200, detailOf(null));
      if (route === `PUT /forms/${formId}/draft`) {
        const body: SaveBody = await request.json();
        host.saves.push(body);
        if (save !== undefined) return save(body, host);
        host.store(body.definition);
        return json(200, draft);
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

const question = (screen: Awaited<ReturnType<typeof renderEditor>>, n: number) =>
  screen.getByRole("region", { name: `Question ${n}` });

test("moving a question from the keyboard reorders it and keeps focus on it", async () => {
  const host = draftHost(
    definitionOf("Survey", [textQuestion("A"), textQuestion("B"), textQuestion("C")]),
  );
  const screen = await renderEditor(host.fetch);
  await expect.element(question(screen, 3)).toBeVisible();

  question(screen, 1).getByRole("button", { name: "Move down" }).element().focus();
  await userEvent.keyboard("{Enter}");

  await expect.element(question(screen, 1).getByLabelText("Label")).toHaveValue("B");
  await expect.element(question(screen, 2).getByLabelText("Label")).toHaveValue("A");
  await expect
    .element(question(screen, 2).getByRole("button", { name: "Move down" }))
    .toHaveFocus();

  // At the top, "Move up" is disabled, so focus moves to the same question's "Move down".
  question(screen, 2).getByRole("button", { name: "Move up" }).element().focus();
  await userEvent.keyboard("{Enter}");

  await expect.element(question(screen, 1).getByLabelText("Label")).toHaveValue("A");
  await expect.element(question(screen, 1).getByRole("button", { name: "Move up" })).toBeDisabled();
  await expect
    .element(question(screen, 1).getByRole("button", { name: "Move down" }))
    .toHaveFocus();
});

test("every question type can be added, configured and saved as a publishable draft", async () => {
  const host = draftHost(definitionOf("Survey"));
  const screen = await renderEditor(host.fetch);

  const types = [
    "Text",
    "Email",
    "Number",
    "Date",
    "Single choice",
    "Multiple choice",
    "Yes/no",
  ] as const;
  for (const [i, type] of types.entries()) {
    await screen.getByLabelText("New question type").selectOptions(type);
    await screen.getByRole("button", { name: "Add question" }).click();
    await question(screen, i + 1)
      .getByLabelText("Label")
      .fill(`${type} question`);
  }

  await question(screen, 1).getByLabelText("Long answer").click();
  await question(screen, 1).getByLabelText("Maximum length").fill("280");
  await question(screen, 3).getByLabelText("Whole numbers only").click();
  await question(screen, 3).getByLabelText("Minimum").fill("1");
  await question(screen, 3).getByLabelText("Maximum").fill("10");
  await question(screen, 4).getByLabelText("Earliest date").fill("2026-01-01");

  const single = question(screen, 5);
  await single.getByLabelText("Option 1").fill("Red");
  await single.getByLabelText("Option 2").fill("Blue");
  await single.getByRole("button", { name: "Add option" }).click();
  await single.getByLabelText("Option 3").fill("Green");
  await single.getByRole("button", { name: "Remove option 2" }).click();
  await single.getByLabelText("Dropdown").click();

  const multiple = question(screen, 6);
  await multiple.getByLabelText("Option 1").fill("Tea");
  await multiple.getByRole("button", { name: "Add option" }).click();
  await multiple.getByLabelText("Option 2").fill("Coffee");
  await multiple.getByLabelText("Most selections").fill("2");
  await question(screen, 7).getByLabelText("Required").click();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const [save] = host.saves;
  expect(save?.expectedRevision).toBe("r0");
  expect(validateForPublish(save?.definition, [])).toMatchObject({ ok: true });
  const questions = save?.definition.questions ?? [];
  expect(questions.map((q) => q.type)).toEqual([
    "text",
    "email",
    "number",
    "date",
    "single_choice",
    "multiple_choice",
    "boolean",
  ]);
  expect(new Set(questions.map((q) => q.id)).size).toBe(7);
  expect(questions.map((q) => q.config)).toEqual([
    { display: "multi_line", maxLength: 280 },
    {},
    { integer: true, min: 1, max: 10 },
    { min: "2026-01-01" },
    {
      display: "dropdown",
      options: [
        { value: expect.any(String), label: "Red" },
        { value: expect.any(String), label: "Green" },
      ],
    },
    {
      options: [
        { value: expect.any(String), label: "Tea" },
        { value: expect.any(String), label: "Coffee" },
      ],
      maxSelected: 2,
    },
    {},
  ]);
  expect(questions[6]?.required).toBe(true);
});

test("treating a question as new, or changing its type, gives it a new identity", async () => {
  const original = textQuestion("How was it?");
  const host = draftHost(definitionOf("Survey", [original, textQuestion("Anything else?")]));
  const screen = await renderEditor(host.fetch);

  await question(screen, 1).getByRole("button", { name: "Treat as a new question" }).click();
  await question(screen, 2).getByLabelText("Type").selectOptions("Number");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const [first, second] = host.saves[0]?.definition.questions ?? [];
  expect(first).toEqual({ ...original, id: expect.any(String) });
  expect(first?.id).not.toBe(original.id);
  expect(second).toMatchObject({ type: "number", label: "Anything else?" });
});

test("a published form without a draft is edited from its current version", async () => {
  const versionId = crypto.randomUUID();
  const published = definitionOf("Published", [textQuestion("Q")]);
  const saves: SaveBody[] = [];
  const fetch = fakeHost(async (route, request) => {
    if (route === `GET /forms/${formId}/draft`) return json(200, { draft: null });
    if (route === `GET /forms/${formId}`) return json(200, detailOf({ id: versionId, number: 1 }));
    if (route === `GET /forms/${formId}/versions/${versionId}`)
      return json(200, { id: versionId, number: 1, isCurrent: true, definition: published });
    if (route === `PUT /forms/${formId}/draft`) {
      const body: SaveBody = await request.json();
      saves.push(body);
      return json(200, draftOf(body.definition, "r1"));
    }
    return json(404, { _tag: "NotFound" });
  });
  const screen = await renderEditor(fetch);

  await screen.getByLabelText("Form title").fill("Published, revised");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  expect(saves).toEqual([
    { expectedRevision: null, definition: { ...published, title: "Published, revised" } },
  ]);
});

test("on a revision conflict the editor can stay with its changes or reload the latest draft", async () => {
  const host = draftHost(definitionOf("Ours"), (_body, { store }) => {
    store(definitionOf("Theirs"));
    return json(409, { _tag: "RevisionConflict" });
  });
  const screen = await renderEditor(host.fetch);
  const title = screen.getByLabelText("Form title");

  await title.fill("Mine");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText(/changed since you opened it/i)).toBeVisible();
  await screen.getByRole("button", { name: "Keep my changes" }).click();

  await expect.element(screen.getByText(/changed since you opened it/i)).not.toBeInTheDocument();
  await expect.element(title).toHaveValue("Mine");

  await screen.getByRole("button", { name: "Save" }).click();
  await screen.getByRole("button", { name: "Reload" }).click();

  await expect.element(title).toHaveValue("Theirs");
});

test("a 413 shows that the form is too large to save", async () => {
  const host = draftHost(
    definitionOf("Survey"),
    () =>
      new Response(JSON.stringify({ _tag: "PayloadTooLarge", limit: 1_048_576 }), {
        status: 413,
        headers: { "content-type": "application/json" },
      }),
  );
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("Form title").fill("Huge");
  await screen.getByRole("button", { name: "Save" }).click();

  await expect.element(screen.getByText("This form is too large to save")).toBeVisible();
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Huge");
});

test("an unknown outcome on save says so and reloads the draft", async () => {
  // The host commits the save, but the reply is lost to a proxy's 502.
  const host = draftHost(definitionOf("Survey"), (body, { store }) => {
    store({ ...body.definition, title: body.definition.title.trim() });
    return new Response("Bad Gateway", { status: 502 });
  });
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("Form title").fill("  Committed  ");
  await screen.getByRole("button", { name: "Save" }).click();

  await expect.element(screen.getByText(/couldn.t confirm the draft was saved/i)).toBeVisible();
  await expect.element(screen.getByLabelText("Form title")).toHaveValue("Committed");
  expect(host.draftReads).toBe(2);
});
