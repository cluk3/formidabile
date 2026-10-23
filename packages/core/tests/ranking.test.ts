import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers } from "@fb/core/answers";
import {
  conditionIssues,
  conditionOperators,
  parseDefinition,
  questionsOf,
  validateForPublish,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";
import { addOption, addQuestion, changeQuestionType, removeOption, type IdSource } from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const rankId = uuid(1);
const followId = uuid(2);
const pageId = uuid(10);

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
];

const labelled = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    value: `o${index}`,
    label: `Option ${index}`,
  }));

const rankingQuestion = (config: object, extra: object = {}) => ({
  id: rankId,
  type: "ranking",
  label: "Priorities",
  required: false,
  config,
  ...extra,
});

const form = (question: object) => ({
  format: 1 as const,
  title: "Feedback",
  questions: [question],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const structureIssues = (question: object) =>
  issuePaths(parseDefinition(form(question))).map((path) => path.slice(2));

const publishIssues = (question: object) =>
  issuePaths(validateForPublish(form(question), [])).map((path) => path.slice(2));

const parsed = (input: unknown): FormDefinition => {
  const result = parseDefinition(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const ids: IdSource = {
  questionId: () => uuid(30),
  optionValue: (() => {
    let n = 0;
    return () => `minted-${++n}`;
  })(),
  pageId: () => uuid(40),
};

describe("ranking", () => {
  test("structure: options use the choice option model, and more than 100 do not parse", () => {
    expect(structureIssues(rankingQuestion({ options }))).toEqual([]);
    expect(structureIssues(rankingQuestion({ options: labelled(21) }))).toEqual([]);
    expect(structureIssues(rankingQuestion({ options: labelled(101) }))).toEqual([
      ["config", "options"],
    ]);
    expect(
      structureIssues(
        rankingQuestion({
          options: [
            { value: "a", label: "Alpha" },
            { value: "a", label: "Again" },
          ],
        }),
      ),
    ).toEqual([["config", "options", 1, "value"]]);
    expect(structureIssues(rankingQuestion({ options, display: "drag" }))).toEqual([["config"]]);
  });

  test("publish: needs a label and 2 to 20 options with labels of their own", () => {
    expect(publishIssues(rankingQuestion({ options: options.slice(0, 2) }))).toEqual([]);
    expect(publishIssues(rankingQuestion({ options: labelled(20) }))).toEqual([]);
    expect(publishIssues(rankingQuestion({ options: labelled(1) }))).toEqual([
      ["config", "options"],
    ]);
    expect(publishIssues(rankingQuestion({ options: labelled(21) }))).toEqual([
      ["config", "options"],
    ]);
    expect(publishIssues(rankingQuestion({ options }, { label: "" }))).toEqual([["label"]]);
    expect(
      publishIssues(
        rankingQuestion({
          options: [
            { value: "a", label: "" },
            { value: "b", label: "Beta" },
            { value: "c", label: "Beta" },
          ],
        }),
      ),
    ).toEqual([
      ["config", "options", 0, "label"],
      ["config", "options", 2, "label"],
    ]);
  });

  test("a new ranking starts with the two blank options publish needs, and stops at 20", () => {
    const added = addQuestion(
      { format: 1, title: "Feedback", questions: [] },
      "ranking",
      ids,
    );
    expect(questionsOf(added)[0]).toMatchObject({
      type: "ranking",
      config: {
        options: [
          { value: "minted-1", label: "" },
          { value: "minted-2", label: "" },
        ],
      },
    });
    const carried = changeQuestionType(
      parsed(form(rankingQuestion({ options }))),
      rankId,
      "single_choice",
      ids,
    );
    expect(questionsOf(carried)[0]).toMatchObject({
      type: "single_choice",
      config: { options },
    });

    let full = parsed(form(rankingQuestion({ options: labelled(20) })));
    expect(() => addOption(full, rankId, ids)).toThrow("A ranking has at most 20 options");
    full = parsed(form(rankingQuestion({ options: labelled(19) })));
    expect(questionsOf(addOption(full, rankId, ids))[0]?.config).toMatchObject({
      options: expect.objectContaining({ length: 20 }),
    });
  });

  test("the answer is every option value once, in the order given, or absent", () => {
    const optional = parsed(form(rankingQuestion({ options })));
    const required = parsed(form(rankingQuestion({ options }, { required: true })));
    const permutation = ["b", "c", "a"];

    expect(validateAnswers(optional, { [rankId]: permutation }).ok).toBe(true);
    expect(validateAnswers(optional, {}).ok).toBe(true);
    expect(validateAnswers(required, {}).ok).toBe(false);
    expect(validateAnswers(optional, { [rankId]: ["a", "b"] }).ok).toBe(false);
    expect(validateAnswers(optional, { [rankId]: ["a", "b", "a"] }).ok).toBe(false);
    expect(validateAnswers(optional, { [rankId]: ["a", "b", "c", "a"] }).ok).toBe(false);
    expect(validateAnswers(optional, { [rankId]: ["c", "b", "z"] }).ok).toBe(false);
    expect(validateAnswers(optional, { [rankId]: [] }).ok).toBe(false);

    const shown = questionsOf(optional).map((question) => question.id);
    expect(interpretAnswers(optional, { [rankId]: permutation }, shown)[0]?.answer).toEqual({
      value: permutation,
      display: "Beta, Gamma, Alpha",
    });
    expect(interpretAnswers(optional, {}, shown)[0]).toMatchObject({ status: "skipped" });
  });
});

describe("ranking conditions", () => {
  const text = (showCondition?: object) => ({
    id: followId,
    type: "text" as const,
    label: "Why",
    required: false,
    config: { display: "single_line" as const },
    ...(showCondition === undefined ? {} : { showCondition }),
  });

  const definition = (operator: string, constant?: object) =>
    parsed({
      format: 2,
      title: "Feedback",
      pages: [
        {
          id: pageId,
          jumps: [],
          questions: [
            rankingQuestion({ options }),
            text(
              constant === undefined
                ? { questionId: rankId, operator }
                : { questionId: rankId, operator, constant },
            ),
          ],
        },
      ],
    });

  const shown = (definition: FormDefinition, ranking?: string[]) =>
    pathOf(definition, ranking === undefined ? {} : { [rankId]: ranking }).questions.map(
      (question) => question.id,
    );

  test("registers ranks in the top N, its complement, and the answered pair", () => {
    expect(conditionOperators.ranking.map((operator) => operator.id)).toEqual([
      "ranks_in_top",
      "does_not_rank_in_top",
      "is_answered",
      "is_not_answered",
    ]);
    expect(conditionOperators.ranking[0]?.constant).toBe("rank");
    expect(conditionOperators.ranking[1]?.constant).toBe("rank");
  });

  test("top N counts places from 1, and an unanswered ranking satisfies neither comparison", () => {
    const top = definition("ranks_in_top", { value: "a", n: 1 });
    const outside = definition("does_not_rank_in_top", { value: "a", n: 1 });
    const topTwo = definition("ranks_in_top", { value: "a", n: 2 });

    expect(shown(top, ["a", "b", "c"])).toEqual([rankId, followId]);
    expect(shown(top, ["b", "a", "c"])).toEqual([rankId]);
    expect(shown(topTwo, ["b", "a", "c"])).toEqual([rankId, followId]);
    expect(shown(outside, ["b", "a", "c"])).toEqual([rankId, followId]);
    expect(shown(outside, ["a", "b", "c"])).toEqual([rankId]);
    expect(shown(top)).toEqual([rankId]);
    expect(shown(outside)).toEqual([rankId]);
    expect(shown(definition("is_answered"), ["c", "b", "a"])).toEqual([rankId, followId]);
    expect(shown(definition("is_answered"))).toEqual([rankId]);
    expect(shown(definition("is_not_answered"))).toEqual([rankId, followId]);
    expect(shown(definition("is_not_answered"), ["a", "b", "c"])).toEqual([rankId]);
  });

  const page = (showCondition: object) => ({
    format: 2 as const,
    title: "Feedback",
    pages: [
      {
        id: pageId,
        jumps: [],
        questions: [rankingQuestion({ options }), text(showCondition)],
      },
    ],
  });

  test("the constant is an option value and N from 1 to 20", () => {
    expect(definition("ranks_in_top", { value: "a", n: 20 }).format).toBe(2);
    expect(parseDefinition(page({ questionId: rankId, operator: "ranks_in_top", constant: { value: "a", n: 0 } })).ok).toBe(
      false,
    );
    expect(parseDefinition(page({ questionId: rankId, operator: "ranks_in_top", constant: { value: "a", n: 21 } })).ok).toBe(
      false,
    );
    expect(parseDefinition(page({ questionId: rankId, operator: "ranks_in_top", constant: { value: "a" } })).ok).toBe(
      false,
    );

    const needsOne = definition("ranks_in_top");
    const wrong = parsed(
      page({ questionId: rankId, operator: "ranks_in_top", constant: "a" }),
    );
    expect(conditionIssues(needsOne).map((issue) => issue.message)).toEqual([
      "This operator needs a constant",
    ]);
    expect(conditionIssues(wrong).map((issue) => issue.message)).toEqual([
      "This constant does not fit this operator",
    ]);
  });

  test("removing an option a condition names leaves the condition, and publish refuses it", () => {
    const start = definition("does_not_rank_in_top", { value: "a", n: 1 });
    expect(shown(start, ["b", "a", "c"])).toEqual([rankId, followId]);
    const removed = removeOption(start, rankId, "a");
    const follower = questionsOf(removed)[1];
    expect(follower?.showCondition).toEqual({
      questionId: rankId,
      operator: "does_not_rank_in_top",
      constant: { value: "a", n: 1 },
    });
    expect(conditionIssues(removed)).toEqual([
      {
        path: ["pages", 0, "questions", 1, "showCondition", "constant", "value"],
        message: "This condition names an option value the question does not have",
      },
    ]);
    expect(validateForPublish(removed, []).ok).toBe(false);
    // The named option is gone, so the comparison reads as unanswered and the complement does not hold.
    expect(shown(removed, ["b", "a", "c"])).toEqual([rankId]);
  });
});
