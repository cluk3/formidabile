import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const phoneId = "0192f0c4-0000-7000-8000-000000000171";
const phone = {
  id: phoneId,
  type: "phone" as const,
  label: "Phone",
  required: true,
  config: {},
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test("a phone field is a telephone input and submits the number as E.164", async () => {
  const { requests } = fakeApi(definitionOf([phone]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  const input = page.getByLabelText("Phone", { exact: false });
  await expect.element(input).toHaveAttribute("type", "tel");
  await expect.element(input).toHaveAttribute("autocomplete", "tel");

  await userEvent.fill(input, "4155550100");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(page.getByText("Include a country code, starting with +")).toBeVisible();
  expect(requests.filter(({ method }) => method === "POST")).toEqual([]);

  await userEvent.fill(input, "+1 (415) 555-0100");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(uuid),
    answers: { [phoneId]: "+14155550100" },
  });
});
