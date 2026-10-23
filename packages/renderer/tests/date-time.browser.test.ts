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

const arrival: QuestionSnapshot = {
  id: "0192f0c4-0000-7000-8000-000000000199",
  type: "date_time",
  label: "Arrival",
  required: true,
  config: { min: "2026-01-01T00:00", max: "2026-12-31T23:59" },
};

const optional: QuestionSnapshot = {
  id: "0192f0c4-0000-7000-8000-000000000198",
  type: "date_time",
  label: "Departure (optional)",
  required: false,
  config: {},
};

test("a respondent picks a local date and time and submits it", async () => {
  const { requests } = fakeApi(definitionOf([arrival]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  const input = page.getByLabelText("Arrival", { exact: false });
  await expect.element(input).toHaveAttribute("type", "datetime-local");
  await expect.element(input).toHaveAttribute("min", "2026-01-01T00:00");
  await expect.element(input).toHaveAttribute("max", "2026-12-31T23:59");
  await userEvent.fill(input, "2026-05-04T15:30");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const submit = requests.find(({ method }) => method === "POST");
  expect(submit).toEqual({
    method: "POST",
    path: `/api/respond/forms/${formId}/responses`,
    authorization: "Bearer token-1",
    body: {
      versionId,
      idempotencyKey: expect.stringMatching(uuid),
      answers: { [arrival.id]: "2026-05-04T15:30" },
    },
  });
});

test("an unanswered optional date and time sends no key", async () => {
  const { requests } = fakeApi(definitionOf([arrival, optional]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  await userEvent.fill(page.getByLabelText("Arrival", { exact: false }), "2026-05-04T15:30");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const submit = requests.find(({ method }) => method === "POST");
  if (submit === undefined) throw new Error("expected a submit");
  const answers = submit.body as { answers: Record<string, unknown> };
  expect(answers.answers).toEqual({ [arrival.id]: "2026-05-04T15:30" });
});
