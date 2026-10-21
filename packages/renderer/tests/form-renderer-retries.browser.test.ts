import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, questions } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const getToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });
const button = (name: string) => page.getByRole("button", { name });
const unconfirmed =
  "We couldn't confirm your response was received. Retry to send the same answers again.";
const thanks = "Thank you, your response was received.";

const posts = <R extends { method: string }>(requests: ReadonlyArray<R>) =>
  requests.filter(({ method }) => method === "POST");

const dropped = () => Promise.reject(new TypeError("Failed to fetch"));
const unavailable = () => Response.json({ _tag: "Unavailable" }, { status: 503 });

test.each([
  ["a rejected fetch", dropped],
  ["a 503", unavailable],
])("%s locks the answers, and Retry resends the same submission", async (_, reply) => {
  const { requests } = fakeApi(definitionOf([questions.name, questions.meal]), {
    submits: [reply],
  });
  const onsubmitted = vi.fn();
  await render(FormRenderer, { apiBaseUrl, formId, getToken, onsubmitted });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("radio", { name: "Fish" }));
  await userEvent.click(button("Submit"));

  await expect.element(page.getByRole("alert")).toHaveTextContent(unconfirmed);
  await expect.element(labelled("Your name")).toBeDisabled();
  await expect.element(page.getByRole("radio", { name: "Fish" })).toBeDisabled();
  await expect.element(labelled("Your name")).toHaveValue("Ada");
  expect(button("Submit").elements()).toEqual([]);
  await userEvent.click(button("Retry"));

  await expect.element(page.getByText(thanks)).toBeVisible();
  const [first, second] = posts(requests).map(({ body }) => body);
  expect(second).toEqual(first);
  expect(first).toMatchObject({
    answers: { [questions.name.id]: "Ada", [questions.meal.id]: "fish" },
  });
  expect(onsubmitted).toHaveBeenCalledOnce();
});
