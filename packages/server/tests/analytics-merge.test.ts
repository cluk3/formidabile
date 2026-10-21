import { mergeAnalytics, type AnalyticsCounts } from "@fb/server";
import type { FormDefinition } from "@fb/core/definition";
import { describe, expect, test } from "vite-plus/test";

type Question = FormDefinition["questions"][number];

const colourId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c1";

const colour = (options: ReadonlyArray<readonly [string, string]>, label = "Colour"): Question => ({
  id: colourId,
  type: "single_choice",
  label,
  required: false,
  config: { display: "radio", options: options.map(([value, label]) => ({ value, label })) },
});

const publishedAt = (number: number) => new Date(Date.UTC(2026, 9, number));

const version = (number: number, responses: number, questions: ReadonlyArray<Question>) => ({
  id: `version-${number}`,
  number,
  publishedAt: publishedAt(number),
  responses,
  definition: { format: 1 as const, title: "Survey", questions: [...questions] },
});

const counts = (input: Partial<AnalyticsCounts> & Pick<AnalyticsCounts, "versions">) =>
  mergeAnalytics({
    formId: "form",
    answered: [],
    choices: [],
    numbers: [],
    combinedNumbers: [],
    ...input,
  });

describe("one version", () => {
  test("a single-choice question gives each option's count against the answered responses", () => {
    const analytics = counts({
      versions: [
        version(1, 3, [
          colour([
            ["red", "Red"],
            ["green", "Green"],
          ]),
        ]),
      ],
      answered: [{ versionId: "version-1", questionId: colourId, count: 2 }],
      choices: [{ versionId: "version-1", questionId: colourId, value: "red", count: 2 }],
    });

    const options = [
      { value: "red", label: "Red", otherLabels: [], count: 2, base: 2, offeredIn: [1] },
      { value: "green", label: "Green", otherLabels: [], count: 0, base: 2, offeredIn: [1] },
    ];
    expect(analytics).toEqual({
      formId: "form",
      totalResponses: 3,
      versions: [{ versionId: "version-1", number: 1, publishedAt: publishedAt(1), responses: 3 }],
      questions: [
        {
          questionId: colourId,
          type: "single_choice",
          label: "Colour",
          otherLabels: [],
          inCurrentVersion: true,
          combined: {
            responses: 3,
            answered: 2,
            skipped: 1,
            absentResponses: 0,
            summary: { type: "single_choice", options },
          },
          byVersion: [
            {
              version: 1,
              present: true,
              responses: 3,
              answered: 2,
              skipped: 1,
              summary: { type: "single_choice", options },
              constraints: null,
            },
          ],
        },
      ],
    });
  });
});
