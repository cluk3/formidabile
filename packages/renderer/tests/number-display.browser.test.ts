import type { QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

const staticToken = async () => "token-1";
const id = (n: number) => `0192f0c4-0000-7000-8000-0000000002${String(n).padStart(2, "0")}`;

const posted = (requests: ReadonlyArray<{ method: string; body: unknown }>) =>
  requests.find((request) => request.method === "POST")?.body as {
    answers: Record<string, unknown>;
  };

const show = async (questions: QuestionSnapshot[]) => {
  const api = fakeApi(definitionOf(questions));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });
  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toBeVisible();
  return api;
};

test("a rating starts empty, and Clear answer takes the star back", async () => {
  const rating = {
    id: id(1),
    type: "number" as const,
    label: "Rating",
    required: false,
    config: { integer: true, min: 1, max: 5, display: "rating" as const },
  };
  const { requests } = await show([rating]);

  const four = page.getByRole("radio", { name: "4 stars" });
  await expect.element(four).not.toBeChecked();
  await userEvent.click(four);
  await expect.element(four).toBeChecked();
  await userEvent.click(page.getByRole("button", { name: "Clear answer" }));
  await expect.element(four).not.toBeChecked();
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({});
});

test("a scale shows its end labels and starts with nothing selected", async () => {
  const scale = {
    id: id(2),
    type: "number" as const,
    label: "Effort",
    required: false,
    config: {
      integer: true,
      min: 0,
      max: 5,
      display: "scale" as const,
      minLabel: "Easy",
      maxLabel: "Hard",
    },
  };
  const { requests } = await show([scale]);

  await expect.element(page.getByText("Easy")).toBeVisible();
  await expect.element(page.getByText("Hard")).toBeVisible();
  const three = page.getByRole("radio", { name: "3", exact: true });
  await expect.element(three).not.toBeChecked();
  await userEvent.click(three);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests)).toMatchObject({
    versionId,
    answers: { [scale.id]: 3 },
  });
});

test("an NPS scale starts empty and submits the number that was picked", async () => {
  const nps = {
    id: id(3),
    type: "number" as const,
    label: "Recommend?",
    required: false,
    config: {
      integer: true,
      min: 0,
      max: 10,
      display: "nps" as const,
      minLabel: "Not likely",
      maxLabel: "Very likely",
    },
  };
  const { requests } = await show([nps]);

  await expect.element(page.getByText("Not likely")).toBeVisible();
  await expect.element(page.getByText("Very likely")).toBeVisible();
  await expect.element(page.getByRole("radio", { name: "0", exact: true })).not.toBeChecked();
  await userEvent.click(page.getByRole("radio", { name: "9", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Clear answer" }));
  await userEvent.click(page.getByRole("radio", { name: "10", exact: true }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({ [nps.id]: 10 });
});

test("a slider shows Not answered and records nothing until it is moved", async () => {
  const slider = {
    id: id(4),
    type: "number" as const,
    label: "Amount",
    required: false,
    config: { integer: true, min: 0, max: 10, step: 1, display: "slider" as const },
  };
  const { requests } = await show([slider]);
  const control = page.getByRole("slider");

  await expect.element(page.getByText("Not answered")).toBeVisible();
  await expect.element(control).toHaveAttribute("aria-valuetext", "Not answered");
  expect(control.element().classList.contains("unset")).toBe(true);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({});
});

test("moving a slider records the value the respondent picked", async () => {
  const slider = {
    id: id(5),
    type: "number" as const,
    label: "Amount",
    required: true,
    config: { integer: true, min: 0, max: 10, step: 1, display: "slider" as const },
  };
  const { requests } = await show([slider]);
  const control = page.getByRole("slider");
  const input = control.element() as HTMLInputElement;
  input.value = "7";
  input.dispatchEvent(new Event("input", { bubbles: true }));

  await expect.element(page.getByText("Not answered")).not.toBeInTheDocument();
  await expect.element(page.getByText("7")).toBeVisible();
  expect(control.element().classList.contains("unset")).toBe(false);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({ [slider.id]: 7 });
});

test("a required slider does not submit its minimum before the respondent moves it", async () => {
  const slider = {
    id: id(6),
    type: "number" as const,
    label: "Amount",
    required: true,
    config: { integer: false, min: 0, max: 10, step: 1, display: "slider" as const },
  };
  const { requests } = await show([slider]);

  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Answer this question")).toBeVisible();
  expect(requests.filter((request) => request.method === "POST")).toEqual([]);
});

test("optional boolean and single-choice radios can clear an answer, and other controls cannot", async () => {
  const yes = {
    id: id(7),
    type: "boolean" as const,
    label: "Ready?",
    required: false,
    config: {},
  };
  const must = {
    id: id(8),
    type: "boolean" as const,
    label: "Agreed?",
    required: true,
    config: {},
  };
  const meal = {
    id: id(9),
    type: "single_choice" as const,
    label: "Meal",
    required: false,
    config: {
      display: "radio" as const,
      options: [
        { value: "fish", label: "Fish" },
        { value: "veg", label: "Vegetarian" },
      ],
    },
  };
  const size = {
    id: id(10),
    type: "single_choice" as const,
    label: "Size",
    required: true,
    config: {
      display: "radio" as const,
      options: [
        { value: "s", label: "Small" },
        { value: "m", label: "Medium" },
      ],
    },
  };
  const colour = {
    id: id(11),
    type: "single_choice" as const,
    label: "Colour",
    required: false,
    config: {
      display: "dropdown" as const,
      options: [
        { value: "red", label: "Red" },
        { value: "blue", label: "Blue" },
      ],
    },
  };
  const { requests } = await show([yes, must, meal, size, colour]);

  await expect.element(page.getByRole("button", { name: "Clear answer" }).nth(0)).toBeVisible();
  expect(page.getByRole("button", { name: "Clear answer" }).elements()).toHaveLength(2);

  await userEvent.click(
    page.getByRole("radiogroup", { name: "Ready?" }).getByRole("radio", { name: "Yes" }),
  );
  await userEvent.click(
    page
      .getByRole("radiogroup", { name: "Agreed?", exact: false })
      .getByRole("radio", { name: "No" }),
  );
  await userEvent.click(
    page.getByRole("radiogroup", { name: "Meal" }).getByRole("radio", { name: "Fish" }),
  );
  await userEvent.click(
    page
      .getByRole("radiogroup", { name: "Size", exact: false })
      .getByRole("radio", { name: "Small" }),
  );
  await userEvent.click(
    page.getByRole("radiogroup", { name: "Ready?" }).getByRole("button", { name: "Clear answer" }),
  );
  await userEvent.click(
    page.getByRole("radiogroup", { name: "Meal" }).getByRole("button", { name: "Clear answer" }),
  );
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({ [must.id]: false, [size.id]: "s" });
});
