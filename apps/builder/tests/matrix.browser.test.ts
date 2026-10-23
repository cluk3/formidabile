import {
  questionsOf,
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import FormAnalytics from "#lib/FormAnalytics.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000f401";
const followId = "0192f0c4-0000-7000-8000-00000000f402";

const follow: QuestionSnapshot = {
  id: followId,
  type: "text",
  label: "Why?",
  required: false,
  config: { display: "single_line" },
};

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = (questions: QuestionSnapshot[]) => {
  let draft: {
    formId: string;
    revision: string;
    basedOnVersionId: null;
    definition: FormDefinition;
    updatedAt: string;
  } = {
    formId,
    revision: "r0",
    basedOnVersionId: null,
    definition: { format: 1, title: "Survey", questions },
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
  const saves: SaveBody[] = [];
  const fetch: typeof globalThis.fetch = fakeHost(async (route, request) => {
    if (route === `GET /forms/${formId}/draft`) return json(200, { draft });
    if (route === `GET /forms/${formId}`)
      return json(200, {
        id: formId,
        availability: "closed",
        responseLimit: "unlimited",
        currentVersion: null,
        externalRefs: [],
      });
    if (route === `PUT /forms/${formId}/draft`) {
      const body: SaveBody = await request.json();
      saves.push(body);
      draft = { ...draft, revision: `r${saves.length}`, definition: body.definition };
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
};

const question = (screen: Awaited<ReturnType<typeof render>>, n: number) =>
  screen.getByRole("region", { name: `Question ${n}` });

test("the row editor adds, relabels, reorders and removes rows, and a condition can name one", async () => {
  const host = draftHost([follow]);
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, host.fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });
  await screen.getByLabelText("New question type").selectOptions("Single-choice matrix");
  await screen.getByRole("button", { name: "Add question" }).click();

  const matrix = question(screen, 2);
  await matrix.getByLabelText("Label").fill("Trip");
  await matrix.getByLabelText("Row 1").fill("Speed");
  await matrix.getByLabelText("column 1").fill("Good");
  await matrix.getByLabelText("column 2").fill("Poor");
  await matrix.getByRole("button", { name: "Add row" }).click();
  await matrix.getByLabelText("Row 2").fill("Comfort");
  await matrix.getByRole("button", { name: "Move row 2 up" }).click();
  await matrix.getByRole("button", { name: "Remove row 2" }).click();

  await screen.getByLabelText("New question type").selectOptions("Text");
  await screen.getByRole("button", { name: "Add question" }).click();
  const after = question(screen, 3);
  await after.getByLabelText("Label").fill("Because");
  await after.getByRole("button", { name: "Only show when…" }).click();
  const questionSelect = after.getByLabelText("Question").element() as HTMLSelectElement;
  const trip = [...questionSelect.options].find((option) => option.textContent?.includes("Trip"));
  await after.getByLabelText("Question").selectOptions(trip?.value ?? "");
  const rowSelect = after.getByLabelText("Row").element() as HTMLSelectElement;
  const comfort = [...rowSelect.options].find((option) => option.textContent === "Comfort");
  await after.getByLabelText("Row").selectOptions(comfort?.value ?? "");
  await after.getByRole("checkbox", { name: "Good" }).click();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = host.saves.at(-1)?.definition;
  expect(saved?.format).toBe(2);
  const questions = saved === undefined ? [] : questionsOf(saved);
  const grid = questions[1];
  if (grid?.type !== "single_choice_matrix") throw new Error("matrix");
  expect(grid.config.rows.map((row) => row.label)).toEqual(["Comfort"]);
  expect(grid.config.columns.map((column) => column.label)).toEqual(["Good", "Poor"]);
  expect(grid.config.rows[0]?.value).toMatch(/\S/);
  expect(questions[2]?.showCondition).toEqual({
    questionId: grid.id,
    operator: "is_any_of",
    constant: [grid.config.columns[0]?.value],
    row: grid.config.rows[0]?.value,
  });
  expect(validateForPublish(saved, [])).toMatchObject({ ok: true });
});

test("analytics lists a count and a share for each row and column", async () => {
  const gridId = "0192f0c4-0000-7000-8000-00000000f411";
  const analytics = {
    formId,
    totalResponses: 2,
    versions: [
      {
        versionId: "0192f0c4-0000-7000-8000-00000000f421",
        number: 1,
        publishedAt: "2026-10-21T08:00:00.000Z",
        responses: 2,
      },
    ],
    questions: [
      {
        questionId: gridId,
        type: "single_choice_matrix" as const,
        label: "Trip",
        otherLabels: [],
        inCurrentVersion: true,
        combined: {
          responses: 2,
          shown: 2,
          answered: 2,
          skipped: 0,
          notShown: 0,
          absentResponses: 0,
          summary: {
            type: "single_choice_matrix" as const,
            cells: [
              {
                row: "speed",
                rowLabel: "Speed",
                otherRowLabels: [],
                column: "good",
                columnLabel: "Good",
                otherColumnLabels: [],
                count: 2,
                base: 2,
                share: 100,
              },
              {
                row: "speed",
                rowLabel: "Speed",
                otherRowLabels: [],
                column: "poor",
                columnLabel: "Poor",
                otherColumnLabels: [],
                count: 0,
                base: 2,
                share: 0,
              },
            ],
          },
        },
        byVersion: [
          {
            version: 1,
            present: true as const,
            responses: 2,
            shown: 2,
            answered: 2,
            skipped: 0,
            notShown: 0,
            summary: {
              type: "single_choice_matrix" as const,
              cells: [
                {
                  row: "speed",
                  rowLabel: "Speed",
                  otherRowLabels: [],
                  column: "good",
                  columnLabel: "Good",
                  otherColumnLabels: [],
                  count: 2,
                  base: 2,
                  share: 100,
                },
                {
                  row: "speed",
                  rowLabel: "Speed",
                  otherRowLabels: [],
                  column: "poor",
                  columnLabel: "Poor",
                  otherColumnLabels: [],
                  count: 0,
                  base: 2,
                  share: 0,
                },
              ],
            },
            constraints: null,
          },
        ],
      },
    ],
  };
  const fetch = fakeHost(async (route) => {
    if (route === `GET /forms/${formId}/analytics`) return json(200, analytics);
    return json(404, { _tag: "NotFound" });
  });
  const screen = await render(FormAnalytics, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });
  const table = screen.getByRole("table", { name: "All versions" });
  await expect.element(table.getByRole("row", { name: /Speed Good 2 100%/ })).toBeVisible();
  await expect.element(table.getByRole("row", { name: /Speed Poor 0 0%/ })).toBeVisible();
  await expect.element(screen.getByRole("cell", { name: /Speed \/ Good: 2/ })).toBeVisible();
});
