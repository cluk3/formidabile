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

const commentId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c2";
const comment: Question = {
  id: commentId,
  type: "text",
  label: "Comment",
  required: false,
  config: { display: "multi_line" },
};

const scoreId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c3";
const score = (min: number, max: number, id = scoreId): Question => ({
  id,
  type: "number",
  label: "Score",
  required: true,
  config: { integer: true, min, max },
});

const readyId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c4";
const ready: Question = {
  id: readyId,
  type: "boolean",
  label: "Ready?",
  required: true,
  config: {},
};

const toppingsId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c5";
const toppings: Question = {
  id: toppingsId,
  type: "multiple_choice",
  label: "Toppings",
  required: false,
  config: {
    options: [
      { value: "cheese", label: "Cheese" },
      { value: "olives", label: "Olives" },
    ],
    maxSelected: 2,
  },
};

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
    nps: [],
    ...input,
  });

const question = (analytics: ReturnType<typeof mergeAnalytics>, questionId: string) =>
  analytics.questions.find((q) => q.questionId === questionId)!;

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

  test("boolean splits, number summaries, multiple-choice option counts, and only answered and skipped for text", () => {
    const analytics = counts({
      versions: [version(1, 4, [ready, score(1, 5), toppings, comment])],
      answered: [
        { versionId: "version-1", questionId: readyId, count: 4 },
        { versionId: "version-1", questionId: scoreId, count: 3 },
        { versionId: "version-1", questionId: toppingsId, count: 2 },
        { versionId: "version-1", questionId: commentId, count: 1 },
      ],
      choices: [
        { versionId: "version-1", questionId: readyId, value: "true", count: 3 },
        { versionId: "version-1", questionId: readyId, value: "false", count: 1 },
        { versionId: "version-1", questionId: toppingsId, value: "cheese", count: 2 },
        { versionId: "version-1", questionId: toppingsId, value: "olives", count: 1 },
      ],
      numbers: [
        {
          versionId: "version-1",
          questionId: scoreId,
          count: 3,
          min: 1,
          max: 5,
          mean: 3,
          median: 3,
        },
      ],
      combinedNumbers: [{ questionId: scoreId, count: 3, min: 1, max: 5, mean: 3, median: 3 }],
    });

    expect(
      analytics.questions.map((q) => ({
        id: q.questionId,
        combined: q.combined,
        v1: q.byVersion[0],
      })),
    ).toEqual([
      {
        id: readyId,
        combined: {
          responses: 4,
          answered: 4,
          skipped: 0,
          absentResponses: 0,
          summary: { type: "boolean", trueCount: 3, falseCount: 1 },
        },
        v1: {
          version: 1,
          present: true,
          responses: 4,
          answered: 4,
          skipped: 0,
          summary: { type: "boolean", trueCount: 3, falseCount: 1 },
          constraints: null,
        },
      },
      {
        id: scoreId,
        combined: {
          responses: 4,
          answered: 3,
          skipped: 1,
          absentResponses: 0,
          summary: { type: "number", count: 3, min: 1, max: 5, mean: 3, median: 3 },
        },
        v1: {
          version: 1,
          present: true,
          responses: 4,
          answered: 3,
          skipped: 1,
          summary: { type: "number", count: 3, min: 1, max: 5, mean: 3, median: 3 },
          constraints: { type: "number", integer: true, min: 1, max: 5 },
        },
      },
      {
        id: toppingsId,
        combined: {
          responses: 4,
          answered: 2,
          skipped: 2,
          absentResponses: 0,
          summary: {
            type: "multiple_choice",
            options: [
              {
                value: "cheese",
                label: "Cheese",
                otherLabels: [],
                count: 2,
                base: 2,
                offeredIn: [1],
              },
              {
                value: "olives",
                label: "Olives",
                otherLabels: [],
                count: 1,
                base: 2,
                offeredIn: [1],
              },
            ],
          },
        },
        v1: {
          version: 1,
          present: true,
          responses: 4,
          answered: 2,
          skipped: 2,
          summary: {
            type: "multiple_choice",
            options: [
              {
                value: "cheese",
                label: "Cheese",
                otherLabels: [],
                count: 2,
                base: 2,
                offeredIn: [1],
              },
              {
                value: "olives",
                label: "Olives",
                otherLabels: [],
                count: 1,
                base: 2,
                offeredIn: [1],
              },
            ],
          },
          constraints: { type: "multiple_choice", minSelected: null, maxSelected: 2 },
        },
      },
      {
        id: commentId,
        combined: {
          responses: 4,
          answered: 1,
          skipped: 3,
          absentResponses: 0,
          summary: { type: "text" },
        },
        v1: {
          version: 1,
          present: true,
          responses: 4,
          answered: 1,
          skipped: 3,
          summary: { type: "text" },
          constraints: null,
        },
      },
    ]);
  });
});

describe("across versions", () => {
  test("a never-published form is empty", () => {
    expect(counts({ versions: [] })).toEqual({
      formId: "form",
      totalResponses: 0,
      versions: [],
      questions: [],
    });
  });

  test("a dropped question is absent from the later version, not skipped there", () => {
    const analytics = counts({
      versions: [
        version(1, 3, [colour([["red", "Red"]]), comment]),
        version(2, 2, [colour([["red", "Red"]])]),
      ],
      answered: [{ versionId: "version-1", questionId: commentId, count: 1 }],
    });

    expect(analytics.totalResponses).toBe(5);
    expect(analytics.questions.map((q) => q.questionId)).toEqual([colourId, commentId]);
    expect(question(analytics, commentId)).toEqual({
      questionId: commentId,
      type: "text",
      label: "Comment",
      otherLabels: [],
      inCurrentVersion: false,
      combined: {
        responses: 3,
        answered: 1,
        skipped: 2,
        absentResponses: 2,
        summary: { type: "text" },
      },
      byVersion: [
        {
          version: 1,
          present: true,
          responses: 3,
          answered: 1,
          skipped: 2,
          summary: { type: "text" },
          constraints: null,
        },
        { version: 2, present: false },
      ],
    });
  });

  test("a version with no responses still has its questions present, with zero counts", () => {
    const analytics = counts({
      versions: [version(1, 2, [ready, score(1, 5)]), version(2, 0, [ready, score(1, 5)])],
      answered: [
        { versionId: "version-1", questionId: readyId, count: 2 },
        { versionId: "version-1", questionId: scoreId, count: 2 },
      ],
      choices: [{ versionId: "version-1", questionId: readyId, value: "true", count: 2 }],
      numbers: [
        {
          versionId: "version-1",
          questionId: scoreId,
          count: 2,
          min: 2,
          max: 4,
          mean: 3,
          median: 3,
        },
      ],
      combinedNumbers: [{ questionId: scoreId, count: 2, min: 2, max: 4, mean: 3, median: 3 }],
    });

    expect(question(analytics, readyId).byVersion[1]).toEqual({
      version: 2,
      present: true,
      responses: 0,
      answered: 0,
      skipped: 0,
      summary: { type: "boolean", trueCount: 0, falseCount: 0 },
      constraints: null,
    });
    expect(question(analytics, scoreId).byVersion[1]).toEqual({
      version: 2,
      present: true,
      responses: 0,
      answered: 0,
      skipped: 0,
      summary: { type: "number", count: 0, min: null, max: null, mean: null, median: null },
      constraints: { type: "number", integer: true, min: 1, max: 5 },
    });
  });

  test("an added option's share counts only the versions that offered it", () => {
    const analytics = counts({
      versions: [
        version(1, 4, [
          colour([
            ["red", "Red"],
            ["green", "Green"],
          ]),
        ]),
        version(2, 6, [
          colour([
            ["red", "Red"],
            ["green", "Green"],
            ["blue", "Blue"],
          ]),
        ]),
      ],
      answered: [
        { versionId: "version-1", questionId: colourId, count: 4 },
        { versionId: "version-2", questionId: colourId, count: 5 },
      ],
      choices: [
        { versionId: "version-1", questionId: colourId, value: "red", count: 3 },
        { versionId: "version-1", questionId: colourId, value: "green", count: 1 },
        { versionId: "version-2", questionId: colourId, value: "red", count: 2 },
        { versionId: "version-2", questionId: colourId, value: "green", count: 1 },
        { versionId: "version-2", questionId: colourId, value: "blue", count: 2 },
      ],
    });

    const colourAnalytics = question(analytics, colourId);
    expect(colourAnalytics.combined).toEqual({
      responses: 10,
      answered: 9,
      skipped: 1,
      absentResponses: 0,
      summary: {
        type: "single_choice",
        options: [
          { value: "red", label: "Red", otherLabels: [], count: 5, base: 9, offeredIn: [1, 2] },
          { value: "green", label: "Green", otherLabels: [], count: 2, base: 9, offeredIn: [1, 2] },
          { value: "blue", label: "Blue", otherLabels: [], count: 2, base: 5, offeredIn: [2] },
        ],
      },
    });
    expect(colourAnalytics.byVersion[0]).toMatchObject({
      summary: {
        type: "single_choice",
        options: [
          { value: "red", label: "Red", otherLabels: [], count: 3, base: 4, offeredIn: [1] },
          { value: "green", label: "Green", otherLabels: [], count: 1, base: 4, offeredIn: [1] },
        ],
      },
    });
  });

  test("a relabelled option and question combine by value and identity, showing the latest label and the others", () => {
    const analytics = counts({
      versions: [
        version(1, 2, [
          colour([
            ["red", "Red"],
            ["green", "Green"],
            ["purple", "Purple"],
          ]),
        ]),
        version(2, 2, [
          colour(
            [
              ["red", "Red"],
              ["green", "Lime"],
            ],
            "Favourite colour",
          ),
        ]),
      ],
      answered: [
        { versionId: "version-1", questionId: colourId, count: 2 },
        { versionId: "version-2", questionId: colourId, count: 2 },
      ],
      choices: [
        { versionId: "version-1", questionId: colourId, value: "green", count: 1 },
        { versionId: "version-1", questionId: colourId, value: "purple", count: 1 },
        { versionId: "version-2", questionId: colourId, value: "green", count: 2 },
      ],
    });

    const colourAnalytics = question(analytics, colourId);
    expect(colourAnalytics.label).toBe("Favourite colour");
    expect(colourAnalytics.otherLabels).toEqual([{ label: "Colour", versions: [1] }]);
    expect(colourAnalytics.combined.summary).toEqual({
      type: "single_choice",
      options: [
        { value: "red", label: "Red", otherLabels: [], count: 0, base: 4, offeredIn: [1, 2] },
        {
          value: "green",
          label: "Lime",
          otherLabels: [{ label: "Green", versions: [1] }],
          count: 3,
          base: 4,
          offeredIn: [1, 2],
        },
        { value: "purple", label: "Purple", otherLabels: [], count: 1, base: 2, offeredIn: [1] },
      ],
    });
    expect(colourAnalytics.byVersion[0]).toMatchObject({
      summary: { options: [{ label: "Red" }, { label: "Green" }, { label: "Purple" }] },
    });
  });

  test("a changed number range still combines, with each version's constraints beside its figures", () => {
    const analytics = counts({
      versions: [version(1, 2, [score(1, 5)]), version(2, 2, [score(1, 10)])],
      answered: [
        { versionId: "version-1", questionId: scoreId, count: 2 },
        { versionId: "version-2", questionId: scoreId, count: 2 },
      ],
      numbers: [
        {
          versionId: "version-1",
          questionId: scoreId,
          count: 2,
          min: 1,
          max: 5,
          mean: 3,
          median: 3,
        },
        {
          versionId: "version-2",
          questionId: scoreId,
          count: 2,
          min: 4,
          max: 10,
          mean: 7,
          median: 7,
        },
      ],
      combinedNumbers: [{ questionId: scoreId, count: 4, min: 1, max: 10, mean: 5, median: 4.5 }],
    });

    expect(analytics.questions).toHaveLength(1);
    const scoreAnalytics = question(analytics, scoreId);
    expect(scoreAnalytics.combined.summary).toEqual({
      type: "number",
      count: 4,
      min: 1,
      max: 10,
      mean: 5,
      median: 4.5,
    });
    expect(scoreAnalytics.byVersion).toMatchObject([
      {
        summary: { type: "number", count: 2, min: 1, max: 5, mean: 3, median: 3 },
        constraints: { type: "number", integer: true, min: 1, max: 5 },
      },
      {
        summary: { type: "number", count: 2, min: 4, max: 10, mean: 7, median: 7 },
        constraints: { type: "number", integer: true, min: 1, max: 10 },
      },
    ]);
  });

  test("a reidentified question is a separate question, never combined with the old identity", () => {
    const newScoreId = "0192f5a0-7c3e-7b1a-9d2e-0000000000c6";
    const analytics = counts({
      versions: [version(1, 3, [score(1, 5)]), version(2, 2, [score(1, 5, newScoreId)])],
      answered: [
        { versionId: "version-1", questionId: scoreId, count: 3 },
        { versionId: "version-2", questionId: newScoreId, count: 2 },
      ],
      numbers: [
        {
          versionId: "version-1",
          questionId: scoreId,
          count: 3,
          min: 1,
          max: 3,
          mean: 2,
          median: 2,
        },
        {
          versionId: "version-2",
          questionId: newScoreId,
          count: 2,
          min: 5,
          max: 5,
          mean: 5,
          median: 5,
        },
      ],
      combinedNumbers: [
        { questionId: scoreId, count: 3, min: 1, max: 3, mean: 2, median: 2 },
        { questionId: newScoreId, count: 2, min: 5, max: 5, mean: 5, median: 5 },
      ],
    });

    expect(
      analytics.questions.map((q) => ({
        id: q.questionId,
        label: q.label,
        inCurrentVersion: q.inCurrentVersion,
        combined: q.combined,
        present: q.byVersion.map((v) => v.present),
      })),
    ).toEqual([
      {
        id: newScoreId,
        label: "Score",
        inCurrentVersion: true,
        combined: {
          responses: 2,
          answered: 2,
          skipped: 0,
          absentResponses: 3,
          summary: { type: "number", count: 2, min: 5, max: 5, mean: 5, median: 5 },
        },
        present: [false, true],
      },
      {
        id: scoreId,
        label: "Score",
        inCurrentVersion: false,
        combined: {
          responses: 3,
          answered: 3,
          skipped: 0,
          absentResponses: 2,
          summary: { type: "number", count: 3, min: 1, max: 3, mean: 2, median: 2 },
        },
        present: [true, false],
      },
    ]);
  });

  test("questions come in the current version's order, then dropped ones, most recently dropped first", () => {
    const analytics = counts({
      versions: [
        version(1, 0, [comment, ready, colour([["red", "Red"]])]),
        version(2, 0, [ready, score(1, 5), colour([["red", "Red"]])]),
        version(3, 0, [colour([["red", "Red"]])]),
      ],
    });

    expect(analytics.questions.map((q) => q.questionId)).toEqual([
      colourId,
      readyId,
      scoreId,
      commentId,
    ]);
  });
});
