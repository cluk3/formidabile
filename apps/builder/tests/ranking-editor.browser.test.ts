import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { questionsOf, validateForPublish } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const definitionOf = (questions: QuestionSnapshot[] = []): FormDefinition => ({
  format: 1,
  title: "Survey",
  questions,
});

const draftOf = (definition: unknown, revision: string) => ({
  formId,
  revision,
  basedOnVersionId: null,
  definition,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = (definition: FormDefinition) => {
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
      draft = draftOf(body.definition, `r${saves.length}`);
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
};

test("a ranking editor keeps two to twenty options, and a removed option leaves its condition broken", async () => {
  const host = draftHost(definitionOf());
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, host.fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

  await screen.getByLabelText("New question type").selectOptions("Ranking");
  await screen.getByRole("button", { name: "Add question" }).click();
  const ranking = screen.getByRole("region", { name: "Question 1" });
  await ranking.getByLabelText("Label").fill("Priorities");
  await ranking.getByLabelText("Option 1").fill("Alpha");
  await ranking.getByLabelText("Option 2").fill("Beta");
  await ranking.getByRole("button", { name: "Add option" }).click();
  await ranking.getByLabelText("Option 3").fill("Gamma");

  await screen.getByLabelText("New question type").selectOptions("Text");
  await screen.getByRole("button", { name: "Add question" }).click();
  const follow = screen.getByRole("region", { name: "Question 2" });
  await follow.getByLabelText("Label").fill("Why");
  await follow.getByRole("button", { name: "Only show when…" }).click();
  await follow.getByLabelText("Operator").selectOptions("ranks in the top");
  await follow.getByLabelText("Option").selectOptions("Alpha");
  await follow.getByLabelText("Top N").fill("1");

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = host.saves[0]?.definition;
  if (saved === undefined) throw new Error("missing save");
  const [priorities, why] = questionsOf(saved);
  expect(priorities).toMatchObject({ type: "ranking", label: "Priorities" });
  expect(validateForPublish(saved, [])).toMatchObject({ ok: true });
  if (priorities?.type !== "ranking") throw new Error("expected a ranking");
  const alpha = priorities.config.options[0]?.value;
  expect(why?.showCondition).toEqual({
    questionId: priorities.id,
    operator: "ranks_in_top",
    constant: { value: alpha, n: 1 },
  });

  await ranking.getByRole("button", { name: "Remove option 1" }).click();
  await expect
    .element(follow.getByText("This condition names an option value the question does not have"))
    .toBeVisible();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();
  const broken = host.saves[1]?.definition;
  if (broken === undefined) throw new Error("missing save");
  expect(validateForPublish(broken, []).ok).toBe(false);
  expect(questionsOf(broken)[1]?.showCondition).toMatchObject({
    operator: "ranks_in_top",
    constant: { value: alpha, n: 1 },
  });
});
