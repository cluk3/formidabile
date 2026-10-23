import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const consentId = "0192f0c4-0000-7000-8000-0000000001c1";
const consent = {
  id: consentId,
  type: "boolean" as const,
  label: "I agree to the terms",
  required: true,
  config: { mustBeYes: true },
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("a must-be-yes question is one checkbox, and an unticked box is not submitted", async () => {
  const { requests } = fakeApi(definitionOf([consent]));
  await render(FormRenderer, {
    apiBaseUrl,
    formId,
    getToken: async () => "token-1",
  });

  const checkbox = page.getByRole("checkbox", { name: /I agree to the terms/ });
  await expect.element(checkbox).toBeVisible();
  expect(page.getByRole("radio").elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(checkbox).toHaveAttribute("aria-invalid", "true");
  await expect.element(page.getByText("Answer this question")).toBeVisible();
  expect(requests.filter(({ method }) => method === "POST")).toEqual([]);

  await userEvent.click(checkbox);
  await userEvent.click(checkbox);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Answer this question")).toBeVisible();
  expect(requests.filter(({ method }) => method === "POST")).toEqual([]);

  await userEvent.click(checkbox);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(uuid),
    answers: { [consentId]: true },
  });
});
