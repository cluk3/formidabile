import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import type { QuestionSnapshot } from "@fb/core/definition";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const labelled = (label: string) => page.getByLabelText(label, { exact: false });

const email: QuestionSnapshot = {
  id: "0192f0c4-0000-7000-8000-000000000201",
  type: "email",
  label: "Email",
  required: false,
  config: {},
};

const website: QuestionSnapshot = {
  id: "0192f0c4-0000-7000-8000-000000000202",
  type: "url",
  label: "Website",
  required: true,
  config: {},
};

const errorFor = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => element.ownerDocument.getElementById(id))
    .find((described) => described?.getAttribute("part") === "error")?.textContent;

test("the email field offers email autocomplete", async () => {
  fakeApi(definitionOf([email]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  await expect.element(labelled("Email")).toHaveAttribute("autocomplete", "email");
  await expect.element(labelled("Email")).toHaveAttribute("type", "email");
});

test("a URL field offers URL autocomplete and shows https:// added when the scheme was left out", async () => {
  const { requests } = fakeApi(definitionOf([website, email]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  const input = labelled("Website");
  await expect.element(input).toHaveAttribute("type", "url");
  await expect.element(input).toHaveAttribute("autocomplete", "url");

  await userEvent.fill(input, "  example.com/docs  ");
  await userEvent.tab();
  await expect.element(input).toHaveValue("https://example.com/docs");

  await userEvent.fill(input, "http://example.com/a");
  await userEvent.tab();
  await expect.element(input).toHaveValue("http://example.com/a");

  await userEvent.fill(input, "example.com:8080/a");
  await userEvent.tab();
  await expect.element(input).toHaveValue("https://example.com:8080/a");

  await userEvent.fill(input, "example.com");
  await userEvent.tab();
  await expect.element(input).toHaveValue("https://example.com");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(uuid),
    answers: { [website.id]: "https://example.com" },
  });
});

test("a scheme that is not http or https stays visible and is refused", async () => {
  fakeApi(definitionOf([website]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: async () => "token-1" });

  const input = labelled("Website");
  await userEvent.fill(input, "javascript:alert(1)");
  await userEvent.tab();
  await expect.element(input).toHaveValue("javascript:alert(1)");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.poll(() => errorFor(input.element() as HTMLElement)).toBe("Invalid URL");
});
