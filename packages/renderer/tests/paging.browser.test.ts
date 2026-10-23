import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import type { FormDefinition } from "@fb/core/definition";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, fakeApi, formId, questions, responseRead, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const staticToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });
const pageA = "00000000-0000-4000-8000-0000000000a1";
const pageB = "00000000-0000-4000-8000-0000000000a2";
const pageC = "00000000-0000-4000-8000-0000000000a3";

const paged = {
  format: 2 as const,
  title: "Event feedback",
  pages: [
    { id: pageA, questions: [questions.name], jumps: [] },
    {
      id: pageB,
      title: "Contact",
      description: "How to reach you",
      questions: [questions.email, questions.guests],
      jumps: [],
    },
    { id: pageC, questions: [questions.comments], jumps: [] },
  ],
} satisfies FormDefinition;

test("a one-page form says Submit and shows no page label or count", async () => {
  fakeApi({ format: 1, title: "Event feedback", questions: [questions.name] });
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByRole("button", { name: "Next" }).elements()).toEqual([]);
  expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);
  expect(page.getByText("Page 1").elements()).toEqual([]);
  expect(page.getByText(/page \d+ of \d+/i).elements()).toEqual([]);
});

test("Next, Back, and Submit walk the pages the respondent visited", async () => {
  const { requests } = fakeApi(paged);
  const onpagechange = vi.fn();
  const title = document.title;
  const href = location.href;
  const length = history.length;
  const push = vi.spyOn(history, "pushState");
  const replace = vi.spyOn(history, "replaceState");
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken, onpagechange });

  await expect.poll(() => onpagechange.mock.calls).toEqual([[{ pageId: pageA, title: null }]]);
  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toHaveFocus();
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  expect(page.getByLabelText("Email", { exact: false }).elements()).toEqual([]);
  expect(page.getByText("Page 1").elements()).toEqual([]);
  expect(page.getByText(/page \d+ of \d+/i).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Your name")).toHaveAttribute("aria-invalid", "true");
  await expect.element(labelled("Your name")).toHaveFocus();
  expect(page.getByText("Answer this question").elements()).toHaveLength(1);
  expect(onpagechange.mock.calls).toHaveLength(1);

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("button", { name: "Next" }));

  await expect.element(page.getByRole("heading", { name: "Contact" })).toHaveFocus();
  await expect.element(page.getByText("How to reach you")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  expect(page.getByLabelText("Your name", { exact: false }).elements()).toEqual([]);
  expect(onpagechange.mock.calls[1]).toEqual([{ pageId: pageB, title: "Contact" }]);

  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Email")).toHaveFocus();
  await expect.element(labelled("Email")).toHaveAttribute("aria-invalid", "true");
  await expect.element(labelled("Guests")).toHaveAttribute("aria-invalid", "true");
  expect(page.getByText("Answer this question").elements()).toHaveLength(2);
  expect(page.getByLabelText("Your name", { exact: false }).elements()).toEqual([]);

  await userEvent.fill(labelled("Email"), "not an address");
  await userEvent.fill(labelled("Guests"), "11");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Email")).toHaveFocus();
  expect(page.getByText("Invalid email address").elements()).toHaveLength(1);

  await userEvent.fill(labelled("Email"), "ada@example.com");
  await userEvent.fill(labelled("Guests"), "3");
  await userEvent.click(page.getByRole("button", { name: "Next" }));

  await expect.element(page.getByRole("heading", { name: "Event feedback" })).toHaveFocus();
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByRole("button", { name: "Next" }).elements()).toEqual([]);
  expect(onpagechange.mock.calls[2]).toEqual([{ pageId: pageC, title: null }]);
  expect(page.getByText("How to reach you").elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(labelled("Email")).toHaveValue("ada@example.com");
  await expect.element(labelled("Guests")).toHaveValue(3);
  await expect.element(page.getByRole("heading", { name: "Contact" })).toHaveFocus();
  expect(onpagechange.mock.calls[3]).toEqual([{ pageId: pageB, title: "Contact" }]);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(labelled("Your name")).toHaveValue("Ada");
  expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.fill(labelled("Comments (optional)"), "Thanks");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toMatchObject({
    versionId,
    answers: {
      [questions.name.id]: "Ada",
      [questions.email.id]: "ada@example.com",
      [questions.guests.id]: 3,
      [questions.comments.id]: "Thanks",
    },
  });
  expect(document.title).toBe(title);
  expect(location.href).toBe(href);
  expect(history.length).toBe(length);
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  push.mockRestore();
  replace.mockRestore();
});

test("editing a response starts on the first page with the stored answers", async () => {
  const responseId = "0192f0c4-0000-7000-8000-00000000e201";
  const answers = {
    [questions.name.id]: "Ada",
    [questions.email.id]: "ada@example.com",
    [questions.guests.id]: 3,
    [questions.comments.id]: "Thanks",
  };
  const { requests } = fakeApi(paged, {
    reads: { [responseId]: () => responseRead(responseId, paged, answers) },
  });
  await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken: staticToken });

  await expect.element(labelled("Your name")).toHaveValue("Ada");
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  expect(page.getByLabelText("Email", { exact: false }).elements()).toEqual([]);
  expect(page.getByRole("button", { name: "Save changes" }).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Email")).toHaveValue("ada@example.com");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Comments (optional)")).toHaveValue("Thanks");
  await expect.element(page.getByRole("button", { name: "Save changes" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Save changes" }));

  await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
  expect(requests.find(({ method }) => method === "PUT")?.body).toMatchObject({
    expectedRevision: "1",
    answers,
  });
});

test("preview walks a draft page by page and does not call the API", async () => {
  const { fetch } = fakeApi({ format: 1, title: "Unused", questions: [] });
  const onpagechange = vi.fn();
  await render(FormRenderer, { preview: paged, onpagechange });

  await expect.poll(() => onpagechange.mock.calls[0]).toEqual([{ pageId: pageA, title: null }]);
  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(page.getByRole("heading", { name: "Contact" })).toBeVisible();
  await userEvent.fill(labelled("Email"), "ada@example.com");
  await userEvent.fill(labelled("Guests"), "3");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});

test("a refusal for an earlier page returns there and focuses that field", async () => {
  fakeApi(paged, {
    submits: [
      Response.json(
        {
          _tag: "ValidationFailed",
          issues: [{ path: [questions.name.id], message: "The server refused this name" }],
        },
        { status: 422 },
      ),
    ],
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.fill(labelled("Email"), "ada@example.com");
  await userEvent.fill(labelled("Guests"), "3");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(labelled("Your name")).toHaveFocus();
  await expect.element(page.getByText("The server refused this name")).toBeVisible();
  expect(page.getByLabelText("Comments (optional)", { exact: false }).elements()).toEqual([]);
  expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);
});
