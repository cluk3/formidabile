import { questionsOf, type FormDefinition, type QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000f301";
const cityId = "0192f0c4-0000-7000-8000-00000000f311";
const mealId = "0192f0c4-0000-7000-8000-00000000f312";
const detailId = "0192f0c4-0000-7000-8000-00000000f313";

const city: QuestionSnapshot = {
  id: cityId,
  type: "text",
  label: "City",
  required: false,
  config: { display: "single_line" },
};
const meal: QuestionSnapshot = {
  id: mealId,
  type: "single_choice",
  label: "Meal",
  required: false,
  config: {
    display: "radio",
    options: [
      { value: "veg", label: "Vegetarian" },
      { value: "fish", label: "Fish" },
    ],
  },
};
const detail: QuestionSnapshot = {
  id: detailId,
  type: "text",
  label: "Details",
  required: false,
  config: { display: "single_line" },
};

const definition = {
  format: 1 as const,
  title: "Survey",
  questions: [city, meal, detail],
} satisfies FormDefinition;

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = () => {
  let draft: {
    formId: string;
    revision: string;
    basedOnVersionId: null;
    definition: FormDefinition;
    updatedAt: string;
  } = {
    formId,
    revision: "r0",
    basedOnVersionId: null,
    definition,
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
  const saves: SaveBody[] = [];
  const fetch: typeof globalThis.fetch = fakeHost(async (route, request) => {
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
      draft = { ...draft, revision: `r${saves.length}`, definition: body.definition };
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
};

const savedQuestion = (saves: SaveBody[], index: number) => {
  const body = saves.at(-1)?.definition;
  if (body === undefined) throw new Error("nothing was saved");
  return questionsOf(body)[index];
};

test("an editor sets a show condition by question identity and can clear it", async () => {
  const host = draftHost();
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, host.fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });
  const card = screen.getByRole("region", { name: "Question 3" });
  await card.getByRole("button", { name: "Only show when…" }).click();
  await card.getByLabelText("Value").fill("Rome");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(1);
  expect(savedQuestion(host.saves, 2)?.showCondition).toEqual({
    questionId: cityId,
    operator: "equals",
    constant: "Rome",
  });

  await card.getByRole("button", { name: "Combine with another condition" }).click();
  await card.getByLabelText("Question").nth(1).selectOptions(mealId);
  await card.getByRole("checkbox", { name: "Vegetarian" }).click();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(2);
  expect(savedQuestion(host.saves, 2)?.showCondition).toEqual({
    all: [
      { questionId: cityId, operator: "equals", constant: "Rome" },
      { questionId: mealId, operator: "is_any_of", constant: ["veg"] },
    ],
  });

  await card.getByRole("button", { name: "Always show" }).click();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(3);
  expect(savedQuestion(host.saves, 2)).not.toHaveProperty("showCondition");
});
