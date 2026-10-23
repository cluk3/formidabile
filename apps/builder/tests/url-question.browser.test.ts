import {
  validateForPublish,
  type FormDefinition,
  type QuestionSnapshot,
} from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import ResponsesPage from "#lib/ResponsesPage.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

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

test("an editor can add a URL question", async () => {
  let draft = draftOf(definitionOf("Links"), "r0");
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

  await screen.getByLabelText("New question type").selectOptions("URL");
  await screen.getByRole("button", { name: "Add question" }).click();
  const question = screen.getByRole("region", { name: "Question 1" });
  await expect
    .element(question.getByText("Respondents may enter an http or https URL."))
    .toBeVisible();
  await question.getByLabelText("Label").fill("Website");
  await question.getByLabelText("Required").click();
  await expect
    .element(question.getByText("Respondents must enter an http or https URL."))
    .toBeVisible();

  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = saves[0]?.definition;
  expect(validateForPublish(saved, [])).toMatchObject({ ok: true });
  const questions = saved?.format === 2 ? (saved.pages[0]?.questions ?? []) : [];
  expect(questions).toMatchObject([{ type: "url", label: "Website", required: true, config: {} }]);
});

test("a URL answer is plain text, never a link", async () => {
  const questionId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const responseId = crypto.randomUUID();
  const at = "2026-10-21T08:00:00.000Z";
  const website: QuestionSnapshot = {
    id: questionId,
    type: "url",
    label: "Website",
    required: true,
    config: {},
  };
  const definition = definitionOf("Links", [website]);
  const fetch = fakeHost(async (route) => {
    if (route === "GET /responses")
      return json(200, {
        responses: [
          {
            id: responseId,
            formId,
            versionId,
            versionNumber: 1,
            respondentId: "ada",
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
            id: versionId,
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
          versionId,
          versionNumber: 1,
          respondentId: "ada",
          submittedAt: at,
          editedAt: null,
          externalRefs: [],
          answers: { [questionId]: "https://example.com/phish" },
        },
        version: { id: versionId, number: 1, definition },
        path: [questionId],
      });
    return json(404, { _tag: "NotFound" });
  });
  const screen = await render(ResponsesPage, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });

  await screen.getByRole("button", { name: "Open" }).click();
  const detail = screen.getByRole("region", { name: "Response from ada" });
  const answer = detail.getByRole("definition");
  await expect.element(answer).toHaveTextContent("https://example.com/phish");
  expect(answer.getByRole("link").elements()).toEqual([]);
  expect(answer.element().querySelector("a")).toBeNull();
});
