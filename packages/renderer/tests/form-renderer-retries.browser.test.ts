import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { FormRenderer } from "@fb/renderer";
import { apiBaseUrl, definitionOf, fakeApi, formId, questions, responseRead } from "./fake-api.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const getToken = async () => "token-1";
const labelled = (label: string) => page.getByLabelText(label, { exact: false });
const button = (name: string) => page.getByRole("button", { name });
const unconfirmed =
  "We couldn't confirm your response was received. Retry to send the same answers again.";
const thanks = "Thank you, your response was received.";
const responseId = "0192f0c4-0000-7000-8000-00000000e001";

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

test("a 422 after Retry unlocks the form, and the key minted at the first Submit is kept until a 201", async () => {
  const { requests } = fakeApi(definitionOf([questions.guests]), {
    submits: [
      unavailable,
      () =>
        Response.json(
          {
            _tag: "ValidationFailed",
            issues: [{ path: [questions.guests.id], message: "Too many" }],
          },
          { status: 422 },
        ),
    ],
  });
  await render(FormRenderer, { apiBaseUrl, formId, getToken });

  await userEvent.fill(labelled("Guests"), "2");
  await userEvent.click(button("Submit"));
  await userEvent.click(button("Retry"));

  await expect.element(page.getByText("Too many")).toBeVisible();
  await expect.element(labelled("Guests")).toBeEnabled();
  expect(page.getByText(unconfirmed).elements()).toEqual([]);
  await userEvent.fill(labelled("Guests"), "1");
  await userEvent.click(button("Submit"));

  await expect.element(page.getByText(thanks)).toBeVisible();
  const keys = posts(requests).map(
    ({ body }) => (body as { idempotencyKey: string }).idempotencyKey,
  );
  expect(keys).toHaveLength(3);
  expect(keys[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(new Set(keys).size).toBe(1);
  expect(posts(requests)[2]?.body).toMatchObject({ answers: { [questions.guests.id]: 1 } });
});

test.each([
  ["a 502 from a proxy", () => new Response("Bad gateway", { status: 502 })],
  ["a 201 that isn't JSON", () => new Response("<html></html>", { status: 201 })],
  ["a 201 without a responseId", () => Response.json({}, { status: 201 })],
  ["a 404 without a tag", () => new Response("Not found", { status: 404 })],
  ["a 409 with an unknown tag", () => Response.json({ _tag: "Overloaded" }, { status: 409 })],
])("%s is an unknown outcome too, and keeps the answers locked", async (_, reply) => {
  const { requests } = fakeApi(definitionOf([questions.name]), { submits: [reply, reply] });
  const onerror = vi.fn();
  await render(FormRenderer, { apiBaseUrl, formId, getToken, onerror });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button("Submit"));
  await expect.element(page.getByRole("alert")).toHaveTextContent(unconfirmed);
  await userEvent.click(button("Retry"));
  await expect.poll(() => posts(requests)).toHaveLength(2);

  await expect.element(button("Retry")).toBeVisible();
  await expect.element(labelled("Your name")).toBeDisabled();
  expect(onerror.mock.calls).toEqual([
    [{ code: "submitUnconfirmed", message: unconfirmed }],
    [{ code: "submitUnconfirmed", message: unconfirmed }],
  ]);
});

const editUnconfirmed =
  "We couldn't confirm your changes were saved. Reload the response to see the saved answers, or stay to keep yours on screen.";

test.each([
  ["a rejected fetch", dropped],
  ["a 503", unavailable],
])(
  "%s on an edit lets the respondent stay with their answers, or reload the saved ones",
  async (_, reply) => {
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
                { [questions.name.id]: "Ada Byron" },
                { revision: "2" },
              );
        },
      },
      edits: [reply, reply],
    });
    await render(FormRenderer, { apiBaseUrl, formId, responseId, getToken });

    await userEvent.fill(labelled("Your name"), "Ada Byron");
    await userEvent.click(button("Save changes"));
    await expect.element(page.getByRole("alert")).toHaveTextContent(editUnconfirmed);
    await expect.element(labelled("Your name")).toBeEnabled();
    await userEvent.click(button("Stay"));
    await expect.element(button("Stay")).not.toBeInTheDocument();
    await expect.element(labelled("Your name")).toHaveValue("Ada Byron");

    await userEvent.click(button("Save changes"));
    await userEvent.click(button("Reload"));
    await expect.element(labelled("Your name")).toHaveValue("Ada Byron");
    await userEvent.click(button("Save changes"));

    await expect.element(page.getByText("Your changes were saved.")).toBeVisible();
    const edits = requests.filter(({ method }) => method === "PUT").map(({ body }) => body);
    expect(edits).toEqual([
      { expectedRevision: "1", answers: { [questions.name.id]: "Ada Byron" } },
      { expectedRevision: "1", answers: { [questions.name.id]: "Ada Byron" } },
      { expectedRevision: "2", answers: { [questions.name.id]: "Ada Byron" } },
    ]);
  },
);

test("a getToken that throws sends nothing, so the answers stay editable", async () => {
  let calls = 0;
  const { requests } = fakeApi(definitionOf([questions.name]));
  const flaky = async () => {
    calls += 1;
    if (calls === 2) throw new Error("token endpoint down");
    return "token-1";
  };
  await render(FormRenderer, { apiBaseUrl, formId, getToken: flaky });

  await userEvent.fill(labelled("Your name"), "Ada");
  await userEvent.click(button("Submit"));

  await expect
    .element(page.getByRole("alert"))
    .toHaveTextContent("We couldn't send your response. Please try again.");
  await expect.element(labelled("Your name")).toBeEnabled();
  await userEvent.click(button("Submit"));
  await expect.element(page.getByText(thanks)).toBeVisible();
  expect(posts(requests)).toHaveLength(1);
});
