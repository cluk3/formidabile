import type { Schemas } from "@fb/api-client";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import FormAnalytics from "#lib/FormAnalytics.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();
const at = "2026-10-21T08:00:00.000Z";

const analytics: Schemas["FormAnalytics"] = {
  formId,
  totalResponses: 3,
  versions: [{ versionId: crypto.randomUUID(), number: 1, publishedAt: at, responses: 3 }],
  questions: [
    {
      questionId: crypto.randomUUID(),
      type: "number",
      label: "Recommend?",
      otherLabels: [],
      inCurrentVersion: true,
      combined: {
        responses: 3,
        answered: 3,
        skipped: 0,
        absentResponses: 0,
        summary: {
          type: "number",
          count: 3,
          min: 0,
          max: 10,
          mean: 20 / 3,
          median: 10,
          nps: { promoters: 2, passives: 0, detractors: 1, answered: 3, score: 33 },
        },
      },
      byVersion: [
        {
          version: 1,
          present: true,
          responses: 3,
          answered: 3,
          skipped: 0,
          summary: {
            type: "number",
            count: 3,
            min: 0,
            max: 10,
            mean: 20 / 3,
            median: 10,
            nps: { promoters: 2, passives: 0, detractors: 1, answered: 3, score: 33 },
          },
          constraints: { type: "number", integer: true, min: 0, max: 10 },
        },
      ],
    },
  ],
};

test("an NPS question shows promoter, passive and detractor counts and the score", async () => {
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

  const nps = screen.getByRole("table", { name: "NPS" });
  await expect.element(nps).toBeVisible();
  await expect.element(nps.getByRole("rowheader", { name: "Promoters" })).toBeVisible();
  await expect.element(nps.getByRole("cell", { name: "67%" })).toBeVisible();
  await expect.element(nps.getByRole("rowheader", { name: "Passives" })).toBeVisible();
  await expect.element(nps.getByRole("cell", { name: "0%" })).toBeVisible();
  await expect.element(nps.getByRole("rowheader", { name: "Detractors" })).toBeVisible();
  await expect.element(nps.getByRole("cell", { name: "33%" })).toBeVisible();
  await expect.element(nps.getByRole("cell", { name: "33", exact: true })).toBeVisible();
  expect(screen.getByRole("table", { name: "By version" }).element().textContent).toContain(
    "NPS 33 · Promoters 2 · Passives 0 · Detractors 1",
  );
});
