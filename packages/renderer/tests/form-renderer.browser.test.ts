import { afterEach, expect, test, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const textQuestion = {
  id: "0192f0c4-0000-7000-8000-0000000000b1",
  type: "text",
  label: "Your name",
  required: true,
  config: { display: "single_line" },
} as const;

test("getToken receives { formId } before the load, and the form's title shows", async () => {
  const { requests } = fakeApi(definitionOf([textQuestion]));
  const getToken = vi.fn(async (_request: { readonly formId: string }) => "token-1");

  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toBeVisible();
  expect(getToken.mock.calls).toEqual([[{ formId }]]);
  expect(requests).toEqual([
    {
      method: "GET",
      path: `/api/respond/forms/${formId}`,
      authorization: "Bearer token-1",
      body: undefined,
    },
  ]);
});
