import { questionsOf, type FormDefinition, type QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000f401";
const cityId = "0192f0c4-0000-7000-8000-00000000f411";
const detailId = "0192f0c4-0000-7000-8000-00000000f412";
const openId = "0192f0c4-0000-7000-8000-00000000f413";
const mealId = "0192f0c4-0000-7000-8000-00000000f414";
const dietId = "0192f0c4-0000-7000-8000-00000000f415";

const text = (
  id: string,
  label: string,
  showCondition?: QuestionSnapshot["showCondition"],
): QuestionSnapshot => ({
  id,
  type: "text",
  label,
  required: false,
  config: { display: "single_line" },
  ...(showCondition === undefined ? {} : { showCondition }),
});

const city = text(cityId, "City");
const detail = text(detailId, "Details", {
  questionId: cityId,
  operator: "equals",
  constant: "Rome",
});
const open = text(openId, "Open note", { questionId: cityId, operator: "is_not_answered" });

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
const diet = text(dietId, "Diet note", {
  questionId: mealId,
  operator: "is_none_of",
  constant: ["veg"],
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = (definition: FormDefinition) => {
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

const renderEditor = async (definition: FormDefinition) => {
  const host = draftHost(definition);
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, host.fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });
  return { host, screen };
};

const warning = "This draft has broken logic. A broken reference counts as unanswered.";

const savedQuestions = (saves: SaveBody[]) => {
  const body = saves.at(-1)?.definition;
  if (body === undefined) throw new Error("nothing was saved");
  return questionsOf(body);
};

test("removing a question leaves its conditions, marks them broken, and preview still runs", async () => {
  const { host, screen } = await renderEditor({
    format: 1,
    title: "Survey",
    questions: [city, detail, open],
  });
  await screen
    .getByRole("region", { name: "Question 1" })
    .getByRole("button", { name: "Remove question" })
    .click();

  const details = screen.getByRole("region", { name: "Question 1" });
  const note = screen.getByRole("region", { name: "Question 2" });
  await expect
    .element(details.getByText("This condition reads a question that is not earlier in the form"))
    .toBeVisible();
  await expect.element(details.getByLabelText("Question")).toHaveValue(cityId);
  await expect
    .element(note.getByText("This condition reads a question that is not earlier in the form"))
    .toBeVisible();
  await expect.element(note.getByLabelText("Question")).toHaveValue(cityId);

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(1);
  expect(savedQuestions(host.saves).map((question) => question.showCondition)).toEqual([
    { questionId: cityId, operator: "equals", constant: "Rome" },
    { questionId: cityId, operator: "is_not_answered" },
  ]);

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByText(warning)).toBeVisible();
  await expect.element(preview.getByLabelText(/^Open note/)).toBeVisible();
  await expect.element(preview.getByLabelText(/^Details/)).not.toBeInTheDocument();
  await preview.getByRole("button", { name: "Submit" }).click();
  await expect
    .element(preview.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
});

test("removing an option leaves the condition that names it, and preview counts it as unanswered", async () => {
  const { host, screen } = await renderEditor({
    format: 1,
    title: "Survey",
    questions: [meal, diet],
  });
  await screen
    .getByRole("region", { name: "Question 1" })
    .getByRole("button", { name: "Remove option 1" })
    .click();

  const followUp = screen.getByRole("region", { name: "Question 2" });
  await expect
    .element(followUp.getByText("This condition names an option value the question does not have"))
    .toBeVisible();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(1);
  expect(savedQuestions(host.saves)[1]?.showCondition).toEqual({
    questionId: mealId,
    operator: "is_none_of",
    constant: ["veg"],
  });

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByText(warning)).toBeVisible();
  await preview.getByRole("radio", { name: "Fish" }).click();
  await expect.element(preview.getByLabelText(/^Diet note/)).not.toBeInTheDocument();
  await expect.element(preview.getByRole("radio", { name: "Fish" })).toBeChecked();
});

test("moving a question below a condition that reads it marks that condition broken", async () => {
  const { host, screen } = await renderEditor({
    format: 1,
    title: "Survey",
    questions: [city, detail],
  });
  await screen
    .getByRole("region", { name: "Question 1" })
    .getByRole("button", { name: "Move down" })
    .click();

  const card = screen.getByRole("region", { name: "Question 1" });
  await expect
    .element(card.getByText("This condition reads a question that is not earlier in the form"))
    .toBeVisible();
  await expect.element(card.getByLabelText("Question")).toHaveValue(cityId);

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(1);
  const questions = savedQuestions(host.saves);
  expect(questions.map((question) => question.id)).toEqual([detailId, cityId]);
  expect(questions[0]?.showCondition).toEqual({
    questionId: cityId,
    operator: "equals",
    constant: "Rome",
  });

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByText(warning)).toBeVisible();
  await preview.getByLabelText(/^City/).fill("Rome");
  await expect.element(preview.getByLabelText(/^Details/)).not.toBeInTheDocument();
});

test("treat as a new question points every condition at the new identity", async () => {
  const { host, screen } = await renderEditor({
    format: 1,
    title: "Survey",
    questions: [city, detail],
  });
  await screen
    .getByRole("region", { name: "Question 1" })
    .getByRole("button", { name: "Treat as a new question" })
    .click();

  await expect
    .element(screen.getByRole("list", { name: "Show condition problems" }))
    .not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Preview" }).click();
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect.element(preview.getByText(warning)).not.toBeInTheDocument();
  await expect.element(preview.getByLabelText(/^Details/)).not.toBeInTheDocument();
  await preview.getByLabelText(/^City/).fill("Rome");
  await expect.element(preview.getByLabelText(/^Details/)).toBeVisible();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => host.saves.length).toBe(1);
  const questions = savedQuestions(host.saves);
  expect(questions[0]?.id).not.toBe(cityId);
  expect(questions[1]?.showCondition).toEqual({
    questionId: questions[0]?.id,
    operator: "equals",
    constant: "Rome",
  });
});
