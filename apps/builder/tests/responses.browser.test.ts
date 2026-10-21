import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import ResponsesPage from "#lib/ResponsesPage.svelte";
import { admin, config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

type Answers = Record<string, string | number | boolean | string[]>;
type Version = { id: string; number: number; definition: FormDefinition };
type Stored = {
  id: string;
  versionId: string;
  respondentId: string | null;
  externalRefs: { namespace: string; refId: string }[];
  answers: Answers;
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
): Stored => ({ id: crypto.randomUUID(), versionId: of.id, respondentId, externalRefs, answers });

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
