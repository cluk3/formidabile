import type { QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stay = {
  id: "0192f0c4-0000-7000-8000-000000000201",
  type: "date_range",
  label: "Stay",
  required: false,
  config: { min: "2026-01-01", max: "2026-12-31" },
} satisfies QuestionSnapshot;

const renderStay = () => {
  const api = fakeApi(definitionOf([stay]));
  return {
    ...api,
    screen: render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" }),
  };
};

test("a date range is two native date inputs, From and To, in one group", async () => {
  renderStay();

  const group = page.getByRole("group", { name: "Stay" });
  await expect.element(group).toBeVisible();
  const from = group.getByLabelText("From");
  const to = group.getByLabelText("To");
  await expect.element(from).toHaveAttribute("type", "date");
  await expect.element(to).toHaveAttribute("type", "date");
  await expect.element(from).toHaveAttribute("min", "2026-01-01");
  await expect.element(from).toHaveAttribute("max", "2026-12-31");
  await expect.element(to).toHaveAttribute("min", "2026-01-01");
  await expect.element(to).toHaveAttribute("max", "2026-12-31");
});

test("filling both dates submits the range, and leaving both empty sends no key", async () => {
  const { requests } = renderStay();

  await userEvent.fill(page.getByLabelText("From"), "2026-05-02");
  await userEvent.fill(page.getByLabelText("To"), "2026-05-09");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toMatchObject({
    answers: { [stay.id]: { start: "2026-05-02", end: "2026-05-09" } },
  });
});

test("an optional date range left empty has no answer key", async () => {
  const { requests } = renderStay();

  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toMatchObject({ answers: {} });
});

test("half a range, and a start after the end, are rejected before submit", async () => {
  const { requests } = renderStay();
  const from = page.getByLabelText("From");
  const to = page.getByLabelText("To");

  await userEvent.fill(from, "2026-05-02");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Enter a date")).toBeVisible();
  expect(requests.some(({ method }) => method === "POST")).toBe(false);

  await userEvent.fill(to, "2026-05-01");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("The start must be on or before the end")).toBeVisible();
  expect(requests.some(({ method }) => method === "POST")).toBe(false);
});
