import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { fakeApi } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const pageId = "00000000-0000-4000-8000-0000000000a1";
const missingId = "00000000-0000-4000-8000-000000000099";

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

const draft = (questions: QuestionSnapshot[]): FormDefinition => ({
  format: 2,
  title: "Broken draft",
  pages: [{ id: pageId, questions, jumps: [] }],
});

const labelled = (label: string) => page.getByLabelText(label, { exact: false });

test("preview treats a missing or not-earlier question as unanswered and still runs", async () => {
  const laterId = "00000000-0000-4000-8000-000000000002";
  const { fetch } = fakeApi({ format: 1, title: "Unused", questions: [] });
  await render(FormRenderer, {
    preview: draft([
      text("00000000-0000-4000-8000-000000000011", "Missing equals", {
        questionId: missingId,
        operator: "equals",
        constant: "yes",
      }),
      text("00000000-0000-4000-8000-000000000012", "Missing unanswered", {
        questionId: missingId,
        operator: "is_not_answered",
      }),
      text("00000000-0000-4000-8000-000000000013", "Before equals", {
        questionId: laterId,
        operator: "equals",
        constant: "yes",
      }),
      text("00000000-0000-4000-8000-000000000014", "Before unanswered", {
        questionId: laterId,
        operator: "is_not_answered",
      }),
      text(laterId, "Later"),
    ]),
  });

  await expect.element(page.getByRole("heading", { name: "Broken draft" })).toBeVisible();
  expect(labelled("Missing equals").elements()).toEqual([]);
  await expect.element(labelled("Missing unanswered")).toBeVisible();
  expect(labelled("Before equals").elements()).toEqual([]);
  await expect.element(labelled("Before unanswered")).toBeVisible();

  await userEvent.fill(labelled("Later"), "yes");
  expect(labelled("Before equals").elements()).toEqual([]);
  await expect.element(labelled("Before unanswered")).toBeVisible();

  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

test("preview treats a missing option value as unanswered, so is none of stays hidden", async () => {
  const mealId = "00000000-0000-4000-8000-000000000021";
  const { fetch } = fakeApi({ format: 1, title: "Unused", questions: [] });
  const meal: QuestionSnapshot = {
    id: mealId,
    type: "single_choice",
    label: "Meal",
    required: false,
    config: {
      display: "radio",
      options: [
        { value: "fish", label: "Fish" },
        { value: "meat", label: "Meat" },
      ],
    },
  };
  await render(FormRenderer, {
    preview: draft([
      meal,
      text("00000000-0000-4000-8000-000000000022", "None of the missing option", {
        questionId: mealId,
        operator: "is_none_of",
        constant: ["veg"],
      }),
      text("00000000-0000-4000-8000-000000000023", "Any of the missing option", {
        questionId: mealId,
        operator: "is_any_of",
        constant: ["veg"],
      }),
    ]),
  });

  await userEvent.click(page.getByRole("radio", { name: "Fish" }));
  expect(labelled("None of the missing option").elements()).toEqual([]);
  expect(labelled("Any of the missing option").elements()).toEqual([]);
  await expect.element(page.getByRole("radio", { name: "Fish" })).toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
