import type { Schemas } from "@fb/api-client";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormAnalytics from "#lib/FormAnalytics.svelte";
import { admin, config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

const why: Schemas["QuestionAnalytics"] = {
  questionId: crypto.randomUUID(),
  type: "single_choice",
  label: "Why not?",
  otherLabels: [],
  inCurrentVersion: true,
  combined: {
    responses: 4,
    shown: 2,
    answered: 1,
    skipped: 1,
    notShown: 2,
    absentResponses: 0,
    summary: {
      type: "single_choice",
      options: [
        { value: "price", label: "Price", otherLabels: [], count: 1, base: 1, offeredIn: [1] },
      ],
    },
  },
  byVersion: [
    {
      version: 1,
      present: true,
      responses: 4,
      shown: 2,
      answered: 1,
      skipped: 1,
      notShown: 2,
      summary: {
        type: "single_choice",
        options: [
          { value: "price", label: "Price", otherLabels: [], count: 1, base: 1, offeredIn: [1] },
        ],
      },
      constraints: null,
    },
  ],
};

const analytics: Schemas["FormAnalytics"] = {
  formId,
  totalResponses: 4,
  versions: [{ versionId: crypto.randomUUID(), number: 1, publishedAt: at, responses: 4 }],
  questions: [why],
};

type Screen = Awaited<ReturnType<typeof render>>;
type Locator = ReturnType<Screen["getByRole"]>;

const rowText = async (table: Locator, header: string) => {
  const rowHeader = table.getByRole("rowheader", { name: header, exact: true });
  await expect.element(rowHeader).toBeVisible();
  const row = rowHeader.element().closest("tr");
  return [...(row?.cells ?? [])].map((cell) =>
    (cell.textContent ?? "").replaceAll(/\s+/g, " ").trim(),
  );
};

test("the analytics tables show answered, skipped and not shown, with a CSS bar", async () => {
  const fetch = fakeHost(
    (route) =>
      route === `GET /forms/${formId}/analytics`
        ? json(200, analytics)
        : json(404, { _tag: "NotFound" }),
    admin,
  );
  const screen = await render(FormAnalytics, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });
  const region = screen.getByRole("region", { name: "Why not?", exact: true });
  await expect
    .element(region.getByText("4 responses: 2 shown, 1 answered, 1 skipped, 2 not shown."))
    .toBeVisible();

  const counts = region.getByRole("table", { name: "Answered, skipped and not shown" });
  expect(await rowText(counts, "Answered")).toEqual(["Answered", "1", "25%"]);
  expect(await rowText(counts, "Skipped")).toEqual(["Skipped", "1", "25%"]);
  expect(await rowText(counts, "Not shown")).toEqual(["Not shown", "2", "50%"]);
  const bar = counts
    .getByRole("rowheader", { name: "Not shown", exact: true })
    .element()
    .closest("tr")
    ?.querySelector(".bg-primary");
  expect(bar).toBeTruthy();
  expect((bar as HTMLElement).style.width).toBe("50%");

  const byVersion = region.getByRole("table", { name: "By version" });
  expect(await rowText(byVersion, "Version 1")).toEqual([
    "Version 1",
    "4",
    "2",
    "1",
    "1",
    "2",
    "Price: 1",
  ]);

  const shares = region.getByRole("table", { name: "All versions" });
  expect(await rowText(shares, "Price")).toEqual(["Price", "1", "100%", "Version 1"]);
});
