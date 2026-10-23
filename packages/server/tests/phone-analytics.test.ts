import type { QuestionSnapshot } from "@fb/core/definition";
import { mergeAnalytics } from "@fb/server";
import { describe, expect, test } from "vite-plus/test";

const phoneId = "0192f5a0-7c3e-7b1a-9d2e-000000000071";

const phone: QuestionSnapshot = {
  id: phoneId,
  type: "phone",
  label: "Phone",
  required: false,
  config: {},
};

describe("phone analytics", () => {
  test("a phone question reports counts only, with no values", () => {
    const analytics = mergeAnalytics({
      formId: "form",
      versions: [
        {
          id: "version-1",
          number: 1,
          publishedAt: new Date("2026-10-21T08:00:00.000Z"),
          responses: 3,
          definition: { format: 1, title: "Survey", questions: [phone] },
        },
      ],
      shown: [{ versionId: "version-1", questionId: phoneId, count: 3 }],
      answered: [{ versionId: "version-1", questionId: phoneId, count: 2 }],
      choices: [],
      numbers: [],
      combinedNumbers: [],
      nps: [],
      rankings: [],
      matrixCells: [],
      matrixAnsweredRows: [],
    });

    expect(analytics.questions).toEqual([
      {
        questionId: phoneId,
        type: "phone",
        label: "Phone",
        otherLabels: [],
        inCurrentVersion: true,
        combined: {
          responses: 3,
          shown: 3,
          answered: 2,
          skipped: 1,
          notShown: 0,
          absentResponses: 0,
          summary: { type: "phone" },
        },
        byVersion: [
          {
            version: 1,
            present: true,
            responses: 3,
            shown: 3,
            answered: 2,
            skipped: 1,
            notShown: 0,
            summary: { type: "phone" },
            constraints: null,
          },
        ],
      },
    ]);
    expect(JSON.stringify(analytics)).not.toContain("+");
  });
});
