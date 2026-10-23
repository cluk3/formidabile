import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { questionsOf } from "@fb/core/definition";
import type { Schemas } from "@fb/api-client";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import ResponseDetail from "#lib/ResponseDetail.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000a140";

const definitionOf = (questions: QuestionSnapshot[] = []): FormDefinition => ({
  format: 1,
  title: "Survey",
  questions,
});

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = (definition: FormDefinition) => {
  let draft = {
    formId,
    revision: "r0",
    basedOnVersionId: null,
    definition,
    updatedAt: "2026-10-21T08:00:00.000Z",
  };
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
      draft = { ...draft, revision: `r${saves.length}`, definition: body.definition };
      return json(200, draft);
    }
    return json(404, { _tag: "NotFound" });
  });
  return { fetch, saves };
};

const renderEditor = (fetch: typeof globalThis.fetch) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

const question = (screen: Awaited<ReturnType<typeof renderEditor>>, n: number) =>
  screen.getByRole("region", { name: `Question ${n}` });

const optionLabels = (select: HTMLSelectElement) =>
  [...select.options].map((option) => option.textContent?.trim());

test("an editor chooses which address lines are shown and required", async () => {
  const host = draftHost(definitionOf());
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("New question type").selectOptions("Address");
  await screen.getByRole("button", { name: "Add question" }).click();
  const card = question(screen, 1);
  await card.getByLabelText("Label").fill("Home");
  await card
    .getByRole("group", { name: "Line 1" })
    .getByRole("checkbox", { name: "Required" })
    .click();
  await card
    .getByRole("group", { name: "Line 2" })
    .getByRole("checkbox", { name: "Shown" })
    .click();
  await screen.getByLabelText("New question type").selectOptions("Text");
  await screen.getByRole("button", { name: "Add question" }).click();
  const note = question(screen, 2);
  await note.getByRole("button", { name: "Only show when…" }).click();

  const countryShown = optionLabels(note.getByLabelText("Operator").element() as HTMLSelectElement);
  expect(countryShown).toEqual([
    "country is any of",
    "country is none of",
    "is answered",
    "is not answered",
  ]);
  const gb = new Intl.DisplayNames([document.documentElement.lang || navigator.language || "en"], {
    type: "region",
  }).of("GB")!;
  await note.getByRole("checkbox", { name: gb }).click();
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = questionsOf(host.saves[0]!.definition);
  const home = saved[0];
  if (home?.type !== "address") throw new Error("expected an address");
  expect(home.config.lines.line1).toEqual({ shown: true, required: true });
  expect(home.config.lines.line2).toEqual({ shown: false, required: false });
  expect(home.config.lines.country).toEqual({ shown: true, required: false });
  expect(saved[1]?.showCondition).toEqual({
    questionId: home.id,
    operator: "country_is_any_of",
    constant: ["GB"],
  });

  await note.getByRole("button", { name: "Always show" }).click();
  await card
    .getByRole("group", { name: "Country" })
    .getByRole("checkbox", { name: "Shown" })
    .click();
  await note.getByRole("button", { name: "Only show when…" }).click();
  expect(optionLabels(note.getByLabelText("Operator").element() as HTMLSelectElement)).toEqual([
    "is answered",
    "is not answered",
  ]);
});

test("a response shows the filled address lines", async () => {
  const id = "0192f0c4-0000-7000-8000-00000000a141";
  const home: QuestionSnapshot = {
    id,
    type: "address",
    label: "Home",
    required: false,
    config: {
      lines: {
        line1: { shown: true, required: false },
        line2: { shown: true, required: false },
        city: { shown: true, required: false },
        region: { shown: true, required: false },
        postalCode: { shown: true, required: false },
        country: { shown: true, required: false },
      },
    },
  };
  const detail = {
    response: {
      id: "0192f0c4-0000-7000-8000-00000000a142",
      formId,
      versionId: "0192f0c4-0000-7000-8000-00000000a143",
      versionNumber: 1,
      respondentId: "ada",
      submittedAt: "2026-10-21T08:00:00.000Z",
      editedAt: null,
      externalRefs: [],
      answers: {
        [id]: { line1: "10 High Street", city: "London", country: "GB" },
      },
    },
    version: {
      id: "0192f0c4-0000-7000-8000-00000000a143",
      number: 1,
      definition: definitionOf([home]),
    },
    path: [id],
  } as Schemas["ResponseDetail"];

  const screen = await render(ResponseDetail, { detail, close: () => {} });
  const answer = screen.getByRole("definition");
  await expect.element(answer).toBeVisible();
  const text = answer.element().textContent ?? "";
  expect(text).toContain("10 High Street");
  expect(text).toContain("London");
  expect(text).toContain("(GB)");
  expect(answer.getByRole("link").elements()).toEqual([]);
});
