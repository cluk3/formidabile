import type { QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import type { LocatorSelectors } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import ResponsesPage from "#lib/ResponsesPage.svelte";
import { admin, analyst, config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

type Answers = Record<string, string | number | boolean | string[]>;
type Version = {
  id: string;
  number: number;
  definition: { format: 1; title: string; questions: QuestionSnapshot[] };
};
type Stored = {
  id: string;
  versionId: string;
  respondentId: string | null;
  externalRefs: { namespace: string; refId: string }[];
  answers: Answers;
  /** Question ids the response was shown, in version order. Omitted, the detail treats every question as shown. */
  path?: readonly string[];
};

const version = (number: number, questions: QuestionSnapshot[]): Version => ({
  id: crypto.randomUUID(),
  number,
  definition: { format: 1, title: `Survey v${number}`, questions },
});

const response = (
  of: Version,
  respondentId: string | null,
  answers: Answers = {},
  externalRefs: Stored["externalRefs"] = [],
  path?: readonly string[],
): Stored => ({
  id: crypto.randomUUID(),
  versionId: of.id,
  respondentId,
  externalRefs,
  answers,
  ...(path === undefined ? {} : { path: [...path] }),
});

/**
 * The responses API for one form, as the module answers it: newest first (the last stored is the newest), 50 to a
 * page by default, keyset on `id`, every filter optional.
 */
const responsesHost = (
  versions: Version[],
  stored: Stored[],
  options: {
    capabilities?: ReadonlyArray<string>;
    answer?: (route: string, request: Request) => Response | undefined;
  } = {},
) => {
  const host: {
    stored: Stored[];
    requests: string[];
    queries: URLSearchParams[];
    fetch: typeof globalThis.fetch;
  } = {
    stored,
    requests: [],
    queries: [],
    fetch: fakeHost(async (route, request) => {
      host.requests.push(route);
      const answered = options.answer?.(route, request);
      if (answered !== undefined) return answered;
      const numberOf = (versionId: string) => versions.find((v) => v.id === versionId)!.number;
      const summary = (r: Stored) => ({
        id: r.id,
        formId,
        versionId: r.versionId,
        versionNumber: numberOf(r.versionId),
        respondentId: r.respondentId,
        submittedAt: at,
        editedAt: null,
        externalRefs: r.externalRefs,
      });
      if (route === "GET /responses") {
        const query = new URL(request.url).searchParams;
        host.queries.push(query);
        const matching = host.stored
          .toReversed()
          .filter(
            (r) =>
              query.get("formId") === formId &&
              [null, r.versionId].includes(query.get("versionId")) &&
              [null, r.respondentId].includes(query.get("respondentId")) &&
              (query.get("refNamespace") === null ||
                r.externalRefs.some(
                  (ref) =>
                    ref.namespace === query.get("refNamespace") && ref.refId === query.get("refId"),
                )),
          );
        const cursor = query.get("cursor");
        const from = cursor === null ? 0 : matching.findIndex((r) => r.id === cursor) + 1;
        const limit = Number(query.get("limit") ?? 50);
        const page = matching.slice(from, from + limit);
        return json(200, {
          responses: page.map(summary),
          nextCursor: from + limit < matching.length ? page.at(-1)!.id : null,
        });
      }
      if (route === `GET /forms/${formId}/versions`) {
        return json(200, {
          versions: versions.toReversed().map((v) => ({
            id: v.id,
            number: v.number,
            publishedAt: at,
            publishedBy: "acme-admin",
            derivedFromVersionId: null,
            isCurrent: v === versions.at(-1),
          })),
        });
      }
      const one = host.stored.find((r) => route.endsWith(`/responses/${r.id}`));
      if (route === `GET /responses/${one?.id}`) {
        const of = versions.find((v) => v.id === one!.versionId)!;
        return json(200, {
          response: { ...summary(one!), answers: one!.answers },
          version: { id: of.id, number: of.number, definition: of.definition },
          ...(one!.path === undefined ? {} : { path: [...one!.path] }),
        });
      }
      if (route === `DELETE /responses/${one?.id}`) {
        host.stored = host.stored.filter((r) => r !== one);
        return new Response(null, { status: 204 });
      }
      const respondent = /^DELETE \/respondents\/(.+)\/responses$/.exec(route)?.[1];
      if (respondent !== undefined) {
        const id = decodeURIComponent(respondent);
        const before = host.stored.length;
        host.stored = host.stored.filter((r) => r.respondentId !== id);
        return json(200, { deleted: before - host.stored.length });
      }
      return json(404, { _tag: "NotFound" });
    }, options.capabilities ?? admin),
  };
  return host;
};

const renderPage = (fetch: typeof globalThis.fetch) =>
  render(ResponsesPage, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });

const textQuestion = (label: string): QuestionSnapshot => ({
  id: crypto.randomUUID(),
  type: "text",
  label,
  required: false,
  config: { display: "single_line" },
});

test("the list shows the newest responses first and loads older ones on request", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const stored = Array.from({ length: 51 }, (_, i) => response(v1, `respondent-${i}`));
  const host = responsesHost([v1], stored);
  const screen = await renderPage(host.fetch);

  const items = screen.getByRole("list", { name: "Responses" }).getByRole("listitem");
  await expect.element(items.nth(0).getByText("respondent-50", { exact: true })).toBeVisible();
  expect(items.elements()).toHaveLength(50);
  await expect.element(screen.getByText("respondent-0", { exact: true })).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Load more" }).click();

  await expect.element(items.nth(50).getByText("respondent-0", { exact: true })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  expect(host.queries.map((q) => q.get("cursor"))).toEqual([null, stored[1]!.id]);
});

test("filters by version, respondent and reference narrow the list from its first page", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const v2 = version(2, [textQuestion("Name")]);
  const ref = { namespace: "project", refId: "spring" };
  const host = responsesHost(
    [v1, v2],
    [
      response(v1, "alice", {}, [ref]),
      response(v1, "bob"),
      response(v2, "alice"),
      response(v2, null, {}, [ref]),
    ],
  );
  const screen = await renderPage(host.fetch);
  const list = screen.getByRole("list", { name: "Responses" });
  await expect.element(list.getByText("Anonymous", { exact: true })).toBeVisible();
  expect(list.getByRole("listitem").elements()).toHaveLength(4);

  await screen.getByLabelText("Version").selectOptions("Version 1");
  await screen.getByRole("button", { name: "Filter" }).click();
  await expect.element(list.getByText("Anonymous", { exact: true })).not.toBeInTheDocument();
  expect(list.getByRole("listitem").elements()).toHaveLength(2);

  await screen.getByLabelText("Version").selectOptions("All versions");
  await screen.getByLabelText("Respondent").fill("alice");
  await screen.getByRole("button", { name: "Filter" }).click();
  await expect.element(list.getByText("bob", { exact: true })).not.toBeInTheDocument();
  expect(list.getByRole("listitem").elements()).toHaveLength(2);

  await screen.getByLabelText("Respondent").fill("");
  await screen.getByLabelText("Reference namespace").fill("project");
  await screen.getByRole("button", { name: "Filter" }).click();
  await expect
    .element(screen.getByText("Give both the reference namespace and its id, or neither."))
    .toBeVisible();
  await screen.getByLabelText("Reference id").fill("spring");
  await screen.getByRole("button", { name: "Filter" }).click();
  await expect.element(list.getByText("Anonymous", { exact: true })).toBeVisible();
  await expect.element(list.getByText("alice", { exact: true })).toBeVisible();
  expect(list.getByRole("listitem").elements()).toHaveLength(2);

  expect(host.queries.map((q) => Object.fromEntries(q))).toEqual([
    { formId },
    { formId, versionId: v1.id },
    { formId, respondentId: "alice" },
    { formId, refNamespace: "project", refId: "spring" },
  ]);
});

test("a filter the API refuses lists its problems", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const host = responsesHost([v1], [response(v1, "alice")], {
    answer: (route, request) =>
      route === "GET /responses" && new URL(request.url).searchParams.has("respondentId")
        ? json(422, {
            _tag: "ValidationFailed",
            issues: [{ path: ["respondentId"], message: "Expected at most 255 characters" }],
          })
        : undefined,
  });
  const screen = await renderPage(host.fetch);
  await expect.element(screen.getByText("alice", { exact: true })).toBeVisible();

  await screen.getByLabelText("Respondent").fill("x".repeat(256));
  await screen.getByRole("button", { name: "Filter" }).click();

  await expect
    .element(screen.getByText("These filters aren't valid: Expected at most 255 characters"))
    .toBeVisible();
});

test("an opened response reads as its own version's questions and answers, not through the renderer", async () => {
  const name = textQuestion("Name");
  const colour: QuestionSnapshot = {
    id: crypto.randomUUID(),
    type: "single_choice",
    label: "Favourite colour",
    required: true,
    config: {
      options: [
        { value: "o-red", label: "Red" },
        { value: "o-blue", label: "Blue" },
      ],
      display: "radio",
    },
  };
  const v1 = version(1, [
    name,
    { id: crypto.randomUUID(), type: "email", label: "Email", required: true, config: {} },
    {
      id: crypto.randomUUID(),
      type: "number",
      label: "Age",
      required: true,
      config: { integer: true },
    },
    { id: crypto.randomUUID(), type: "date", label: "Born", required: true, config: {} },
    colour,
    {
      id: crypto.randomUUID(),
      type: "multiple_choice",
      label: "Toppings",
      required: true,
      config: {
        options: [
          { value: "o-ham", label: "Ham, smoked" },
          { value: "o-egg", label: "Egg" },
          { value: "o-oil", label: "Oil" },
        ],
      },
    },
    { id: crypto.randomUUID(), type: "boolean", label: "Ready?", required: true, config: {} },
    textQuestion("Comments"),
  ]);
  const v2 = version(2, [{ ...name, label: "Full name" }]);
  const [, email, age, born, , toppings, ready] = v1.definition.questions;
  const answered = response(v1, "alice", {
    [name.id]: "Ada",
    [email!.id]: "ada@example.com",
    [age!.id]: 36,
    [born!.id]: "1815-12-10",
    [colour.id]: "o-blue",
    [toppings!.id]: ["o-ham", "o-oil"],
    [ready!.id]: true,
  });
  const host = responsesHost([v1, v2], [answered, response(v2, "bob")]);
  const screen = await renderPage(host.fetch);

  const item = screen.getByRole("listitem").filter({ hasText: "alice" });
  await item.getByRole("button", { name: "Open" }).click();

  const detail = screen.getByRole("region", { name: "Response from alice" });
  await expect.element(detail.getByText("Version 1", { exact: false })).toBeVisible();
  const answerTo = (label: string) =>
    detail.getByRole("definition").nth(v1.definition.questions.findIndex((q) => q.label === label));
  await expect.element(detail.getByText("Name", { exact: true })).toBeVisible();
  await expect.element(detail.getByText("Full name", { exact: true })).not.toBeInTheDocument();
  await expect.element(answerTo("Name")).toHaveTextContent("Ada");
  await expect
    .element(answerTo("Email").getByRole("link", { name: "ada@example.com" }))
    .toHaveAttribute("href", "mailto:ada@example.com");
  await expect.element(answerTo("Age")).toHaveTextContent("36");
  await expect
    .element(answerTo("Born").getByText("1815-12-10"))
    .toHaveAttribute("datetime", "1815-12-10");
  await expect.element(answerTo("Favourite colour")).toHaveTextContent("Blue");
  const picked = answerTo("Toppings").getByRole("listitem");
  expect(picked.elements().map((li) => li.textContent?.trim())).toEqual(["Ham, smoked", "Oil"]);
  await expect.element(answerTo("Ready?")).toHaveTextContent("Yes");
  await expect.element(answerTo("Comments")).toHaveTextContent("Skipped");
  expect(detail.getByRole("textbox").elements()).toEqual([]);
  expect(detail.getByRole("button", { name: "Submit" }).elements()).toEqual([]);
});

test("a response detail marks each question answered, skipped, or not shown from the stored path", async () => {
  const name = textQuestion("Name");
  const age = textQuestion("Age");
  const note = textQuestion("Note");
  const v1 = version(1, [name, age, note]);
  const host = responsesHost(
    [v1],
    [response(v1, "alice", { [name.id]: "Ada" }, [], [name.id, note.id])],
  );
  const screen = await renderPage(host.fetch);

  await screen
    .getByRole("listitem")
    .filter({ hasText: "alice" })
    .getByRole("button", { name: "Open" })
    .click();
  const detail = screen.getByRole("region", { name: "Response from alice" });
  const answerTo = (label: string) =>
    detail.getByRole("definition").nth(v1.definition.questions.findIndex((q) => q.label === label));
  await expect.element(answerTo("Name")).toHaveTextContent("Ada");
  await expect.element(answerTo("Age")).toHaveTextContent("Not shown");
  await expect.element(answerTo("Note")).toHaveTextContent("Skipped");
});

const openResponseFrom = async (screen: LocatorSelectors, who: string) => {
  const list = screen.getByRole("list", { name: "Responses" });
  await list.getByRole("listitem").filter({ hasText: who }).first().getByRole("button").click();
  const detail = screen.getByRole("region", { name: `Response from ${who}` });
  await expect.element(detail).toBeVisible();
  return { list, detail };
};

test("an admin deletes one response after confirming", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const doomed = response(v1, "alice");
  const host = responsesHost([v1], [doomed, response(v1, "bob")]);
  const screen = await renderPage(host.fetch);
  const { list, detail } = await openResponseFrom(screen, "alice");

  await detail.getByRole("button", { name: "Delete response" }).click();
  const confirm = screen.getByRole("alert");
  await expect
    .element(confirm.getByText("Delete this response? Its answers are removed for good."))
    .toBeVisible();
  await confirm.getByRole("button", { name: "Delete permanently" }).click();

  await expect.element(screen.getByText("Response deleted", { exact: true })).toBeVisible();
  await expect.element(detail).not.toBeInTheDocument();
  await expect.element(list.getByText("alice", { exact: true })).not.toBeInTheDocument();
  await expect.element(list.getByText("bob", { exact: true })).toBeVisible();
  expect(host.requests.filter((r) => r.startsWith("DELETE"))).toEqual([
    `DELETE /responses/${doomed.id}`,
  ]);
});

test("an admin deletes every response from a respondent across the tenant", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const host = responsesHost(
    [v1],
    [response(v1, "alice"), response(v1, "bob"), response(v1, "alice")],
  );
  const screen = await renderPage(host.fetch);
  const { list, detail } = await openResponseFrom(screen, "alice");

  await detail.getByRole("button", { name: "Delete all responses from alice" }).click();
  const confirm = screen.getByRole("alert");
  await expect
    .element(
      confirm.getByText(
        "Delete every response from alice, in every form of this tenant? They're removed for good.",
      ),
    )
    .toBeVisible();
  await confirm.getByRole("button", { name: "Delete permanently" }).click();

  await expect
    .element(screen.getByText("Deleted 2 responses from alice", { exact: true }))
    .toBeVisible();
  await expect.element(list.getByText("alice", { exact: true })).not.toBeInTheDocument();
  await expect.element(list.getByText("bob", { exact: true })).toBeVisible();
  expect(host.requests.filter((r) => r.startsWith("DELETE"))).toEqual([
    "DELETE /respondents/alice/responses",
  ]);
});

test("an unknown outcome on a delete says so and reloads the list", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const doomed = response(v1, "alice");
  const host = responsesHost([v1], [doomed, response(v1, "bob")], {
    answer: (route) => {
      if (route !== `DELETE /responses/${doomed.id}`) return undefined;
      host.stored = host.stored.filter((r) => r !== doomed);
      return new Response("Bad Gateway", { status: 502 });
    },
  });
  const screen = await renderPage(host.fetch);
  const { list, detail } = await openResponseFrom(screen, "alice");

  await detail.getByRole("button", { name: "Delete response" }).click();
  await screen.getByRole("button", { name: "Delete permanently" }).click();

  await expect
    .element(
      screen.getByText(
        "We couldn't confirm the response was deleted, so the list has been reloaded.",
      ),
    )
    .toBeVisible();
  await expect.element(list.getByText("alice", { exact: true })).not.toBeInTheDocument();
  expect(host.queries).toHaveLength(2);
});

test("an analyst reads responses but is offered no delete", async () => {
  const v1 = version(1, [textQuestion("Name")]);
  const host = responsesHost(
    [v1],
    [response(v1, "alice", { [v1.definition.questions[0]!.id]: "Ada" })],
    {
      capabilities: analyst,
    },
  );
  const screen = await renderPage(host.fetch);
  const { detail } = await openResponseFrom(screen, "alice");

  await expect.element(detail.getByText("Ada", { exact: true })).toBeVisible();
  expect(screen.getByRole("button", { name: /Delete/ }).elements()).toEqual([]);
});

test("someone without responses:read is asked to sign in", async () => {
  const host = responsesHost([], [], {
    answer: (route) =>
      route === "GET /responses"
        ? json(403, { _tag: "Forbidden", capability: "responses:read" })
        : undefined,
  });
  const screen = await renderPage(host.fetch);

  await expect
    .element(screen.getByText(/^Sign in as someone who can read responses\./))
    .toBeVisible();
  await expect
    .element(screen.getByRole("link", { name: "Sign in" }))
    .toHaveAttribute("href", config.loginUrl);
});
