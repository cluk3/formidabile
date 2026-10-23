import { describe, expect, test } from "vite-plus/test";
import {
  AnyAnswers,
  interpretAnswers,
  pathOf,
  validateAnswers,
  type Answers,
} from "@fb/core/answers";
import {
  conditionOperators,
  parseDefinition,
  questionTypes,
  validateForPublish,
  type Condition,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";

const id = "00000000-0000-4000-8000-000000000001";
const later = "00000000-0000-4000-8000-000000000002";
const pageA = "00000000-0000-4000-8000-000000000101";
const pageB = "00000000-0000-4000-8000-000000000102";

const question = (extra: object = {}) => ({
  id,
  type: "date_range",
  label: "Stay",
  required: true,
  config: {},
  ...extra,
});

const withQuestion = (extra: object = {}) => ({
  format: 1 as const,
  title: "Feedback",
  questions: [question(extra)],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const structureIssues = (extra: object = {}) =>
  issuePaths(parseDefinition(withQuestion(extra))).map((path) => path.slice(2));

const publishIssues = (extra: object = {}) =>
  issuePaths(validateForPublish(withQuestion(extra), [])).map((path) => path.slice(2));

const published = (extra: object = {}) => {
  const result = validateForPublish(withQuestion(extra), []);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const messages = (definition: FormDefinition, input: unknown) => {
  const result = validateAnswers(definition, input);
  return result.ok ? [] : result.issues.map((issue) => issue.message);
};

describe("date range", () => {
  test("structure: an object answer with optional calendar-date bounds, not a list", () => {
    expect(structureIssues()).toEqual([]);
    expect(structureIssues({ config: { min: "2026-01-01", max: "2026-12-31" } })).toEqual([]);
    expect(structureIssues({ config: { min: "2026-01-01T00:00:00Z" } })).toEqual([
      ["config", "min"],
    ]);
    expect(structureIssues({ config: { earliest: "2026-01-01" } })).toEqual([["config"]]);
  });

  test("publish: needs a label, and the earliest bound is no later than the latest", () => {
    expect(publishIssues()).toEqual([]);
    expect(publishIssues({ label: "  " })).toEqual([["label"]]);
    expect(publishIssues({ config: { min: "2026-05-01", max: "2026-05-01" } })).toEqual([]);
    expect(publishIssues({ config: { min: "2026-05-02", max: "2026-05-01" } })).toEqual([
      ["config", "max"],
    ]);
  });

  test("answers are both dates or neither, with start on or before end, inside the bounds", () => {
    const open = published();
    const bounded = published({
      config: { min: "2026-05-01", max: "2026-05-31" },
      required: false,
    });
    const stay = { start: "2026-05-01", end: "2026-05-03" };

    expect(validateAnswers(open, { [id]: stay }).ok).toBe(true);
    expect(validateAnswers(open, { [id]: { start: "2026-05-04", end: "2026-05-04" } }).ok).toBe(
      true,
    );
    expect(validateAnswers(bounded, {}).ok).toBe(true);
    expect(validateAnswers(bounded, { [id]: { start: "2026-05-01", end: "2026-05-31" } }).ok).toBe(
      true,
    );

    expect(validateAnswers(open, { [id]: ["2026-05-01", "2026-05-03"] }).ok).toBe(false);
    expect(validateAnswers(open, { [id]: { start: "2026-05-01" } }).ok).toBe(false);
    expect(validateAnswers(open, { [id]: { end: "2026-05-03" } }).ok).toBe(false);
    expect(validateAnswers(open, { [id]: {} }).ok).toBe(false);
    expect(validateAnswers(open, { [id]: { start: "2026-05-03", end: "2026-05-01" } }).ok).toBe(
      false,
    );
    expect(messages(open, { [id]: { start: "2026-05-03", end: "2026-05-01" } })).toEqual([
      "The start must be on or before the end",
    ]);
    expect(validateAnswers(open, { [id]: { start: "2026-02-31", end: "2026-03-01" } }).ok).toBe(
      false,
    );
    expect(validateAnswers(bounded, { [id]: { start: "2026-04-30", end: "2026-05-02" } }).ok).toBe(
      false,
    );
    expect(validateAnswers(bounded, { [id]: { start: "2026-05-02", end: "2026-06-01" } }).ok).toBe(
      false,
    );
    expect(
      validateAnswers(open, {
        [id]: { start: "2026-05-01", end: "2026-05-03", nights: "2" },
      }).ok,
    ).toBe(false);
    expect(validateAnswers(open, {}).ok).toBe(false);
  });

  test("an object whose values are strings or lists of strings is one answer arm", () => {
    const row = "00000000-0000-4000-8000-000000000099";
    expect(AnyAnswers.safeParse({ [id]: { start: "2026-05-01", end: "2026-05-03" } }).success).toBe(
      true,
    );
    expect(AnyAnswers.safeParse({ [row]: { city: "Pisa", line: ["a", "b"] } }).success).toBe(true);
    expect(AnyAnswers.safeParse({ [id]: ["2026-05-01", "2026-05-03"] }).success).toBe(true);
    expect(AnyAnswers.safeParse({ [row]: { city: 1 } }).success).toBe(false);
    expect(AnyAnswers.safeParse({ [row]: { line: [{ city: "Pisa" }] } }).success).toBe(false);
  });

  test("display reads the start and the end", () => {
    const definition = published({ required: false });
    if (definition.format !== 1) throw new Error("expected format 1");
    const snapshot = definition.questions[0]!;
    if (snapshot.type !== "date_range") throw new Error("expected a date range");
    const value = { start: "2026-05-01", end: "2026-05-03" };
    expect(questionTypes.date_range.display(snapshot, value)).toBe("2026-05-01 to 2026-05-03");
    expect(interpretAnswers(definition, { [id]: value }, [id])).toMatchObject([
      { status: "answered", answer: { display: "2026-05-01 to 2026-05-03" } },
    ]);
    expect(interpretAnswers(definition, {}, [id])).toMatchObject([{ status: "skipped" }]);
  });

  test("conditions can test the start and the end, and whether it was answered", () => {
    const presence = ["is_answered", "is_not_answered"];
    expect(conditionOperators.date_range.map((operator) => operator.id)).toEqual([
      "starts_before",
      "starts_on",
      "starts_after",
      "ends_before",
      "ends_on",
      "ends_after",
      ...presence,
    ]);
    for (const operator of conditionOperators.date_range)
      expect(operator.constant).toBe(presence.includes(operator.id) ? "none" : "date");

    const leaf = (operator: string, constant?: string): Condition => ({
      questionId: id,
      operator,
      ...(constant === undefined ? {} : { constant }),
    });
    const form = (condition: Condition) => {
      const parsed = parseDefinition({
        format: 2,
        title: "Feedback",
        pages: [
          { id: pageA, questions: [question({ required: false })], jumps: [] },
          {
            id: pageB,
            questions: [
              {
                id: later,
                type: "text",
                label: "Note",
                required: false,
                config: { display: "single_line" },
                showCondition: condition,
              },
            ],
            jumps: [],
          },
        ],
      });
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
      return parsed.value;
    };
    const shown = (condition: Condition, value?: Answers[string]) =>
      pathOf(form(condition), value === undefined ? {} : { [id]: value })
        .questions.map((item) => item.id)
        .includes(later);
    const stay = { start: "2026-05-02", end: "2026-05-09" };

    expect(shown(leaf("starts_before", "2026-05-03"), stay)).toBe(true);
    expect(shown(leaf("starts_before", "2026-05-02"), stay)).toBe(false);
    expect(shown(leaf("starts_on", "2026-05-02"), stay)).toBe(true);
    expect(shown(leaf("starts_on", "2026-05-03"), stay)).toBe(false);
    expect(shown(leaf("starts_after", "2026-05-01"), stay)).toBe(true);
    expect(shown(leaf("starts_after", "2026-05-02"), stay)).toBe(false);
    expect(shown(leaf("ends_before", "2026-05-10"), stay)).toBe(true);
    expect(shown(leaf("ends_before", "2026-05-09"), stay)).toBe(false);
    expect(shown(leaf("ends_on", "2026-05-09"), stay)).toBe(true);
    expect(shown(leaf("ends_on", "2026-05-08"), stay)).toBe(false);
    expect(shown(leaf("ends_after", "2026-05-08"), stay)).toBe(true);
    expect(shown(leaf("ends_after", "2026-05-09"), stay)).toBe(false);
    expect(shown(leaf("is_answered"), stay)).toBe(true);
    expect(shown(leaf("is_answered"))).toBe(false);
    expect(shown(leaf("is_not_answered"))).toBe(true);
    expect(shown(leaf("is_not_answered"), stay)).toBe(false);
    expect(shown(leaf("starts_before", "2026-05-03"))).toBe(false);
  });

  test("publish rejects an operator or a constant that does not fit a date range", () => {
    const parsed = parseDefinition({
      format: 2,
      title: "Feedback",
      pages: [
        {
          id: pageA,
          questions: [
            question({ required: false }),
            {
              id: later,
              type: "text",
              label: "Note",
              required: false,
              config: { display: "single_line" },
              showCondition: { questionId: id, operator: "is_before", constant: "2026-05-01" },
            },
          ],
          jumps: [],
        },
      ],
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
    const unfit = validateForPublish(parsed.value, []);
    expect(unfit.ok).toBe(false);
    if (!unfit.ok)
      expect(unfit.issues.map((issue) => issue.message)).toContain(
        "This operator does not fit this question",
      );

    const badConstant = parseDefinition({
      format: 2,
      title: "Feedback",
      pages: [
        {
          id: pageA,
          questions: [
            question({ required: false }),
            {
              id: later,
              type: "text",
              label: "Note",
              required: false,
              config: { display: "single_line" },
              showCondition: { questionId: id, operator: "starts_on", constant: "May 1" },
            },
          ],
          jumps: [],
        },
      ],
    });
    if (!badConstant.ok) throw new Error(JSON.stringify(badConstant.issues));
    const constant = validateForPublish(badConstant.value, []);
    expect(constant.ok).toBe(false);
    if (!constant.ok)
      expect(constant.issues.map((issue) => issue.message)).toContain(
        "This constant does not fit this operator",
      );
  });
});
