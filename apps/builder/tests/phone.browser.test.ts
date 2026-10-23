import { questionsOf, type FormDefinition, type QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import ResponsesPage from "#lib/ResponsesPage.svelte";
import { admin, config, fakeHost, json } from "./fake-host.ts";

const formId = "0192f0c4-0000-7000-8000-00000000f701";

type SaveBody = { expectedRevision: string | null; definition: FormDefinition };

const draftHost = () => {
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
    definition: { format: 1, title: "Survey", questions: [] },
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

test("an editor can add a phone question and condition on its country code", async () => {
  const host = draftHost();
  const screen = await render(DraftEditor, {
    client: createBuilderClient(config, host.fetch),
    formId,
    signInHref: config.loginUrl,
    onDeleted: () => {},
  });

  await screen.getByLabelText("New question type").selectOptions("Phone");
  await screen.getByRole("button", { name: "Add question" }).click();
  const phone = screen.getByRole("region", { name: "Question 1" });
  await expect
    .element(phone.getByText("Respondents may enter a phone number with a country code."))
    .toBeVisible();
  await phone.getByLabelText("Label").fill("Mobile");

  await screen.getByLabelText("New question type").selectOptions("Text");
  await screen.getByRole("button", { name: "Add question" }).click();
  const note = screen.getByRole("region", { name: "Question 2" });
  await note.getByLabelText("Label").fill("Note");
  await note.getByRole("button", { name: "Only show when…" }).click();
  const operator = note.getByLabelText("Operator");
  expect(
    [...operator.element().querySelectorAll("option")].map((option) => option.textContent),
  ).toEqual([
    "equals",
    "does not equal",
    "starts with",
    "does not start with",
    "is answered",
    "is not answered",
  ]);
  await operator.selectOptions("starts_with");
  await note.getByLabelText("Value").fill("+1");
  await screen.getByRole("button", { name: "Save" }).click();
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  const saved = host.saves.at(-1)?.definition;
  expect(saved?.format).toBe(2);
  const questions = saved === undefined ? [] : questionsOf(saved);
  expect(questions[0]).toMatchObject({
    type: "phone",
    label: "Mobile",
    required: false,
    config: {},
  });
  expect(questions[1]?.showCondition).toEqual({
    questionId: questions[0]?.id,
    operator: "starts_with",
    constant: "+1",
  });
});

const at = "2026-10-21T08:00:00.000Z";

test("a response shows the stored phone number", async () => {
  const phoneId = "0192f0c4-0000-7000-8000-00000000f711";
  const phone: QuestionSnapshot = {
    id: phoneId,
    type: "phone",
    label: "Phone",
    required: true,
    config: {},
  };
  const versionId = "0192f0c4-0000-7000-8000-00000000f721";
  const responseId = "0192f0c4-0000-7000-8000-00000000f731";
  const definition = { format: 1 as const, title: "Survey", questions: [phone] };
  const fetch = fakeHost(async (route) => {
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
    if (route === "GET /responses")
      return json(200, {
        responses: [
          {
            id: responseId,
            formId,
            versionId,
            versionNumber: 1,
            respondentId: "alice",
            submittedAt: at,
            editedAt: null,
            externalRefs: [],
          },
        ],
        nextCursor: null,
      });
    if (route === `GET /responses/${responseId}`)
      return json(200, {
        response: {
          id: responseId,
          formId,
          versionId,
          versionNumber: 1,
          respondentId: "alice",
          submittedAt: at,
          editedAt: null,
          externalRefs: [],
          answers: { [phoneId]: "+14155550100" },
        },
        version: { id: versionId, number: 1, definition },
        path: [phoneId],
      });
    return json(404, { _tag: "NotFound" });
  }, admin);

  const screen = await render(ResponsesPage, {
    client: createBuilderClient(config, fetch),
    formId,
    signInHref: config.loginUrl,
  });
  await screen.getByRole("button", { name: "Open" }).click();
  const detail = screen.getByRole("region", { name: "Response from alice" });
  await expect.element(detail.getByText("Phone", { exact: true })).toBeVisible();
  await expect.element(detail.getByText("+14155550100")).toBeVisible();
});
