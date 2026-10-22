import type { FormDefinition, QuestionSnapshot } from "@fb/core/definition";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-svelte";
import { createBuilderClient } from "#lib/api.ts";
import DraftEditor from "#lib/DraftEditor.svelte";
import { config, fakeHost, json } from "./fake-host.ts";

const formId = crypto.randomUUID();

const consent: QuestionSnapshot = {
  id: crypto.randomUUID(),
  type: "boolean",
  label: "I agree to the terms",
  required: false,
  config: {},
};

const definition: FormDefinition = {
  format: 1,
  title: "Consent",
  questions: [consent],
};

const draftOf = (stored: unknown, revision: string) => ({
  formId,
  revision,
  basedOnVersionId: null,
  definition: stored,
  updatedAt: "2026-10-21T08:00:00.000Z",
});

test("must be yes is a setting that makes the question required", async () => {
  let draft = draftOf(definition, "r0");
  const saves: Array<{ expectedRevision: string | null; definition: FormDefinition }> = [];
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
      const body = await request.json();
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
  const card = screen.getByRole("region", { name: "Question 1" });

  await expect.element(card.getByLabelText("Must be yes")).toBeVisible();
  await expect.element(card.getByText("skip the question", { exact: false })).toBeVisible();

  await userEvent.click(card.getByLabelText("Must be yes"));

  await expect.element(card.getByLabelText("Required")).toBeChecked();
  await expect
    .element(card.getByText("Respondents see one checkbox and must check it."))
    .toBeVisible();
  await userEvent.click(card.getByLabelText("Required"));
  await expect.element(card.getByLabelText("Required")).toBeChecked();

  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await expect.element(screen.getByText("Draft saved")).toBeVisible();

  expect(saves[0]?.definition).toMatchObject({
    format: 2,
    pages: [
      {
        questions: [
          {
            required: true,
            config: { mustBeYes: true },
          },
        ],
      },
    ],
  });
});
