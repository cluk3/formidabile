import type { QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

const staticToken = async () => "token-1";
const id = (n: number) => `0192f0c4-0000-7000-8000-0000000003${String(n).padStart(2, "0")}`;

const rows = [
  { value: "speed", label: "Speed" },
  { value: "comfort", label: "Comfort" },
];
const columns = [
  { value: "good", label: "Good" },
  { value: "poor", label: "Poor" },
];

const single = (required: boolean): QuestionSnapshot => ({
  id: id(1),
  type: "single_choice_matrix",
  label: "Trip",
  required,
  config: { rows, columns },
});

const multiple: QuestionSnapshot = {
  id: id(2),
  type: "multiple_choice_matrix",
  label: "Kit",
  required: false,
  config: { rows: [{ value: "items", label: "Items" }], columns },
};

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

/** The matrix's own width, which the container query reads. Not the viewport. */
const setWidth = async (width: string) => {
  const frame = (): HTMLElement | null => document.querySelector(".matrix");
  await expect.poll(frame).not.toBeNull();
  frame()!.style.width = width;
};

const shownAs = (selector: string) => getComputedStyle(document.querySelector(selector)!).display;

test("a wide matrix is a grid and a narrow one is a group per row", async () => {
  await show([single(false)]);

  await setWidth("40rem");
  await expect.poll(() => shownAs(".grid")).toBe("table");
  await expect.poll(() => shownAs(".stacked")).toBe("none");
  await expect.element(page.getByRole("columnheader", { name: "Good" })).toBeVisible();

  await setWidth("20rem");
  await expect.poll(() => shownAs(".grid")).toBe("none");
  await expect.poll(() => shownAs(".stacked")).toBe("flex");
  await expect.element(page.getByRole("group", { name: "Speed", exact: true })).toBeVisible();
  await expect.element(page.getByRole("group", { name: "Comfort", exact: true })).toBeVisible();
});

test("an optional single-choice row can clear its answer", async () => {
  const { requests } = await show([single(false)]);
  await setWidth("40rem");
  const good = page.getByRole("radio", { name: "Speed, Good" });

  await userEvent.click(good);
  await expect.element(good).toBeChecked();
  await userEvent.click(page.getByRole("button", { name: "Clear answer" }).first());
  await expect.element(good).not.toBeChecked();
  await userEvent.click(page.getByRole("radio", { name: "Comfort, Poor" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests).answers).toEqual({ [single(false).id]: { comfort: "poor" } });
});

test("a required single-choice matrix has no Clear answer and needs every row", async () => {
  await show([single(true)]);
  await setWidth("40rem");

  await expect.element(page.getByRole("button", { name: "Clear answer" })).not.toBeInTheDocument();
  await userEvent.click(page.getByRole("radio", { name: "Speed, Good" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  await userEvent.click(page.getByRole("radio", { name: "Comfort, Poor" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
});

test("a multiple-choice row submits every ticked column and can be emptied", async () => {
  const { requests } = await show([multiple]);
  await setWidth("20rem");
  const group = page.getByRole("group", { name: "Items" });

  await userEvent.click(group.getByRole("checkbox", { name: "Items, Good" }));
  await userEvent.click(group.getByRole("checkbox", { name: "Items, Poor" }));
  await userEvent.click(group.getByRole("checkbox", { name: "Items, Good" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posted(requests)).toMatchObject({
    versionId,
    answers: { [multiple.id]: { items: ["poor"] } },
  });
});
