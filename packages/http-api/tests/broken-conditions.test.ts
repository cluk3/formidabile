import { parseDefinition, questionsOf } from "@fb/core/definition";
import { afterAll, expect, test } from "vite-plus/test";
import { startApi } from "./api.ts";

const api = startApi();
afterAll(() => api.dispose());

const admin = api.clientAs("acme-admin");

const colourId = "00000000-0000-4000-8000-000000000001";
const detailId = "00000000-0000-4000-8000-000000000002";
const noteId = "00000000-0000-4000-8000-000000000003";
const missingId = "00000000-0000-4000-8000-000000000099";
const pageId = "00000000-0000-4000-8000-000000000010";

/** A draft publish must refuse: one leaf names an option value, and one names a question that is not earlier. */
const broken = {
  format: 2 as const,
  title: "Survey",
  pages: [
    {
      id: pageId,
      questions: [
        {
          id: colourId,
          type: "single_choice" as const,
          label: "Colour",
          required: false,
          config: {
            options: [
              { value: "red", label: "Red" },
              { value: "blue", label: "Blue" },
            ],
            display: "radio" as const,
          },
        },
        {
          id: detailId,
          type: "text" as const,
          label: "Details",
          required: false,
          config: { display: "single_line" as const },
          showCondition: { questionId: colourId, operator: "is_any_of", constant: ["gone"] },
        },
        {
          id: noteId,
          type: "text" as const,
          label: "Note",
          required: false,
          config: { display: "single_line" as const },
          showCondition: { questionId: missingId, operator: "equals", constant: "a" },
        },
      ],
      jumps: [],
    },
  ],
};

test("publishing a draft with a broken show condition is refused, and says why", async () => {
  const created = await admin.POST("/forms", { body: { definition: broken as never } });
  expect(created.response.status).toBe(201);
  const formId = created.data?.form.id ?? "";

  const published = await admin.POST("/forms/{formId}/draft/publish", {
    params: { path: { formId } },
    body: { expectedRevision: created.data?.draft.revision ?? "" },
  });

  expect(published.response.status).toBe(422);
  expect(published.error).toEqual({
    _tag: "ValidationFailed",
    issues: [
      {
        path: ["pages", 0, "questions", 1, "showCondition", "constant", 0],
        message: "This condition names an option value the question does not have",
      },
      {
        path: ["pages", 0, "questions", 2, "showCondition", "questionId"],
        message: "This condition reads a question that is not earlier in the form",
      },
    ],
  });

  const draft = await admin.GET("/forms/{formId}/draft", { params: { path: { formId } } });
  const stored = parseDefinition(draft.data?.draft?.definition);
  expect(stored.ok).toBe(true);
  if (!stored.ok) return;
  expect(questionsOf(stored.value)[1]?.showCondition).toEqual({
    questionId: colourId,
    operator: "is_any_of",
    constant: ["gone"],
  });
  expect(questionsOf(stored.value)[2]?.showCondition).toEqual({
    questionId: missingId,
    operator: "equals",
    constant: "a",
  });

  const detail = await admin.GET("/forms/{formId}", { params: { path: { formId } } });
  expect(detail.data?.currentVersion).toBeNull();
});
