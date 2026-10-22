import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { validateForPublish } from "@fb/core/definition";
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

test("display and step settings stay on the same number question", async () => {
  const host = draftHost(definitionOf());
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("New question type").selectOptions("Number");
  await screen.getByRole("button", { name: "Add question" }).click();
  const card = question(screen, 1);
  await card.getByLabelText("Label").fill("Score");
  await card.getByLabelText("Step").fill("0.5");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const input = host.saves[0]?.definition.questions[0];
  expect(input).toMatchObject({
    type: "number",
    label: "Score",
    config: { integer: false, display: "input", step: 0.5 },
  });

  await card.getByRole("combobox", { name: "Display" }).selectOptions("Stars");
  await card.getByRole("combobox", { name: "Stars" }).selectOptions("8");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const rating = host.saves[1]?.definition.questions[0];
  expect(rating?.id).toBe(input?.id);
  expect(rating?.config).toEqual({
    integer: true,
    display: "rating",
    min: 1,
    max: 8,
    step: 0.5,
  });

  await card.getByRole("combobox", { name: "Display" }).selectOptions("Scale");
  await card.getByRole("combobox", { name: "Starts at" }).selectOptions("0");
  await card.getByRole("combobox", { name: "Ends at" }).selectOptions("10");
  await card.getByLabelText("Low end label").fill("Low");
  await card.getByLabelText("High end label").fill("High");
  await card.getByLabelText("Step").fill("1");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  expect(host.saves[2]?.definition.questions[0]).toMatchObject({
    id: input?.id,
    config: {
      integer: true,
      display: "scale",
      min: 0,
      max: 10,
      step: 1,
      minLabel: "Low",
      maxLabel: "High",
    },
  });

  await card.getByRole("combobox", { name: "Display" }).selectOptions("Slider");
  await card.getByLabelText("Minimum").fill("0");
  await card.getByLabelText("Maximum").fill("100");
  await card.getByLabelText("Step").fill("5");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const slider = host.saves[3]?.definition.questions[0];
  expect(slider).toMatchObject({
    id: input?.id,
    config: { integer: true, display: "slider", min: 0, max: 100, step: 5 },
  });
  expect(validateForPublish(host.saves[3]!.definition, [])).toMatchObject({ ok: true });

  await card.getByRole("combobox", { name: "Display" }).selectOptions("NPS");
  await card.getByLabelText("Low end label").fill("Not likely");
  await card.getByLabelText("High end label").fill("Very likely");
  await expect.element(card.getByText("Whole numbers from 0 to 10.")).toBeVisible();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const nps = host.saves[4]?.definition.questions[0];
  expect(nps).toMatchObject({
    id: input?.id,
    config: {
      integer: true,
      display: "nps",
      min: 0,
      max: 10,
      minLabel: "Not likely",
      maxLabel: "Very likely",
    },
  });
  expect(validateForPublish(host.saves[4]!.definition, [host.saves[3]!.definition])).toMatchObject({
    ok: true,
  });
});
