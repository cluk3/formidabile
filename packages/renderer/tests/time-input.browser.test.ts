import type { QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const staticToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });

const arrival: QuestionSnapshot = {
  id: "0192f0c4-0000-7000-8000-000000000190",
  type: "time_of_day",
  label: "Arrival time",
  required: true,
  config: { earliest: "09:00", latest: "17:00" },
};

test("a respondent answers a time of day with the native time input", async () => {
  const { requests } = fakeApi(definitionOf([arrival]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  const input = labelled("Arrival time");
  await expect.element(input).toHaveAttribute("type", "time");
  await expect.element(input).toHaveAttribute("min", "09:00");
  await expect.element(input).toHaveAttribute("max", "17:00");

  await userEvent.fill(input, "10:30");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(uuid),
    answers: { [arrival.id]: "10:30" },
  });
});

test("a time before the earliest bound is refused and not submitted", async () => {
  const { requests } = fakeApi(definitionOf([arrival]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Arrival time"), "08:59");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Must be at or after 09:00")).toBeVisible();
  expect(requests.filter(({ method }) => method === "POST")).toEqual([]);
});
