import type { Schemas } from "@fb/api-client";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormAnalytics from "#lib/FormAnalytics.svelte";
import { admin, analyst, config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

const versions = [
  { versionId: crypto.randomUUID(), number: 1, publishedAt: at, responses: 2 },
  { versionId: crypto.randomUUID(), number: 2, publishedAt: at, responses: 3 },
];

const rating: Schemas["QuestionAnalytics"] = {
  questionId: crypto.randomUUID(),
  type: "single_choice",
  label: "How was it?",
  otherLabels: [],
  inCurrentVersion: true,
  combined: {
    responses: 5,
    answered: 4,
    skipped: 1,
    absentResponses: 0,
    summary: {
      type: "single_choice",
      options: [
        { value: "good", label: "Good", otherLabels: [], count: 3, base: 5, offeredIn: [1, 2] },
        {
          value: "ok",
          label: "Okay",
          otherLabels: [{ label: "OK", versions: [1] }],
          count: 0,
          base: 5,
          offeredIn: [1, 2],
        },
        { value: "great", label: "Great", otherLabels: [], count: 1, base: 3, offeredIn: [2] },
      ],
    },
  },
  byVersion: [
    {
      version: 1,
      present: true,
      responses: 2,
      answered: 2,
      skipped: 0,
      summary: {
        type: "single_choice",
        options: [
          { value: "good", label: "Good", otherLabels: [], count: 2, base: 2, offeredIn: [1] },
          { value: "ok", label: "OK", otherLabels: [], count: 0, base: 2, offeredIn: [1] },
        ],
      },
      constraints: null,
    },
    {
      version: 2,
      present: true,
      responses: 3,
      answered: 2,
      skipped: 1,
      summary: {
        type: "single_choice",
        options: [
          { value: "good", label: "Good", otherLabels: [], count: 1, base: 3, offeredIn: [2] },
          { value: "ok", label: "Okay", otherLabels: [], count: 0, base: 3, offeredIn: [2] },
          { value: "great", label: "Great", otherLabels: [], count: 1, base: 3, offeredIn: [2] },
        ],
      },
      constraints: null,
    },
  ],
};

const days: Schemas["QuestionAnalytics"] = {
  questionId: crypto.randomUUID(),
  type: "number",
  label: "How many days?",
  otherLabels: [],
  inCurrentVersion: true,
  combined: {
    responses: 5,
    answered: 3,
    skipped: 2,
    absentResponses: 0,
    summary: { type: "number", count: 3, min: 2, max: 40, mean: 16, median: 6 },
  },
  byVersion: [
    {
      version: 1,
      present: true,
      responses: 2,
      answered: 1,
      skipped: 1,
      summary: { type: "number", count: 1, min: 6, max: 6, mean: 6, median: 6 },
      constraints: { type: "number", integer: true, min: 0, max: 30 },
    },
    {
      version: 2,
      present: true,
      responses: 3,
      answered: 2,
      skipped: 1,
      summary: { type: "number", count: 2, min: 2, max: 40, mean: 21, median: 21 },
      constraints: { type: "number", integer: true, min: 0, max: 90 },
    },
  ],
};

const source: Schemas["QuestionAnalytics"] = {
  questionId: crypto.randomUUID(),
  type: "text",
  label: "Where did you hear of us?",
  otherLabels: [{ label: "Where from?", versions: [1] }],
  inCurrentVersion: false,
  combined: {
    responses: 2,
    answered: 1,
    skipped: 1,
    absentResponses: 3,
    summary: { type: "text" },
  },
  byVersion: [
    {
      version: 1,
      present: true,
      responses: 2,
      answered: 1,
      skipped: 1,
      summary: { type: "text" },
      constraints: null,
    },
    { version: 2, present: false },
  ],
};

const recommend: Schemas["QuestionAnalytics"] = {
  questionId: crypto.randomUUID(),
  type: "boolean",
  label: "Would you recommend us?",
  otherLabels: [],
  inCurrentVersion: true,
  combined: {
    responses: 3,
    answered: 3,
    skipped: 0,
    absentResponses: 2,
    summary: { type: "boolean", trueCount: 2, falseCount: 1 },
  },
  byVersion: [
    { version: 1, present: false },
    {
      version: 2,
      present: true,
      responses: 3,
      answered: 3,
      skipped: 0,
      summary: { type: "boolean", trueCount: 2, falseCount: 1 },
      constraints: null,
    },
  ],
};

const analytics: Schemas["FormAnalytics"] = {
  formId,
  totalResponses: 5,
  versions,
  questions: [rating, days, recommend, source],
};

const renderAnalytics = (answer: (route: string) => Response, capabilities = admin) => {
  const requests: string[] = [];
  const fetch = fakeHost((route) => {
    requests.push(route);
    return answer(route);
  }, capabilities);
  const screen = render(FormAnalytics, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });
  return { screen, requests };
};

const answering = (body: Schemas["FormAnalytics"]) => (route: string) =>
  route === `GET /forms/${formId}/analytics`
    ? json(200, body)
    : json(404, { _tag: "NotFound", resource: "form" });

type Screen = Awaited<ReturnType<typeof render>>;
type Locator = ReturnType<Screen["getByRole"]>;

/** The text of each cell in the row that `header` heads, with whitespace collapsed. */
const rowText = async (table: Locator, header: string) => {
  const rowHeader = table.getByRole("rowheader", { name: header, exact: true });
  await expect.element(rowHeader).toBeVisible();
  const row = rowHeader.element().closest("tr");
  return [...(row?.cells ?? [])].map((cell) =>
    (cell.textContent ?? "").replaceAll(/\s+/g, " ").trim(),
  );
};

const question = (screen: Screen, label: string) =>
  screen.getByRole("region", { name: label, exact: true });

test("the versions table counts each version's responses", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const table = (await screen).getByRole("table", { name: "Responses by version" });

  expect((await rowText(table, "Version 1")).slice(0, 2)).toEqual(["Version 1", "2"]);
  expect((await rowText(table, "Version 2")).slice(0, 2)).toEqual(["Version 2", "3"]);
  expect((await rowText(table, "All versions")).slice(0, 2)).toEqual(["All versions", "5"]);
});

test("an option's share counts only the versions that offered it, under its latest label", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const combined = question(await screen, "How was it?").getByRole("table", {
    name: "All versions",
  });

  expect(await rowText(combined, "Good")).toEqual(["Good", "3", "60%", "Versions 1 and 2"]);
  expect(await rowText(combined, "Okay")).toEqual([
    "Okay",
    "0",
    "0%",
    "Versions 1 and 2 (“OK” in version 1)",
  ]);
  expect(await rowText(combined, "Great")).toEqual(["Great", "1", "33%", "Version 2"]);
  await expect
    .element(
      question(await screen, "How was it?").getByText(
        "Some options weren't offered in every version. Each share counts only the answers from versions that offered the option, so the shares don't add up to 100%.",
      ),
    )
    .toBeVisible();
});

test("shares of options offered in the same versions carry no caveat", async () => {
  const { summary } = rating.combined;
  if (summary.type !== "single_choice") throw new Error("the rating is a single choice");
  const options = summary.options.slice(0, 2);
  const { screen } = renderAnalytics(
    answering({
      ...analytics,
      questions: [
        { ...rating, combined: { ...rating.combined, summary: { ...summary, options } } },
      ],
    }),
  );
  const choice = question(await screen, "How was it?");
  await expect.element(choice.getByRole("table", { name: "All versions" })).toBeVisible();

  await expect
    .element(choice.getByText(/weren't offered in every version/))
    .not.toBeInTheDocument();
});

test("each version's counts sit in their own row, and each version's option labels with them", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const byVersion = question(await screen, "How was it?").getByRole("table", {
    name: "By version",
  });

  expect(await rowText(byVersion, "Version 1")).toEqual([
    "Version 1",
    "2",
    "2",
    "0",
    "Good: 2 · OK: 0",
  ]);
  expect(await rowText(byVersion, "Version 2")).toEqual([
    "Version 2",
    "3",
    "2",
    "1",
    "Good: 1 · Okay: 0 · Great: 1",
  ]);
});

test("a version without the question shows no counts, and the combined result leaves its responses out", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const dropped = question(await screen, "Where did you hear of us?");

  await expect.element(dropped.getByText("Not in the current version.")).toBeVisible();
  await expect
    .element(dropped.getByText("Also labelled “Where from?” in version 1."))
    .toBeVisible();
  await expect
    .element(
      dropped.getByText(
        "2 responses: 1 answered, 1 skipped. Not asked in 3 responses, to versions without it.",
      ),
    )
    .toBeVisible();
  const byVersion = dropped.getByRole("table", { name: "By version" });
  expect(await rowText(byVersion, "Version 1")).toEqual(["Version 1", "2", "1", "1", ""]);
  expect(await rowText(byVersion, "Version 2")).toEqual(["Version 2", "Not in this version"]);
});

test("a yes/no question splits its answers", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const combined = question(await screen, "Would you recommend us?").getByRole("table", {
    name: "All versions",
  });

  expect(await rowText(combined, "Yes")).toEqual(["Yes", "2", "67%"]);
  expect(await rowText(combined, "No")).toEqual(["No", "1", "33%"]);
});

test("a number question shows its statistics and each version's allowed range", async () => {
  const { screen } = renderAnalytics(answering(analytics));
  const numbers = question(await screen, "How many days?");
  const combined = numbers.getByRole("table", { name: "All versions" });

  expect(await rowText(combined, "Answers")).toEqual(["Answers", "3"]);
  expect(await rowText(combined, "Minimum")).toEqual(["Minimum", "2"]);
  expect(await rowText(combined, "Maximum")).toEqual(["Maximum", "40"]);
  expect(await rowText(combined, "Mean")).toEqual(["Mean", "16"]);
  expect(await rowText(combined, "Median")).toEqual(["Median", "6"]);
  const byVersion = numbers.getByRole("table", { name: "By version" });
  expect(await rowText(byVersion, "Version 1")).toEqual([
    "Version 1",
    "2",
    "1",
    "1",
    "Min 6 · Max 6 · Mean 6 · Median 6 Allowed: whole numbers from 0 to 30",
  ]);
  expect((await rowText(byVersion, "Version 2")).at(-1)).toEqual(
    "Min 2 · Max 40 · Mean 21 · Median 21 Allowed: whole numbers from 0 to 90",
  );
});

test("a never-published form has no analytics yet", async () => {
  const { screen } = renderAnalytics(
    answering({ formId, totalResponses: 0, versions: [], questions: [] }),
  );

  await expect
    .element(
      (await screen).getByText("This form hasn't been published, so it has no responses yet."),
    )
    .toBeVisible();
});

test("an unknown form says it doesn't exist", async () => {
  const { screen } = renderAnalytics(() => json(404, { _tag: "NotFound", resource: "form" }));

  await expect.element((await screen).getByText("This form doesn't exist.")).toBeVisible();
});

test("an analyst, who can only read responses, sees the analytics", async () => {
  const { screen } = renderAnalytics(answering(analytics), analyst);

  await expect
    .element((await screen).getByRole("table", { name: "Responses by version" }))
    .toBeVisible();
});

test("a token without responses:read asks to sign in", async () => {
  const { screen } = renderAnalytics(() =>
    json(403, { _tag: "Forbidden", capability: "responses:read" }),
  );

  await expect
    .element((await screen).getByRole("link", { name: "Sign in" }))
    .toHaveAttribute("href", config.loginUrl);
});

test("a refused token asks to sign in", async () => {
  const { screen } = renderAnalytics(() => json(401, { _tag: "Unauthorized", reason: "missing" }));

  await expect
    .element((await screen).getByRole("link", { name: "Sign in" }))
    .toHaveAttribute("href", config.loginUrl);
});

test("a failed load offers a retry", async () => {
  let calls = 0;
  const failing = renderAnalytics((route) =>
    ++calls === 1 ? json(500, {}) : answering(analytics)(route),
  );
  const screen = await failing.screen;
  await screen.getByRole("button", { name: "Retry" }).click();
  await expect.element(screen.getByRole("table", { name: "Responses by version" })).toBeVisible();
  expect(failing.requests).toEqual([
    `GET /forms/${formId}/analytics`,
    `GET /forms/${formId}/analytics`,
  ]);
});
