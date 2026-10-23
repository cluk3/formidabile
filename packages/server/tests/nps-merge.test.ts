import { mergeAnalytics, type AnalyticsCounts } from "@fb/server";
import { questionsOf, type QuestionSnapshot } from "@fb/core/definition";
import { describe, expect, test } from "vite-plus/test";

type Question = QuestionSnapshot;

const recommendId = "0192f5a0-7c3e-7b1a-9d2e-0000000000d1";
const starsId = "0192f5a0-7c3e-7b1a-9d2e-0000000000d2";
const scaleId = "0192f5a0-7c3e-7b1a-9d2e-0000000000d3";
const sliderId = "0192f5a0-7c3e-7b1a-9d2e-0000000000d4";

const recommend = (display: "nps" | "scale"): Question => ({
  id: recommendId,
  type: "number",
  label: "Recommend?",
  required: true,
  config:
    display === "nps"
      ? {
          integer: true,
          min: 0,
          max: 10,
          display,
          minLabel: "Not likely",
          maxLabel: "Very likely",
        }
      : { integer: true, min: 0, max: 10, display },
});

const stars: Question = {
  id: starsId,
  type: "number",
  label: "Stars",
  required: false,
  config: { integer: true, min: 1, max: 5, display: "rating" },
};

const scale: Question = {
  id: scaleId,
  type: "number",
  label: "Effort",
  required: false,
  config: { integer: true, min: 1, max: 5, display: "scale" },
};

const slider: Question = {
  id: sliderId,
  type: "number",
  label: "Amount",
  required: false,
  config: { integer: false, min: 0, max: 10, step: 0.5, display: "slider" },
};

const publishedAt = (number: number) => new Date(Date.UTC(2026, 9, number));

const version = (number: number, responses: number, questions: ReadonlyArray<Question>) => ({
  id: `version-${number}`,
  number,
  publishedAt: publishedAt(number),
  responses,
  definition: { format: 1 as const, title: "Survey", questions: [...questions] },
});

/** A stored path that lists every question, so the NPS figures stay on answered responses. */
const shownToEveryone = (versions: AnalyticsCounts["versions"]) =>
  versions.flatMap((version) =>
    questionsOf(version.definition).map((question) => ({
      versionId: version.id,
      questionId: question.id,
      count: version.responses,
    })),
  );

const counts = (input: Partial<AnalyticsCounts> & Pick<AnalyticsCounts, "versions">) =>
  mergeAnalytics({
    formId: "form",
    answered: [],
    choices: [],
    numbers: [],
    combinedNumbers: [],
    nps: [],
    rankings: [],
    matrixCells: [],
    matrixAnsweredRows: [],
    ...input,
    shown: input.shown ?? shownToEveryone(input.versions),
  });

const summary = (analytics: ReturnType<typeof mergeAnalytics>, questionId: string) =>
  analytics.questions.find((question) => question.questionId === questionId)!;

describe("NPS score", () => {
  test("counts promoters, passives and detractors only on versions that use the NPS display", () => {
    const analytics = counts({
      versions: [version(1, 5, [recommend("nps")]), version(2, 1, [recommend("scale")])],
      answered: [
        { versionId: "version-1", questionId: recommendId, count: 5 },
        { versionId: "version-2", questionId: recommendId, count: 1 },
      ],
      numbers: [
        {
          versionId: "version-1",
          questionId: recommendId,
          count: 5,
          min: 0,
          max: 10,
          mean: 7.2,
          median: 9,
        },
        {
          versionId: "version-2",
          questionId: recommendId,
          count: 1,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
        },
      ],
      combinedNumbers: [{ questionId: recommendId, count: 6, min: 0, max: 10, mean: 6, median: 8 }],
      // The scale version's 0 would be a detractor if the display were ignored.
      nps: [
        {
          versionId: "version-1",
          questionId: recommendId,
          promoters: 3,
          passives: 1,
          detractors: 1,
        },
        {
          versionId: "version-2",
          questionId: recommendId,
          promoters: 0,
          passives: 0,
          detractors: 1,
        },
      ],
    });

    const question = summary(analytics, recommendId);
    expect(question.combined.summary).toEqual({
      type: "number",
      count: 6,
      min: 0,
      max: 10,
      mean: 6,
      median: 8,
      nps: { promoters: 3, passives: 1, detractors: 1, answered: 5, score: 40 },
    });
    expect(question.byVersion.map((entry) => entry.present && entry.summary)).toEqual([
      {
        type: "number",
        count: 5,
        min: 0,
        max: 10,
        mean: 7.2,
        median: 9,
        nps: { promoters: 3, passives: 1, detractors: 1, answered: 5, score: 40 },
      },
      { type: "number", count: 1, min: 0, max: 0, mean: 0, median: 0 },
    ]);
  });

  test("rounds the score to the nearest percentage point, and leaves it empty when nobody answered", () => {
    const analytics = counts({
      versions: [version(1, 3, [recommend("nps")]), version(2, 2, [recommend("nps")])],
      answered: [{ versionId: "version-1", questionId: recommendId, count: 3 }],
      numbers: [
        {
          versionId: "version-1",
          questionId: recommendId,
          count: 3,
          min: 9,
          max: 10,
          mean: 9.5,
          median: 9,
        },
      ],
      combinedNumbers: [
        { questionId: recommendId, count: 3, min: 9, max: 10, mean: 9.5, median: 9 },
      ],
      nps: [
        {
          versionId: "version-1",
          questionId: recommendId,
          promoters: 1,
          passives: 2,
          detractors: 0,
        },
      ],
    });

    const question = summary(analytics, recommendId);
    expect(question.byVersion[0]).toMatchObject({
      summary: { nps: { promoters: 1, passives: 2, detractors: 0, answered: 3, score: 33 } },
    });
    expect(question.byVersion[1]).toMatchObject({
      summary: { nps: { promoters: 0, passives: 0, detractors: 0, answered: 0, score: null } },
    });
    expect(question.combined.summary).toMatchObject({
      nps: { promoters: 1, passives: 2, detractors: 0, answered: 3, score: 33 },
    });
  });

  test("rating, scale and slider keep the number summary and do not get an NPS score", () => {
    const analytics = counts({
      versions: [version(1, 2, [stars, scale, slider])],
      answered: [
        { versionId: "version-1", questionId: starsId, count: 2 },
        { versionId: "version-1", questionId: scaleId, count: 2 },
        { versionId: "version-1", questionId: sliderId, count: 1 },
      ],
      numbers: [
        {
          versionId: "version-1",
          questionId: starsId,
          count: 2,
          min: 1,
          max: 5,
          mean: 3,
          median: 3,
        },
        {
          versionId: "version-1",
          questionId: scaleId,
          count: 2,
          min: 1,
          max: 5,
          mean: 3,
          median: 3,
        },
        {
          versionId: "version-1",
          questionId: sliderId,
          count: 1,
          min: 0.5,
          max: 0.5,
          mean: 0.5,
          median: 0.5,
        },
      ],
      combinedNumbers: [
        { questionId: starsId, count: 2, min: 1, max: 5, mean: 3, median: 3 },
        { questionId: scaleId, count: 2, min: 1, max: 5, mean: 3, median: 3 },
        { questionId: sliderId, count: 1, min: 0.5, max: 0.5, mean: 0.5, median: 0.5 },
      ],
      nps: [
        { versionId: "version-1", questionId: starsId, promoters: 2, passives: 0, detractors: 0 },
        { versionId: "version-1", questionId: scaleId, promoters: 0, passives: 0, detractors: 2 },
        { versionId: "version-1", questionId: sliderId, promoters: 0, passives: 1, detractors: 0 },
      ],
    });

    for (const id of [starsId, scaleId, sliderId]) {
      const question = summary(analytics, id);
      expect(question.combined.summary).not.toHaveProperty("nps");
      expect(question.combined.summary.type).toBe("number");
      const [version] = question.byVersion;
      expect(version?.present && version.summary).not.toHaveProperty("nps");
    }
    expect(summary(analytics, sliderId).combined.summary).toEqual({
      type: "number",
      count: 1,
      min: 0.5,
      max: 0.5,
      mean: 0.5,
      median: 0.5,
    });
  });
});
