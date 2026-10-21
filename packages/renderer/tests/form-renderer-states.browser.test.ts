import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import {
  apiBaseUrl,
  definitionOf,
  fakeApi,
  formId,
  questions,
  responseRead,
  versionId,
} from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const getToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });
const button = (name: string) => page.getByRole("button", { name });
const responseId = "0192f0c4-0000-7000-8000-00000000e001";

const loaded = (overrides: Record<string, unknown>, definition = definitionOf([questions.name])) =>
  Response.json({
    formId,
    responseLimit: "unlimited",
    respondent: "identified",
    version: { id: versionId, number: 1, definition },
    myResponseId: null,
    ...overrides,
  });

const refusal = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

const posts = <R extends { method: string }>(requests: ReadonlyArray<R>) =>
  requests.filter(({ method }) => method === "POST");

const everyType = definitionOf(Object.values(questions));
const savedAnswers = {
  [questions.name.id]: "Ada Lovelace",
  [questions.email.id]: "ada@example.com",
  [questions.guests.id]: 3,
  [questions.arrival.id]: "2026-05-04",
  [questions.meal.id]: "fish",
  [questions.size.id]: "m",
  [questions.workshops.id]: ["svelte", "zod"],
  [questions.parking.id]: false,
};

test("a response-id opens that response for editing with its answers, and saving sends them back", async () => {
  const { requests } = fakeApi(everyType, {
    reads: { [responseId]: () => responseRead(responseId, everyType, savedAnswers) },
  });
  const onsubmitted = vi.fn();
  await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken, onsubmitted });

  await expect.element(labelled("Your name")).toHaveValue("Ada Lovelace");
  await expect.element(labelled("Email")).toHaveValue("ada@example.com");
  await expect.element(labelled("Guests")).toHaveValue(3);
  await expect.element(labelled("Arrival date")).toHaveValue("2026-05-04");
  await expect.element(page.getByRole("radio", { name: "Fish" })).toBeChecked();
  await expect.element(labelled("T-shirt size")).toHaveValue("m");
  await expect.element(page.getByRole("checkbox", { name: "Svelte" })).toBeChecked();
  await expect.element(page.getByRole("checkbox", { name: "Effect" })).not.toBeChecked();
  await expect.element(page.getByRole("checkbox", { name: "Zod" })).toBeChecked();
  await expect.element(page.getByRole("radio", { name: "No" })).toBeChecked();

  await userEvent.fill(labelled("Guests"), "4");
  await userEvent.click(button("Save changes"));

  await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
    `GET /api/respond/responses/${responseId}`,
    `PUT /api/respond/responses/${responseId}`,
  ]);
  expect(requests[1]?.body).toEqual({
    expectedRevision: "1",
    answers: { ...savedAnswers, [questions.guests.id]: 4 },
  });
  expect(onsubmitted.mock.calls).toEqual([[{ responseId }]]);
});

test("a load with myResponseId goes straight to editing that response", async () => {
  const definition = definitionOf([questions.name]);
  const { requests } = fakeApi(definition, {
    load: loaded({ responseLimit: "one_per_respondent", myResponseId: responseId }, definition),
    reads: {
      [responseId]: () => responseRead(responseId, definition, { [questions.name.id]: "Ada" }),
    },
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await expect.element(labelled("Your name")).toHaveValue("Ada");
  await userEvent.click(button("Save changes"));

  await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
  expect(requests.map(({ method }) => method)).toEqual(["GET", "GET", "PUT"]);
  expect(posts(requests)).toEqual([]);
});

test("on RevisionConflict the respondent can stay with their answers, or reload the saved ones", async () => {
  const definition = definitionOf([questions.name]);
  let reads = 0;
  const { requests } = fakeApi(definition, {
    reads: {
      [responseId]: () => {
        reads += 1;
        return reads === 1
          ? responseRead(responseId, definition, { [questions.name.id]: "Ada" })
          : responseRead(
              responseId,
              definition,
              { [questions.name.id]: "Ada L." },
              { revision: "2" },
            );
      },
    },
    edits: [refusal(409, { _tag: "RevisionConflict" }), refusal(409, { _tag: "RevisionConflict" })],
  });
  await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken });

  await userEvent.fill(labelled("Your name"), "Ada Byron");
  await userEvent.click(button("Save changes"));
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(
      "Your response was changed somewhere else since you opened it. Reload it to see the saved answers, or stay to keep yours on screen.",
    );
  await userEvent.click(button("Stay"));
  await expect.element(button("Stay")).not.toBeInTheDocument();
  await expect.element(labelled("Your name")).toHaveValue("Ada Byron");

  await userEvent.click(button("Save changes"));
  await userEvent.click(button("Reload"));
  await expect.element(labelled("Your name")).toHaveValue("Ada L.");
  await userEvent.click(button("Save changes"));

  await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
  const edits = requests.filter(({ method }) => method === "PUT").map(({ body }) => body);
  expect(edits).toEqual([
    { expectedRevision: "1", answers: { [questions.name.id]: "Ada Byron" } },
    { expectedRevision: "1", answers: { [questions.name.id]: "Ada Byron" } },
    { expectedRevision: "2", answers: { [questions.name.id]: "Ada L." } },
  ]);
});

test("on VersionSuperseded the renderer prompts a reload, which brings an empty form on the new version", async () => {
  const v2 = "0192f0c4-0000-7000-8000-0000000000a2";
  let loads = 0;
  const { requests } = fakeApi(definitionOf([questions.name]), {
    load: () => {
      loads += 1;
      return loads === 1
        ? loaded({})
        : loaded({
            version: {
              id: v2,
              number: 2,
              definition: definitionOf([questions.email], "Feedback v2"),
            },
          });
    },
    submits: [refusal(409, { _tag: "VersionSuperseded", currentVersionId: v2 })],
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button("Submit"));
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent(
      "This form was updated while you were answering. Reload it to answer the new version. Your answers won't carry over.",
    );
  await userEvent.click(button("Reload"));

  await expect.element(page.getByRole("heading", { name: "Feedback v2" })).toBeVisible();
  await expect.element(labelled("Email")).toHaveValue("");
  await userEvent.fill(labelled("Email"), "ada@example.com");
  await userEvent.click(button("Submit"));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  const [first, second] = posts(requests).map(
    ({ body }) => body as { versionId: string; idempotencyKey: string },
  );
  expect(first?.versionId).toBe(versionId);
  expect(second).toEqual({
    versionId: v2,
    answers: { [questions.email.id]: "ada@example.com" },
    idempotencyKey: expect.stringMatching(uuid),
  });
  expect(second?.idempotencyKey).not.toBe(first?.idempotencyKey);
});

test("on AlreadyResponded the respondent can edit the response they sent", async () => {
  const definition = definitionOf([questions.name]);
  fakeApi(definition, {
    submits: [refusal(409, { _tag: "AlreadyResponded", responseId })],
    reads: {
      [responseId]: () => responseRead(responseId, definition, { [questions.name.id]: "Ada" }),
    },
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await userEvent.fill(labelled("Your name"), "Someone else");
  await userEvent.click(button("Submit"));
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("You've already responded to this form.");
  await userEvent.click(button("Edit your response"));

  await expect.element(labelled("Your name")).toHaveValue("Ada");
  await expect.element(button("Save changes")).toBeVisible();
});

const closed = "This form is closed and no longer takes responses.";

const readOf = (options?: { editable: boolean }) => ({
  [responseId]: () =>
    responseRead(
      responseId,
      definitionOf([questions.name]),
      { [questions.name.id]: "Ada" },
      options,
    ),
});
const nothing = async () => {};
const send = (label: string) => async () => {
  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button(label));
};

test.each([
  ["the load", { load: refusal(409, { _tag: "FormClosed" }) }, undefined, nothing],
  ["a submit", { submits: [refusal(409, { _tag: "FormClosed" })] }, undefined, send("Submit")],
  ["a response read", { reads: readOf({ editable: false }) }, responseId, nothing],
  [
    "an edit",
    { reads: readOf(), edits: [refusal(409, { _tag: "FormClosed" })] },
    responseId,
    send("Save changes"),
  ],
])("the closed state shows when %s finds the form closed", async (_, replies, responseId, act) => {
  fakeApi(definitionOf([questions.name]), replies);
  await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken });

  await act();

  await expect.element(page.getByRole("alert")).toHaveTextContent(closed);
  expect(labelled("Your name").elements()).toEqual([]);
});

test("the unavailable state shows for FormNotPublished", async () => {
  fakeApi(definitionOf([questions.name]), { load: refusal(409, { _tag: "FormNotPublished" }) });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await expect.element(page.getByRole("alert")).toHaveTextContent("This form isn't available.");
  expect(labelled("Your name").elements()).toEqual([]);
});

const signIn = "Sign in to respond to this form.";
const sessionExpired = "Your session has expired. Sign in again to continue.";

test.each([
  ["anonymous", "one_per_respondent", true],
  ["anonymous", "unlimited", false],
  ["identified", "one_per_respondent", false],
] as const)(
  "a %s respondent on a %s form is prompted to sign in: %s",
  async (respondent, responseLimit, prompted) => {
    const { requests } = fakeApi(definitionOf([questions.name]), {
      load: loaded({ respondent, responseLimit }),
    });
    await render(FormRenderer, { apiBaseUrl, formId, getToken });

    if (prompted) {
      await expect.element(page.getByRole("alert")).toHaveTextContent(signIn);
      expect(labelled("Your name").elements()).toEqual([]);
    } else {
      await expect.element(labelled("Your name")).toBeVisible();
      expect(page.getByText(signIn).elements()).toEqual([]);
    }
    expect(requests).toHaveLength(1);
  },
);

const reasons = [
  ["missing", signIn],
  ["identityRequired", signIn],
  ["invalid", sessionExpired],
] as const;

test.each(reasons)("a 401 %s on the load shows %j", async (reason, message) => {
  fakeApi(definitionOf([questions.name]), {
    load: refusal(401, { _tag: "Unauthenticated", reason }),
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await expect.element(page.getByRole("alert")).toHaveTextContent(message);
  expect(labelled("Your name").elements()).toEqual([]);
});

test.each(reasons)(
  "a 401 %s on a submit shows %j and keeps the answers",
  async (reason, message) => {
    fakeApi(definitionOf([questions.name]), {
      submits: [refusal(401, { _tag: "Unauthenticated", reason })],
    });
    await render(FormRenderer, { apiBaseUrl, formId, getToken });

    await userEvent.fill(labelled("Your name"), "Ada");
    await userEvent.click(button("Submit"));

    await expect.element(page.getByRole("alert")).toHaveTextContent(message);
    await expect.element(labelled("Your name")).toHaveValue("Ada");
  },
);

test("a 413 on a submit shows that the answers are too long, and the form stays editable", async () => {
  const { requests } = fakeApi(definitionOf([questions.name]), {
    submits: [refusal(413, { _tag: "PayloadTooLarge", limit: 1_048_576 })],
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button("Submit"));
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Your answers are too long to send.");
  await userEvent.fill(labelled("Your name"), "A");
  await userEvent.click(button("Submit"));

  await expect.element(page.getByText("Thank you, your response was received.")).toBeVisible();
  expect(posts(requests)).toHaveLength(2);
});

test("a 413 on an edit shows that the answers are too long", async () => {
  const definition = definitionOf([questions.name]);
  fakeApi(definition, {
    reads: { [responseId]: responseRead(responseId, definition, { [questions.name.id]: "Ada" }) },
    edits: [refusal(413, { _tag: "PayloadTooLarge", limit: 1_048_576 })],
  });
  await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken });

  await userEvent.click(button("Save changes"));

  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Your answers are too long to send.");
  await expect.element(labelled("Your name")).toHaveValue("Ada");
});

test("onerror receives each refusal the renderer shows", async () => {
  fakeApi(definitionOf([questions.name]), {
    submits: [
      refusal(413, { _tag: "PayloadTooLarge", limit: 1_048_576 }),
      refusal(409, { _tag: "FormClosed" }),
    ],
  });
  const onerror = vi.fn();
  await render(FormRenderer, { apiBaseUrl, formId, getToken, onerror });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button("Submit"));
  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("Your answers are too long to send.");
  await userEvent.click(button("Submit"));
  await expect.element(page.getByRole("alert")).toHaveTextContent(closed);

  expect(onerror.mock.calls).toEqual([
    [{ code: "tooLarge", message: "Your answers are too long to send." }],
    [{ code: "closed", message: closed }],
  ]);
});
