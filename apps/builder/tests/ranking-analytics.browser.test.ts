import type { Schemas } from "@fb/api-client";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormAnalytics from "#lib/FormAnalytics.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

const option = (
  value: string,
  label: string,
  meanPosition: number | null,
  firstPlace: number,
  base: number,
  offeredIn: number[],
): Schemas["AnalyticsSummary"] extends infer S
  ? S extends { type: "ranking" }
    ? S["options"][number]
    : never
  : never => ({
  value,
  label,
  otherLabels: [],
  meanPosition,
  firstPlace,
  base,
  offeredIn,
});

const analytics: Schemas["FormAnalytics"] = {
  formId,
  totalResponses: 5,
  versions: [
    { versionId: crypto.randomUUID(), number: 1, publishedAt: at, responses: 3 },
    { versionId: crypto.randomUUID(), number: 2, publishedAt: at, responses: 2 },
  ],
  questions: [
    {
      questionId: crypto.randomUUID(),
      type: "ranking",
      label: "Priorities",
      otherLabels: [],
      inCurrentVersion: true,
      combined: {
        responses: 5,
        answered: 3,
        skipped: 2,
        absentResponses: 0,
        summary: {
          type: "ranking",
          options: [
            option("a", "Alpha", 5 / 3, 1, 3, [1, 2]),
            option("b", "Beta", 4 / 3, 2, 3, [1, 2]),
            option("c", "Gamma", 3, 0, 2, [1]),
          ],
        },
      },
      byVersion: [
        {
          version: 1,
          present: true,
          responses: 3,
          answered: 2,
          skipped: 1,
          summary: {
            type: "ranking",
            options: [
              option("a", "Alpha", 1.5, 1, 2, [1]),
              option("b", "Beta", 1.5, 1, 2, [1]),
              option("c", "Gamma", 3, 0, 2, [1]),
            ],
          },
          constraints: null,
        },
        {
          version: 2,
          present: true,
          responses: 2,
          answered: 1,
          skipped: 1,
          summary: {
            type: "ranking",
            options: [option("a", "Alpha", 2, 0, 1, [2]), option("b", "Beta", 1, 1, 1, [2])],
          },
          constraints: null,
        },
      ],
    },
  ],
};

test("a ranking shows each option's mean position and first-place count", async () => {
  const fetch = fakeHost((route) =>
    route === `GET /forms/${formId}/analytics`
      ? json(200, analytics)
      : json(404, { _tag: "NotFound" }),
  );
  const screen = await render(FormAnalytics, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });

  const combined = screen.getByRole("table", { name: "All versions" }).nth(1);
  await expect.element(combined.getByRole("rowheader", { name: "Alpha" })).toBeVisible();
  await expect.element(combined.getByRole("cell", { name: "1.67" })).toBeVisible();
  await expect.element(combined.getByRole("cell", { name: "33%" })).toBeVisible();
  await expect.element(screen.getByText("Gamma: mean 3, first 0", { exact: false })).toBeVisible();
  await expect
    .element(screen.getByText("Some options weren't offered in every version."))
    .toBeVisible();
});
