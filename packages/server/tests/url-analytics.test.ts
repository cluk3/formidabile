import type { QuestionSnapshot } from "@fb/core/definition";
import { mergeAnalytics } from "@fb/server";
import { describe, expect, test } from "vite-plus/test";

const urlId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a8";

const website: QuestionSnapshot = {
  id: urlId,
  type: "url",
  label: "Website",
  required: false,
  config: {},
};

describe("url analytics", () => {
  test("a URL question reports counts only, the same shape as text", () => {
    const analytics = mergeAnalytics({
      formId: "form",
      versions: [
        {
          id: "version-1",
          number: 1,
          publishedAt: new Date(Date.UTC(2026, 9, 1)),
          responses: 4,
          definition: { format: 1, title: "Survey", questions: [website] },
        },
      ],
      answered: [{ versionId: "version-1", questionId: urlId, count: 1 }],
      choices: [],
      numbers: [],
      combinedNumbers: [],
      nps: [],
    });

    expect(analytics.questions).toEqual([
      {
        questionId: urlId,
        type: "url",
        label: "Website",
        otherLabels: [],
        inCurrentVersion: true,
        combined: {
          responses: 4,
          answered: 1,
          skipped: 3,
          absentResponses: 0,
          summary: { type: "url" },
        },
        byVersion: [
          {
            version: 1,
            present: true,
            responses: 4,
            answered: 1,
            skipped: 3,
            summary: { type: "url" },
            constraints: null,
          },
        ],
      },
    ]);
  });
});
