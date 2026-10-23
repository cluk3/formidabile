import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers, type Answers } from "@fb/core/answers";
import {
  conditionIssues,
  conditionOperators,
  parseDefinition,
  questionsOf,
  validateForPublish,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";
import { addQuestion } from "@fb/core/editing";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";

const withQuestion = (question: object) => ({
  format: 1 as const,
  title: "Feedback",
  questions: [{ id, label: "Arrival", required: true, ...question }],
});

const issuePaths = (result: Result<unknown>) =>
  result.ok ? [] : result.issues.map((issue) => issue.path);

const structureIssues = (question: object) =>
  issuePaths(parseDefinition(withQuestion(question))).map((path) => path.slice(2));

const publishIssues = (question: object) =>
  issuePaths(validateForPublish(withQuestion(question), [])).map((path) => path.slice(2));

const dateTime = {
  type: "date_time",
  config: { min: "2026-05-01T09:00", max: "2026-05-31T18:00" },
};

const form = (questions: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const arrival = (config: object = {}, extra: object = {}) => ({
  id,
  type: "date_time",
  label: "Arrival",
  required: true,
  config,
  ...extra,
});

const accepts = (definition: FormDefinition, value: unknown) =>
  validateAnswers(definition, { [id]: value }).ok;

describe("date and time", () => {
  test("structure: optional local date-and-time bounds, with no zone and no seconds", () => {
    expect(structureIssues(dateTime)).toEqual([]);
    expect(structureIssues({ ...dateTime, config: {} })).toEqual([]);
    expect(structureIssues({ ...dateTime, config: { min: "2026-05-01" } })).toEqual([
      ["config", "min"],
    ]);
    expect(structureIssues({ ...dateTime, config: { min: "2026-05-01T09:00:00" } })).toEqual([
      ["config", "min"],
    ]);
    expect(structureIssues({ ...dateTime, config: { max: "2026-05-01T09:00Z" } })).toEqual([
      ["config", "max"],
    ]);
    expect(structureIssues({ ...dateTime, config: { earliest: "2026-05-01T09:00" } })).toEqual([
      ["config"],
    ]);
  });

  test("publish: needs a label, and rejects an earliest bound after the latest", () => {
    expect(publishIssues(dateTime)).toEqual([]);
    expect(publishIssues({ ...dateTime, label: "  " })).toEqual([["label"]]);
    expect(
      publishIssues({ ...dateTime, config: { min: "2026-05-01T09:00", max: "2026-05-01T09:00" } }),
    ).toEqual([]);
    expect(
      publishIssues({ ...dateTime, config: { min: "2026-05-01T09:01", max: "2026-05-01T09:00" } }),
    ).toEqual([["config", "max"]]);
    const rejected = validateForPublish(
      withQuestion({
        ...dateTime,
        config: { min: "2026-05-02T00:00", max: "2026-05-01T23:59" },
      }),
      [],
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok)
      expect(rejected.issues.map((issue) => issue.message)).toContain(
        "The minimum is greater than the maximum",
      );
  });

  test("a new question starts with no bounds", () => {
    const blank = parseDefinition({ format: 1, title: "Feedback", questions: [] });
    if (!blank.ok) throw new Error(JSON.stringify(blank.issues));
    const added = addQuestion(blank.value, "date_time", {
      questionId: () => id,
      optionValue: () => "x",
      pageId: () => other,
    });
    expect(added).toMatchObject({
      questions: [{ id, type: "date_time", label: "", required: false, config: {} }],
    });
  });

  test("an answer is a real local YYYY-MM-DDTHH:MM and nothing else", () => {
    const open = form([arrival()]);
    expect(validateAnswers(open, {}).ok).toBe(false);
    expect(accepts(open, "2026-05-04T15:30")).toBe(true);
    expect(accepts(open, "2024-02-29T23:59")).toBe(true);
    expect(accepts(open, "2000-02-29T00:00")).toBe(true);
    expect(accepts(open, "2026-01-01T00:00")).toBe(true);
    expect(accepts(open, "2026-02-29T10:00")).toBe(false);
    expect(accepts(open, "1900-02-29T00:00")).toBe(false);
    expect(accepts(open, "2026-04-31T00:00")).toBe(false);
    expect(accepts(open, "2026-01-01T24:00")).toBe(false);
    expect(accepts(open, "2026-01-01T10:60")).toBe(false);
    expect(accepts(open, "2026-01-01T10:00:00")).toBe(false);
    expect(accepts(open, "2026-01-01T10:00Z")).toBe(false);
    expect(accepts(open, "2026-01-01T10:00+01:00")).toBe(false);
    expect(accepts(open, "2026-01-01 10:00")).toBe(false);
    expect(accepts(open, "2026-1-1T10:00")).toBe(false);
    expect(accepts(open, "2026-01-01t10:00")).toBe(false);
    expect(accepts(open, " 2026-01-01T10:00")).toBe(false);

    const optional = form([arrival({}, { required: false })]);
    expect(validateAnswers(optional, {}).ok).toBe(true);
  });

  test("an answer outside the optional bounds is rejected", () => {
    const bounded = form([
      arrival({ min: "2026-05-01T09:00", max: "2026-05-31T18:00" }, { required: false }),
    ]);
    expect(accepts(bounded, "2026-05-01T09:00")).toBe(true);
    expect(accepts(bounded, "2026-05-31T18:00")).toBe(true);
    expect(accepts(bounded, "2026-05-04T15:30")).toBe(true);
    expect(accepts(bounded, "2026-05-01T08:59")).toBe(false);
    expect(accepts(bounded, "2026-05-31T18:01")).toBe(false);
    expect(accepts(bounded, "2026-04-30T23:59")).toBe(false);
  });

  test("display is the wall-clock value, unchanged", () => {
    const definition = form([arrival({}, { required: false })]);
    const value = "2026-05-04T15:30";
    expect(interpretAnswers(definition, { [id]: value }, [id])).toEqual([
      {
        question: questionsOf(definition)[0],
        status: "answered",
        answer: { value, display: value },
      },
    ]);
    expect(interpretAnswers(definition, {}, [id])[0]?.status).toBe("skipped");
    expect(interpretAnswers(definition, {}, [])[0]?.status).toBe("not_shown");
  });

  test("conditions offer is at, is before, is after, is answered, and is not answered", () => {
    expect(conditionOperators.date_time.map((operator) => operator.id)).toEqual([
      "is_at",
      "is_before",
      "is_after",
      "is_answered",
      "is_not_answered",
    ]);
    expect(conditionOperators.date_time.find((operator) => operator.id === "is_at")?.constant).toBe(
      "date_time",
    );

    const shown = (operator: string, constant: string | undefined, value: string | undefined) => {
      const definition = form([
        { id, type: "date_time", label: "When", required: false, config: {} },
        {
          id: other,
          type: "date_time",
          label: "Next",
          required: false,
          config: {},
          showCondition: {
            questionId: id,
            operator,
            ...(constant === undefined ? {} : { constant }),
          },
        },
      ]);
      const answers: Answers = value === undefined ? {} : { [id]: value };
      return pathOf(definition, answers).questions.map((item) => item.id);
    };

    expect(shown("is_at", "2026-05-04T15:30", "2026-05-04T15:30")).toEqual([id, other]);
    expect(shown("is_at", "2026-05-04T15:30", "2026-05-04T15:31")).toEqual([id]);
    expect(shown("is_before", "2026-05-04T15:30", "2026-05-04T15:29")).toEqual([id, other]);
    expect(shown("is_before", "2026-05-04T15:30", "2026-05-04T15:30")).toEqual([id]);
    expect(shown("is_before", "2026-01-02T00:00", "2026-01-01T23:59")).toEqual([id, other]);
    expect(shown("is_after", "2026-05-04T15:30", "2026-05-04T15:31")).toEqual([id, other]);
    expect(shown("is_after", "2026-05-04T15:30", "2026-05-04T15:30")).toEqual([id]);
    expect(shown("is_after", "2026-01-01T23:59", "2026-01-02T00:00")).toEqual([id, other]);
    expect(shown("is_at", "2026-05-04T15:30", undefined)).toEqual([id]);
    expect(shown("is_before", "2026-05-04T15:30", undefined)).toEqual([id]);
    expect(shown("is_answered", undefined, undefined)).toEqual([id]);
    expect(shown("is_answered", undefined, "2026-05-04T15:30")).toEqual([id, other]);
    expect(shown("is_not_answered", undefined, undefined)).toEqual([id, other]);
    expect(shown("is_not_answered", undefined, "2026-05-04T15:30")).toEqual([id]);
  });

  test("publish rejects a constant that is not a local date and time", () => {
    const definition = (constant: unknown) =>
      form([
        { id, type: "date_time", label: "When", required: false, config: {} },
        {
          id: other,
          type: "date_time",
          label: "Next",
          required: false,
          config: {},
          showCondition: { questionId: id, operator: "is_at", constant },
        },
      ]);

    const unfit = {
      path: ["questions", 1, "showCondition", "constant"],
      message: "This constant does not fit this operator",
    };
    expect(conditionIssues(definition("2026-05-04"))).toEqual([unfit]);
    expect(conditionIssues(definition("2026-05-04T15:30:00"))).toEqual([unfit]);
    expect(conditionIssues(definition("2026-05-04T15:30Z"))).toEqual([unfit]);
    expect(conditionIssues(definition("2026-05-04T15:30"))).toEqual([]);

    const wrongOperator = form([
      { id, type: "date_time", label: "When", required: false, config: {} },
      {
        id: other,
        type: "date_time",
        label: "Next",
        required: false,
        config: {},
        showCondition: { questionId: id, operator: "is_on", constant: "2026-05-04T15:30" },
      },
    ]);
    expect(conditionIssues(wrongOperator)).toEqual([
      {
        path: ["questions", 1, "showCondition", "operator"],
        message: "This operator does not fit this question",
      },
    ]);
  });
});
