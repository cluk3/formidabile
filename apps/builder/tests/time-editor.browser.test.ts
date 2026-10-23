import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { questionsOf, validateForPublish } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const definitionOf = (questions: QuestionSnapshot[] = []): FormDefinition => ({
  format: 1,
  title: "Survey",
  questions,
});

const draftOf = (definition: unknown, revision: string) => ({
  formId,
  revision,
  basedOnVersionId: null,
  definition,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = (definition: FormDefinition) => {
  let draft = draftOf(definition, "r0");
  const saves: SaveBody[] = [];
  const fetch = fakeHost(async (route, request) => {
    if (route === `GET /forms/${formId}/draft`) return json(200, { draft });
    if (route === `GET /forms/${formId}`)
      return json(200, {
        id: formId,
        availability: "closed",
        responseLimit: "unlimited",
        currentVersion: null,
        externalRefs: [],
      });
    if (route === `PUT /forms/${formId}/draft`) {
      const body: SaveBody = await request.json();
      saves.push(body);
      draft = draftOf(body.definition, `r${saves.length}`);
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
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

test("the time of day editor sets an optional earliest and latest", async () => {
  const host = draftHost(definitionOf());
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("New question type").selectOptions("Time of day");
  await screen.getByRole("button", { name: "Add question" }).click();
  const card = question(screen, 1);
  await card.getByLabelText("Label").fill("Arrival time");
  await card.getByLabelText("Earliest time").fill("09:00");
  await card.getByLabelText("Latest time").fill("17:00");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = () => {
    const definition = host.saves.at(-1)?.definition;
    if (definition === undefined) throw new Error("missing save");
    return { definition, question: questionsOf(definition)[0] };
  };

  expect(saved().question).toMatchObject({
    type: "time_of_day",
    label: "Arrival time",
    config: { earliest: "09:00", latest: "17:00" },
  });
  expect(validateForPublish(saved().definition, [])).toMatchObject({ ok: true });

  await card.getByLabelText("Earliest time").fill("18:00");
  await card.getByLabelText("Latest time").fill("09:00");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const inverted = saved();
  expect(inverted.question).toMatchObject({ config: { earliest: "18:00", latest: "09:00" } });
  const published = validateForPublish(inverted.definition, []);
  expect(published.ok).toBe(false);
  if (!published.ok)
    expect(published.issues.some((issue) => issue.path.at(-1) === "latest")).toBe(true);

  await card.getByLabelText("Latest time").fill("");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  expect(saved().question?.config).toEqual({ earliest: "18:00" });
});

test("a show condition compares a time of day with the native time input", async () => {
  const host = draftHost(definitionOf());
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("New question type").selectOptions("Time of day");
  await screen.getByRole("button", { name: "Add question" }).click();
  await question(screen, 1).getByLabelText("Label").fill("Arrival time");

  await screen.getByLabelText("New question type").selectOptions("Text");
  await screen.getByRole("button", { name: "Add question" }).click();
  const notes = question(screen, 2);
  await notes.getByLabelText("Label").fill("Notes");
  await notes.getByRole("button", { name: "Only show when…" }).click();

  const value = notes.getByLabelText("Value");
  await expect.element(value).toHaveAttribute("type", "time");
  await expect.element(notes.getByLabelText("Operator")).toHaveValue("is_at");
  await value.fill("09:30");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = host.saves.at(-1)?.definition;
  if (saved === undefined) throw new Error("missing save");
  const [arrival, follower] = questionsOf(saved);
  expect(follower?.showCondition).toEqual({
    questionId: arrival?.id,
    operator: "is_at",
    constant: "09:30",
  });
});
