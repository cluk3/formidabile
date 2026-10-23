import type { QuestionSnapshot } from "@fb/core/definition";
import { mergeAnalytics, type AnalyticsCounts } from "@fb/server";
import { describe, expect, test } from "vite-plus/test";

const homeId = "0192f5a0-7c3e-7b1a-9d2e-0000000000a1";

const home: QuestionSnapshot = {
  id: homeId,
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

const counts = (input: Partial<AnalyticsCounts> & Pick<AnalyticsCounts, "versions">) =>
  mergeAnalytics({
    formId: "form",
    answered: [],
    shown: [],
    choices: [],
    numbers: [],
    combinedNumbers: [],
    nps: [],
    ...input,
  });

describe("address analytics", () => {
  test("reports counts only, the same shape as text", () => {
    const analytics = counts({
      versions: [
        {
          id: "version-1",
          number: 1,
          publishedAt: new Date(Date.UTC(2026, 9, 1)),
          responses: 4,
          definition: { format: 1, title: "Survey", questions: [home] },
        },
      ],
      answered: [{ versionId: "version-1", questionId: homeId, count: 1 }],
      shown: [{ versionId: "version-1", questionId: homeId, count: 4 }],
    });

    const question = analytics.questions.find((item) => item.questionId === homeId);
    expect(question?.combined).toEqual({
      responses: 4,
      shown: 4,
      answered: 1,
      skipped: 3,
      notShown: 0,
      absentResponses: 0,
      summary: { type: "address" },
    });
    expect(question?.byVersion).toEqual([
      {
        version: 1,
        present: true,
        responses: 4,
        shown: 4,
        answered: 1,
        skipped: 3,
        notShown: 0,
        summary: { type: "address" },
        constraints: null,
      },
    ]);
  });
});
