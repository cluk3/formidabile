import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, fakeApi, formId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const staticToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });

const gateId = "0192f0c4-0000-7000-8000-000000000201";
const detailId = "0192f0c4-0000-7000-8000-000000000202";
const noteId = "0192f0c4-0000-7000-8000-000000000203";
const pageA = "00000000-0000-4000-8000-0000000000b1";
const pageB = "00000000-0000-4000-8000-0000000000b2";
const pageC = "00000000-0000-4000-8000-0000000000b3";

const text = (
  id: string,
  label: string,
  required: boolean,
  showWhenYes = false,
): QuestionSnapshot => ({
  id,
  type: "text",
  label,
  required,
  config: { display: "single_line" },
  ...(showWhenYes
    ? { showCondition: { questionId: gateId, operator: "equals", constant: "yes" } }
    : {}),
});

/** Gate and a required detail on one page. Detail is shown only when the gate equals "yes". */
const samePage = {
  format: 2 as const,
  title: "Guest list",
  pages: [
    {
      id: pageA,
      questions: [text(gateId, "Bring a guest?", false), text(detailId, "Guest name", true, true)],
      jumps: [],
    },
  ],
} satisfies FormDefinition;

/**
 * Three pages. The middle page's only question, and nothing else, is shown when the gate equals "yes".
 * Answering "no" passes over that page.
 */
const branched = {
  format: 2 as const,
  title: "Guest list",
  pages: [
    { id: pageA, title: "Start", questions: [text(gateId, "Bring a guest?", true)], jumps: [] },
    {
      id: pageB,
      title: "Guest",
      questions: [text(detailId, "Guest name", true, true)],
      jumps: [],
    },
    { id: pageC, title: "Finish", questions: [text(noteId, "Note", false)], jumps: [] },
  ],
} satisfies FormDefinition;

/** Two pages. The second is on the path only when the gate equals "yes", so the button label moves with it. */
const labelledPath = {
  format: 2 as const,
  title: "Guest list",
  pages: [
    { id: pageA, questions: [text(gateId, "Bring a guest?", true)], jumps: [] },
    {
      id: pageB,
      title: "Guest",
      questions: [text(detailId, "Guest name", true, true)],
      jumps: [],
    },
  ],
} satisfies FormDefinition;

test("a hidden question is not shown, and its answer is restored but left out of the submission", async () => {
  const { requests } = fakeApi(samePage);
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await expect.element(labelled("Bring a guest?")).toBeVisible();
  expect(page.getByLabelText("Guest name", { exact: false }).elements()).toEqual([]);

  await userEvent.fill(labelled("Bring a guest?"), "yes");
  await expect.element(labelled("Guest name")).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.element(labelled("Guest name")).toHaveAttribute("aria-invalid", "true");
  await expect.element(page.getByText("Answer this question")).toBeVisible();
  expect(requests.some(({ method }) => method === "POST")).toBe(false);

  await userEvent.fill(labelled("Guest name"), "Grace");
  await userEvent.fill(labelled("Bring a guest?"), "no");
  expect(page.getByLabelText("Guest name", { exact: false }).elements()).toEqual([]);

  await userEvent.fill(labelled("Bring a guest?"), "yes");
  await expect.element(labelled("Guest name")).toHaveValue("Grace");

  await userEvent.fill(labelled("Bring a guest?"), "no");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const body = requests.find(({ method }) => method === "POST")?.body;
  const answers =
    typeof body === "object" && body !== null && "answers" in body ? body.answers : undefined;
  expect(answers).toEqual({ [gateId]: "no" });
});

test("an all-hidden page is passed over and never enters Back's history", async () => {
  const { requests } = fakeApi(branched);
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Bring a guest?"), "no");
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Next" }));

  await expect.element(page.getByRole("heading", { name: "Finish" })).toBeVisible();
  expect(page.getByRole("heading", { name: "Guest" }).elements()).toEqual([]);
  expect(page.getByLabelText("Guest name", { exact: false }).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(page.getByRole("heading", { name: "Start" })).toBeVisible();
  await expect.element(labelled("Bring a guest?")).toHaveValue("no");
  expect(page.getByRole("button", { name: "Back" }).elements()).toEqual([]);

  await userEvent.fill(labelled("Bring a guest?"), "yes");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(page.getByRole("heading", { name: "Guest" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Guest name")).toHaveAttribute("aria-invalid", "true");

  await userEvent.fill(labelled("Guest name"), "Grace");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(page.getByRole("heading", { name: "Finish" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(labelled("Guest name")).toHaveValue("Grace");
  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await userEvent.fill(labelled("Bring a guest?"), "no");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(page.getByRole("heading", { name: "Finish" })).toBeVisible();
  expect(page.getByRole("heading", { name: "Guest" }).elements()).toEqual([]);

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await expect.element(page.getByRole("heading", { name: "Start" })).toBeVisible();
  await userEvent.fill(labelled("Bring a guest?"), "yes");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(labelled("Guest name")).toHaveValue("Grace");
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await userEvent.fill(labelled("Note"), "Thanks");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toMatchObject({
    answers: { [gateId]: "yes", [detailId]: "Grace", [noteId]: "Thanks" },
  });
});

test("the Next and Submit label follows the path, including in preview", async () => {
  const { fetch } = fakeApi({ format: 1, title: "Unused", questions: [] });
  await render(FormRenderer, { preview: labelledPath });

  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByRole("button", { name: "Next" }).elements()).toEqual([]);
  expect(page.getByLabelText("Guest name", { exact: false }).elements()).toEqual([]);

  await userEvent.fill(labelled("Bring a guest?"), "yes");
  await expect.element(page.getByRole("button", { name: "Next" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Next" }));
  await expect.element(page.getByRole("heading", { name: "Guest" })).toBeVisible();
  await expect.element(labelled("Guest name")).toBeVisible();

  await userEvent.click(page.getByRole("button", { name: "Back" }));
  await userEvent.fill(labelled("Bring a guest?"), "no");
  await expect.element(page.getByRole("button", { name: "Submit" })).toBeVisible();
  expect(page.getByLabelText("Guest name", { exact: false }).elements()).toEqual([]);
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(fetch).not.toHaveBeenCalled();
});
