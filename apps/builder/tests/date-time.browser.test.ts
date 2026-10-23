import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import ResponsesPage from "#lib/ResponsesPage.svelte";
import { admin, config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const definitionOf = (title: string, questions: QuestionSnapshot[] = []) =>
  ({ format: 1 as const, title, questions }) satisfies FormDefinition;

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

const renderEditor = (fetch: typeof globalThis.fetch) =>
  render(DraftEditor, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

const question = (screen: Awaited<ReturnType<typeof renderEditor>>, n: number) =>
  screen.getByRole("region", { name: `Question ${n}` });

test("the editor saves an earliest and latest local date and time", async () => {
  const host = draftHost(definitionOf("Survey"));
  const screen = await renderEditor(host.fetch);

  await screen.getByLabelText("New question type").selectOptions("Date and time");
  await screen.getByRole("button", { name: "Add question" }).click();
  await question(screen, 1).getByLabelText("Label").fill("Arrival");
  await question(screen, 1).getByLabelText("Earliest date and time").fill("2026-05-01T09:00");
  await question(screen, 1).getByLabelText("Latest date and time").fill("2026-05-31T18:00");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = host.saves[0]?.definition;
  expect(saved?.format).toBe(2);
  const questions = saved?.format === 2 ? saved.pages[0]?.questions : [];
  expect(questions).toMatchObject([
    {
      type: "date_time",
      label: "Arrival",
      config: { min: "2026-05-01T09:00", max: "2026-05-31T18:00" },
    },
  ]);
  expect(validateForPublish(saved, [])).toMatchObject({ ok: true });
});

test("a response shows a date and time as that wall-clock value", async () => {
  const arrival: QuestionSnapshot = {
    id: crypto.randomUUID(),
    type: "date_time",
    label: "Arrival",
    required: true,
    config: {},
  };
  const version = {
    id: crypto.randomUUID(),
    number: 1,
    definition: { format: 1 as const, title: "Survey v1", questions: [arrival] },
  };
  const responseId = crypto.randomUUID();
  const at = "2026-10-21T08:00:00.000Z";
  const fetch = fakeHost(async (route) => {
    if (route === "GET /responses")
      return json(200, {
        responses: [
          {
            id: responseId,
            formId,
            versionId: version.id,
            versionNumber: 1,
            respondentId: "alice",
            submittedAt: at,
            editedAt: null,
            externalRefs: [],
          },
        ],
        nextCursor: null,
      });
    if (route === `GET /forms/${formId}/versions`)
      return json(200, {
        versions: [
          {
            id: version.id,
            number: 1,
            publishedAt: at,
            publishedBy: "acme-admin",
            derivedFromVersionId: null,
            isCurrent: true,
          },
        ],
      });
    if (route === `GET /responses/${responseId}`)
      return json(200, {
        response: {
          id: responseId,
          formId,
          versionId: version.id,
          versionNumber: 1,
          respondentId: "alice",
          submittedAt: at,
          editedAt: null,
          externalRefs: [],
          answers: { [arrival.id]: "2026-05-04T15:30" },
        },
        version: { id: version.id, number: 1, definition: version.definition },
        path: [arrival.id],
      });
    return json(404, { _tag: "NotFound" });
  }, admin);

  const screen = await render(ResponsesPage, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });

  await screen
    .getByRole("listitem")
    .filter({ hasText: "alice" })
    .getByRole("button", { name: "Open" })
    .click();

  const detail = screen.getByRole("region", { name: "Response from alice" });
  await expect
    .element(detail.getByText("2026-05-04T15:30"))
    .toHaveAttribute("datetime", "2026-05-04T15:30");
});
