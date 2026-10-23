import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";

afterEach(() => {
  vi.unstubAllGlobals();
});

const labelled = (label: string) => page.getByLabelText(label, { exact: false });

const gateId = "00000000-0000-4000-8000-000000000001";
const moreId = "00000000-0000-4000-8000-000000000002";
const noteId = "00000000-0000-4000-8000-000000000003";
const pageA = "00000000-0000-4000-8000-0000000000a1";
const pageB = "00000000-0000-4000-8000-0000000000a2";
const pageC = "00000000-0000-4000-8000-0000000000a3";

const text = (id: string, label: string, required = true): QuestionSnapshot => ({
  id,
  type: "text",
  label,
  required,
  config: { display: "single_line" },
});

/** Answering "done" jumps to the end. Anything else continues. */
const earlyEnd = {
  format: 2 as const,
  title: "Route",
  pages: [
    {
      id: pageA,
      questions: [text(gateId, "Gate")],
      jumps: [
        { condition: { questionId: gateId, operator: "equals", constant: "done" }, target: "end" },
      ],
    },
    { id: pageB, title: "More", questions: [text(moreId, "More")], jumps: [] },
  ],
} satisfies FormDefinition;

/**
 * "skip" jumps to the middle page. That page's only question is hidden, and its jump ends the form,
 * so the button on the first page already reads Submit.
 */
const passedOver = {
  format: 2 as const,
  title: "Route",
  pages: [
    {
      id: pageA,
      questions: [text(gateId, "Gate")],
      jumps: [
        { condition: { questionId: gateId, operator: "equals", constant: "skip" }, target: pageB },
      ],
    },
    {
      id: pageB,
      title: "Hidden",
      questions: [
        {
          ...text(moreId, "More"),
          showCondition: { questionId: gateId, operator: "equals", constant: "never" },
        },
      ],
      jumps: [
        { condition: { questionId: gateId, operator: "equals", constant: "skip" }, target: "end" },
      ],
    },
    { id: pageC, title: "After", questions: [text(noteId, "Note", false)], jumps: [] },
  ],
} satisfies FormDefinition;

/** "later" jumps over the middle page to the last one. The button stays Next. */
const jumpAhead = {
  format: 2 as const,
  title: "Route",
  pages: [
    {
      id: pageA,
      title: "Start",
      questions: [text(gateId, "Gate")],
      jumps: [
        { condition: { questionId: gateId, operator: "equals", constant: "later" }, target: pageC },
      ],
    },
    { id: pageB, title: "Middle", questions: [text(moreId, "More")], jumps: [] },
    { id: pageC, title: "Last", questions: [text(noteId, "Note", false)], jumps: [] },
  ],
} satisfies FormDefinition;

test("the button reads Submit when a jump ends the form, and Next when it does not", async () => {
  await render(FormRenderer, { preview: earlyEnd });

  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  expect(page.getByRole("button", { name: "Submit" }).elements()).toEqual([]);

  await userEvent.fill(labelled("Gate"), "done");
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByRole("button", { name: "Next" }).elements()).toEqual([]);
  expect(page.getByLabelText("More", { exact: false }).elements()).toEqual([]);

  await userEvent.fill(labelled("Gate"), "continue");
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();

  await userEvent.fill(labelled("Gate"), "done");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(page.getByLabelText("More", { exact: false }).elements()).toEqual([]);
});

test("Submit is shown when a passed-over page's jump ends the form", async () => {
  await render(FormRenderer, { preview: passedOver });

  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  await userEvent.fill(labelled("Gate"), "skip");
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByRole("heading", { name: "Hidden" }).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(page.getByLabelText("Note", { exact: false }).elements()).toEqual([]);
});

test("Next lands on the jump's page and Back returns without taking the jump again", async () => {
  await render(FormRenderer, { preview: jumpAhead });

  await userEvent.fill(labelled("Gate"), "later");
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Next" }));

  await expect.element(page.getByRole("heading", { name: "Last" })).toBeVisible();
  expect(page.getByRole("heading", { name: "Middle" }).elements()).toEqual([]);
  expect(page.getByLabelText("More", { exact: false }).elements()).toEqual([]);
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(page.getByRole("heading", { name: "Start" })).toBeVisible();
  await expect.element(labelled("Gate")).toHaveValue("later");
  expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
});
