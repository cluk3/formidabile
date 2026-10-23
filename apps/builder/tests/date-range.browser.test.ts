import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import DateRangeAnswer from "#lib/answers/DateRangeAnswer.svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const definition = { format: 1 as const, title: "Travel", questions: [] } satisfies FormDefinition;

const draftOf = (stored: unknown, revision: string) => ({
  formId,
  revision,
  basedOnVersionId: null,
  definition: stored,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

test("the editor sets a date range's bounds and saves a publishable question", async () => {
  let draft = draftOf(definition, "r0");
  const saves: SaveBody[] = [];
  const fetch = fakeHost(async (route, request) => {
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
      draft = draftOf(body.definition, "r1");
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

  await screen.getByLabelText("New question type").selectOptions("Date range");
  await screen.getByRole("button", { name: "Add question" }).click();
  const question = screen.getByRole("region", { name: "Question 1" });
  await question.getByLabelText("Label").fill("Stay");
  await question.getByLabelText("Earliest date").fill("2026-01-01");
  await question.getByLabelText("Latest date").fill("2026-12-31");
  await screen.getByRole("button", { name: "Save" }).click();

  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  const saved = saves[0]?.definition;
  expect(validateForPublish(saved, [])).toMatchObject({ ok: true });
  expect(saved?.format).toBe(2);
  const questions = saved?.format === 2 ? saved.pages[0]?.questions : [];
  expect(questions).toMatchObject([
    { type: "date_range", label: "Stay", config: { min: "2026-01-01", max: "2026-12-31" } },
  ]);
});

const stay = {
  id: "0192f0c4-0000-7000-8000-000000000201",
  type: "date_range",
  label: "Stay",
  required: false,
  config: {},
} satisfies QuestionSnapshot;

test("a date range answer shows the start and the end", async () => {
  const screen = await render(DateRangeAnswer, {
    question: stay,
    value: { start: "2026-05-01", end: "2026-05-09" },
    display: "2026-05-01 to 2026-05-09",
  });

  await expect.element(screen.getByText("2026-05-01")).toHaveAttribute("datetime", "2026-05-01");
  await expect.element(screen.getByText("2026-05-09")).toHaveAttribute("datetime", "2026-05-09");
  await expect.element(screen.container).toHaveTextContent("2026-05-01 to 2026-05-09");
});
