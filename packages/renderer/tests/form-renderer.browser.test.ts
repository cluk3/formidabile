import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, questions, versionId } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const staticToken = async () => "token-1";
// A required question's label ends in "(required)".
const labelled = (label: string) => page.getByLabelText(label, { exact: false });

test("getToken receives { formId } before the load, and the form's title shows", async () => {
  const { requests } = fakeApi(definitionOf([questions.name]));
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

test("a respondent fills in every question type and submits", async () => {
  const { requests } = fakeApi(definitionOf(Object.values(questions)));
  const getToken = vi.fn(async (_request: { readonly formId: string }) => "token-1");
  const onsubmitted = vi.fn();
  await render(FormRenderer, { apiBaseUrl, formId, getToken, onsubmitted });

  await userEvent.fill(labelled("Your name"), "  Ada Lovelace ");
  await userEvent.fill(labelled("Comments (optional)"), "Line one\nLine two");
  await userEvent.fill(labelled("Email"), "ada@example.com");
  await userEvent.fill(labelled("Guests"), "3");
  await userEvent.fill(labelled("Arrival date"), "2026-05-04");
  await userEvent.click(page.getByRole("radio", { name: "Fish" }));
  await userEvent.selectOptions(labelled("T-shirt size"), "Medium");
  await userEvent.click(page.getByRole("checkbox", { name: "Svelte" }));
  await userEvent.click(page.getByRole("checkbox", { name: "Zod" }));
  await userEvent.click(page.getByRole("radio", { name: "No" }));
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
      answers: {
        [questions.name.id]: "Ada Lovelace",
        [questions.comments.id]: "Line one\nLine two",
        [questions.email.id]: "ada@example.com",
        [questions.guests.id]: 3,
        [questions.arrival.id]: "2026-05-04",
        [questions.meal.id]: "fish",
        [questions.size.id]: "m",
        [questions.workshops.id]: ["svelte", "zod"],
        [questions.parking.id]: false,
      },
    },
  });
  expect(getToken.mock.calls).toEqual([[{ formId }], [{ formId }]]);
  expect(onsubmitted.mock.calls).toEqual([[{ responseId: expect.stringMatching(uuid) }]]);
});

test("an unanswered optional question sends no key", async () => {
  const { requests } = fakeApi(definitionOf([questions.name, questions.comments]));
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.find(({ method }) => method === "POST")?.body).toEqual({
    versionId,
    idempotencyKey: expect.stringMatching(uuid),
    answers: { [questions.name.id]: "Ada" },
  });
});

// A question's invalid elements are its control, each of its checkboxes, or its radio group as a whole.
const invalidQuestions = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("[part=question]")].filter(
    (question) => question.querySelector('[aria-invalid="true"]') !== null,
  );

const errorFor = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => element.ownerDocument.getElementById(id))
    .find((described) => described?.getAttribute("part") === "error")?.textContent;

const required = Object.entries(questions).filter(([, question]) => question.required);

test.each(required)(
  "an unanswered %s question takes focus on a failed submit, marked invalid and linked to its error",
  async (_, question) => {
    const { requests } = fakeApi(definitionOf([questions.comments, question]));
    const { container } = await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

    await userEvent.click(page.getByRole("button", { name: "Submit" }));

    await expect.poll(() => invalidQuestions(container)).toHaveLength(1);
    const [card] = invalidQuestions(container);
    const invalid = [...card!.querySelectorAll<HTMLElement>('[aria-invalid="true"]')];
    for (const element of invalid) expect(errorFor(element)).toBe("Answer this question");
    expect(invalid[0]!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.matches("input, select, textarea")).toBe(true);
    expect(requests.filter(({ method }) => method === "POST")).toEqual([]);
  },
);

test("invalid answers each show their own error, and focus goes to the first", async () => {
  fakeApi(definitionOf([questions.name, questions.email, questions.guests, questions.workshops]));
  const { container } = await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.fill(labelled("Email"), "not an address");
  await userEvent.fill(labelled("Guests"), "11");
  for (const name of ["Svelte", "Effect", "Zod"])
    await userEvent.click(page.getByRole("checkbox", { name }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.poll(() => invalidQuestions(container)).toHaveLength(3);
  expect(document.activeElement).toBe(labelled("Email").element());
  expect(errorFor(labelled("Email").element() as HTMLElement)).toBe("Invalid email address");
  expect(errorFor(labelled("Guests").element() as HTMLElement)).toMatch(/10/);
  const workshops = page.getByRole("checkbox", { name: "Svelte" }).element() as HTMLElement;
  expect(errorFor(workshops)).toMatch(/2/);
});

test("fixing an answer and submitting again sends it", async () => {
  const { requests } = fakeApi(definitionOf([questions.guests]));
  const { container } = await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await userEvent.fill(labelled("Guests"), "0");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.poll(() => invalidQuestions(container)).toHaveLength(1);
  await userEvent.fill(labelled("Guests"), "2");
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(requests.filter(({ method }) => method === "POST")).toHaveLength(1);
});

test("a form with a question type this renderer doesn't know is refused", async () => {
  fakeApi({
    ...definitionOf([questions.name]),
    questions: [
      questions.name,
      { id: crypto.randomUUID(), type: "rating", label: "Stars", required: true, config: {} },
    ],
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken: staticToken });

  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(
      "This form uses a question type this renderer doesn't support, so it can't be shown.",
    );
  expect(page.getByLabelText("Your name", { exact: false }).elements()).toEqual([]);
  expect(page.getByRole("button", { name: "Submit" }).elements()).toEqual([]);
});

test("preview mode renders a definition, validates it, and never calls the API", async () => {
  const { fetch } = fakeApi(definitionOf([]));
  const { container } = await render(FormRenderer, {
    preview: definitionOf([questions.name, questions.parking], "Draft form"),
  });

  await expect.element(page.getByRole("heading", { name: "Draft form" })).toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Submit" }));
  await expect.poll(() => invalidQuestions(container)).toHaveLength(2);
  expect(document.activeElement).toBe(labelled("Your name").element());

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(page.getByRole("radio", { name: "Yes" }));
  await userEvent.click(page.getByRole("button", { name: "Submit" }));

  await expect
    .element(page.getByText("Preview: these answers are valid. Nothing was sent."))
    .toBeVisible();
  expect(invalidQuestions(container)).toEqual([]);
  expect(fetch).not.toHaveBeenCalled();
});
