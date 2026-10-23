import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers, type Answers } from "@fb/core/answers";
import {
  conditionOperators,
  parseDefinition,
  questionTypes,
  validateForPublish,
  type Condition,
  type FormDefinition,
  type QuestionTypeName,
  type Result,
} from "@fb/core/definition";

const id = "00000000-0000-4000-8000-000000000001";
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pageId = (n: number) => uuid(100 + n);

const withQuestion = (question: object) => ({
  format: 1 as const,
  title: "Feedback",
  questions: [{ id, label: "Arrival time", required: true, ...question }],
});

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

/** Issue paths from parsing one question, relative to the question. */
const structureIssues = (question: object) =>
  issuePaths(parseDefinition(withQuestion(question))).map((path) => path.slice(2));

/** Issue paths from publishing one question, relative to the question. */
const publishIssues = (question: object) =>
  issuePaths(validateForPublish(withQuestion(question), [])).map((path) => path.slice(2));

const time = {
  type: "time_of_day" as const,
  config: { earliest: "09:00", latest: "17:00" },
};

const parsedQuestion = (question: object) => {
  const parsed = parseDefinition(withQuestion(question));
  if (!parsed.ok || parsed.value.format !== 1) throw new Error(JSON.stringify(parsed));
  const snapshot = parsed.value.questions[0];
  if (snapshot === undefined || snapshot.type !== "time_of_day") throw new Error("not a time");
  return snapshot;
};

describe("time of day", () => {
  test("structure: HH:MM on a 24-hour clock, with optional earliest and latest", () => {
    expect(structureIssues(time)).toEqual([]);
    expect(structureIssues({ ...time, config: {} })).toEqual([]);
    expect(structureIssues({ ...time, config: { earliest: "00:00" } })).toEqual([]);
    expect(structureIssues({ ...time, config: { latest: "23:59" } })).toEqual([]);
    expect(structureIssues({ ...time, config: { earliest: "9:00" } })).toEqual([
      ["config", "earliest"],
    ]);
    expect(structureIssues({ ...time, config: { latest: "17:00:00" } })).toEqual([
      ["config", "latest"],
    ]);
    expect(structureIssues({ ...time, config: { earliest: "24:00" } })).toEqual([
      ["config", "earliest"],
    ]);
    expect(structureIssues({ ...time, config: { zone: "UTC" } })).toEqual([["config"]]);
  });

  test("publish: needs a label, and rejects an earliest bound after the latest", () => {
    expect(publishIssues(time)).toEqual([]);
    expect(publishIssues({ ...time, label: "" })).toEqual([["label"]]);
    expect(publishIssues({ ...time, config: { earliest: "12:00", latest: "12:00" } })).toEqual([]);
    expect(publishIssues({ ...time, config: { earliest: "09:00" } })).toEqual([]);
    expect(publishIssues({ ...time, config: { latest: "17:30" } })).toEqual([]);
    expect(publishIssues({ ...time, config: { earliest: "18:00", latest: "09:00" } })).toEqual([
      ["config", "latest"],
    ]);
    // A window cannot cross midnight: 22:00 is after 02:00 as a clock time.
    expect(publishIssues({ ...time, config: { earliest: "22:00", latest: "02:00" } })).toEqual([
      ["config", "latest"],
    ]);
  });

  test("answers are HH:MM with no seconds, inside the bounds, compared as strings", () => {
    const question = parsedQuestion(time);
    const answer = questionTypes.time_of_day.answer(question);
    expect(answer.safeParse("09:00").success).toBe(true);
    expect(answer.safeParse("12:30").success).toBe(true);
    expect(answer.safeParse("17:00").success).toBe(true);
    expect(answer.safeParse("08:59").success).toBe(false);
    expect(answer.safeParse("17:01").success).toBe(false);
    expect(answer.safeParse("9:30").success).toBe(false);
    expect(answer.safeParse("12:30:00").success).toBe(false);
    expect(answer.safeParse("24:00").success).toBe(false);

    const open = questionTypes.time_of_day.answer(parsedQuestion({ ...time, config: {} }));
    expect(open.safeParse("00:00").success).toBe(true);
    expect(open.safeParse("23:59").success).toBe(true);

    const definition = parseDefinition(withQuestion({ ...time, required: false }));
    if (!definition.ok) throw new Error("definition");
    expect(validateAnswers(definition.value, { [id]: "10:15" }).ok).toBe(true);
    expect(validateAnswers(definition.value, {}).ok).toBe(true);
    expect(validateAnswers(definition.value, { [id]: "08:00" }).ok).toBe(false);
    expect(validateAnswers(definition.value, { [id]: "18:00" }).ok).toBe(false);
  });

  test("display reads the time back as written", () => {
    const definition = parseDefinition(withQuestion(time));
    if (!definition.ok) throw new Error("definition");
    const [row] = interpretAnswers(definition.value, { [id]: "09:05" }, [id]);
    expect(row).toMatchObject({
      status: "answered",
      answer: { value: "09:05", display: "09:05" },
    });
  });
});

const leaf = (questionId: string, operator: string, constant?: string): Condition => ({
  questionId,
  operator,
  ...(constant === undefined ? {} : { constant }),
});

const question = (n: number, extra: object = {}) => ({
  id: uuid(n),
  type: "time_of_day",
  label: `Q${n}`,
  required: false,
  config: {},
  ...extra,
});

const form = (pages: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 2, title: "Feedback", pages });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

/** Whether the follower is on the path when the source question is answered with `value`. */
const followerShown = (condition: Condition, value: unknown) => {
  const definition = form([
    {
      id: pageId(1),
      questions: [
        question(1),
        {
          ...question(2),
          type: "text",
          config: { display: "single_line" },
          showCondition: condition,
        },
      ],
      jumps: [],
    },
  ]);
  const answers: Answers = value === undefined ? {} : { [uuid(1)]: value as Answers[string] };
  return pathOf(definition, answers).questions.some((item) => item.id === uuid(2));
};

describe("time of day conditions", () => {
  test("offers is at, is before, is after, is answered, and is not answered", () => {
    const ids = (type: QuestionTypeName) => conditionOperators[type].map((operator) => operator.id);
    expect(ids("time_of_day")).toEqual([
      "is_at",
      "is_before",
      "is_after",
      "is_answered",
      "is_not_answered",
    ]);
    expect(
      conditionOperators.time_of_day.find((operator) => operator.id === "is_at")?.constant,
    ).toBe("time");
  });

  test("is at, before, and after compare the clock time as a string", () => {
    expect(followerShown(leaf(uuid(1), "is_at", "09:30"), "09:30")).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_at", "09:30"), "09:31")).toBe(false);
    expect(followerShown(leaf(uuid(1), "is_before", "09:30"), "09:29")).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_before", "09:30"), "09:30")).toBe(false);
    expect(followerShown(leaf(uuid(1), "is_after", "09:30"), "09:31")).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_after", "09:30"), "09:30")).toBe(false);
    expect(followerShown(leaf(uuid(1), "is_before", "10:00"), undefined)).toBe(false);
    expect(followerShown(leaf(uuid(1), "is_not_answered"), undefined)).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_answered"), "00:00")).toBe(true);
    expect(followerShown(leaf(uuid(1), "is_not_answered"), "00:00")).toBe(false);
  });

  test("publish rejects a constant that is not HH:MM", () => {
    const definition = form([
      {
        id: pageId(1),
        questions: [
          question(1),
          {
            ...question(2),
            type: "text",
            config: { display: "single_line" },
            showCondition: leaf(uuid(1), "is_at", "noon"),
          },
        ],
        jumps: [],
      },
    ]);
    const result = validateForPublish(definition, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual({
      path: ["pages", 0, "questions", 1, "showCondition", "constant"],
      message: "This constant does not fit this operator",
    });

    const fitting = form([
      {
        id: pageId(1),
        questions: [
          question(1),
          {
            ...question(2),
            type: "text",
            config: { display: "single_line" },
            showCondition: leaf(uuid(1), "is_before", "09:00"),
          },
        ],
        jumps: [],
      },
    ]);
    expect(validateForPublish(fitting, []).ok).toBe(true);
  });
});
