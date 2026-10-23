import type { QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

const staticToken = async () => "token-1";
const rankingId = "0192f0c4-0000-7000-8000-0000000000b1";

const ranking = (required: boolean): QuestionSnapshot => ({
  id: rankingId,
  type: "ranking",
  label: "Priorities",
  required,
  config: {
    options: [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
      { value: "c", label: "Gamma" },
    ],
  },
});

const posted = (requests: ReadonlyArray<{ method: string; body: unknown }>) =>
  requests.find((request) => request.method === "POST")?.body as
    | { answers: Record<string, unknown>; versionId: string }
    | undefined;

const show = async (question: QuestionSnapshot) => {
  const api = fakeApi(definitionOf([question]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });
  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toBeVisible();
  return api;
};

test("a ranking starts unranked, and a partial order is not an answer", async () => {
  const { requests } = await show(ranking(false));

  await expect.element(page.getByText("Nothing ranked yet.")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Add Alpha" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Add Alpha" }));
  await userEvent.click(page.getByRole("button", { name: "Add Beta" }));
  await expect.element(page.getByRole("button", { name: "Add Gamma" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests)).toMatchObject({ versionId, answers: {} });
});

test("adding every option and moving one records that order, including from the keyboard", async () => {
  const { requests } = await show(ranking(false));

  await userEvent.click(page.getByRole("button", { name: "Add Gamma" }));
  await userEvent.click(page.getByRole("button", { name: "Add Alpha" }));
  await userEvent.click(page.getByRole("button", { name: "Add Beta" }));
  await expect.element(page.getByRole("button", { name: "Add Alpha" })).not.toBeInTheDocument();

  const moveGamma = page.getByRole("button", { name: "Move Gamma down" });
  moveGamma.element().focus();
  await userEvent.keyboard("{ArrowDown}");
  // The keyboard stays on the same Move down button, so another ArrowDown keeps moving Gamma.
  await expect.element(page.getByRole("button", { name: "Move Gamma down" })).toHaveFocus();
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  // Added Gamma, Alpha, Beta, then Gamma moved down one place: Alpha, Gamma, Beta.
  expect(posted(requests)?.answers).toEqual({ [rankingId]: ["a", "c", "b"] });
});

test("a required ranking stays unanswered until every option is placed", async () => {
  const { requests } = await show(ranking(true));

  await userEvent.click(page.getByRole("button", { name: "Add Alpha" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Answer this question")).toBeVisible();
  expect(posted(requests)).toBeUndefined();

  await userEvent.click(page.getByRole("button", { name: "Add Beta" }));
  await userEvent.click(page.getByRole("button", { name: "Add Gamma" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests)?.answers).toEqual({ [rankingId]: ["a", "b", "c"] });
});
