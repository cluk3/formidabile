import { describe, expect, test } from "vite-plus/test";
import {
  buildAnswerSchema,
  interpretAnswers,
  validateAnswers,
  type Answers,
} from "@fb/core/answers";
import {
  parseDefinition,
  questionsOf,
  questionTypes,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";

const ids = {
  name: "00000000-0000-4000-8000-000000000001",
  bio: "00000000-0000-4000-8000-000000000002",
};

const define = (questions: object[]) => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  if (parsed.value.format !== 1) throw new Error("expected a format 1 fixture");
  return parsed.value;
};

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const text = (id: string, required: boolean) => ({
  id,
  type: "text",
  label: "Question",
  required,
  config: { display: "single_line" },
});

describe("validateAnswers", () => {
  const form = define([text(ids.name, true), text(ids.bio, false)]);

  test("answers are keyed by question identity with untagged values", () => {
    expect(validateAnswers(form, { [ids.name]: "Ada", [ids.bio]: "Mathematician" })).toEqual({
      ok: true,
      value: { [ids.name]: "Ada", [ids.bio]: "Mathematician" },
    });
  });

  test("an unanswered optional question has no key", () => {
    expect(validateAnswers(form, { [ids.name]: "Ada" })).toEqual({
      ok: true,
      value: { [ids.name]: "Ada" },
    });
  });

  test("an unanswered required question is rejected at its key", () => {
    expect(issuePaths(validateAnswers(form, { [ids.bio]: "Mathematician" }))).toEqual([[ids.name]]);
  });

  test("an answer to a question the version doesn't have is rejected", () => {
    const other = "00000000-0000-4000-8000-0000000000ff";
    const result = validateAnswers(form, { [ids.name]: "Ada", [other]: "?" });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.issues).toEqual([
      expect.objectContaining({ path: [], message: expect.stringContaining(other) }),
    ]);
  });

  test("an unanswered optional question is never null, undefined or blank", () => {
    for (const unanswered of [null, undefined, "", "   "])
      expect(
        issuePaths(validateAnswers(form, { [ids.name]: "Ada", [ids.bio]: unanswered })),
      ).toEqual([[ids.bio]]);
  });

  test("tagged values are rejected", () => {
    expect(
      issuePaths(validateAnswers(form, { [ids.name]: { type: "text", value: "Ada" } })),
    ).toEqual([[ids.name]]);
  });

  test("answers must be an object", () => {
    for (const input of [null, [], "Ada"])
      expect(issuePaths(validateAnswers(form, input))).toEqual([[]]);
  });
});

const options = [
  { value: "o-red", label: "Red" },
  { value: "o-green", label: "Green" },
  { value: "o-blue", label: "Blue" },
];

/** Per type: one configured question, answers it accepts (with what they parse to), and ones it rejects. */
const cases: {
  type: string;
  config: object;
  accepts: [input: unknown, output: unknown][];
  rejects: unknown[];
}[] = [
  {
    type: "text",
    config: { display: "multi_line", maxLength: 5 },
    accepts: [
      ["Ada", "Ada"],
      ["  Ada  ", "Ada"],
      ["ééééé", "ééééé"],
    ],
    rejects: ["", "  ", "Lovelace", 1, ["Ada"]],
  },
  {
    type: "email",
    config: {},
    accepts: [["ada@example.com", "ada@example.com"]],
    rejects: ["ada", "", `${"a".repeat(243)}@example.com`, true],
  },
  {
    type: "number",
    config: { integer: true, min: 1, max: 10 },
    accepts: [
      [1, 1],
      [10, 10],
    ],
    rejects: [0, 11, 2.5, "5", Number.NaN, Number.POSITIVE_INFINITY],
  },
  {
    type: "number",
    config: { integer: false, min: -1.5 },
    accepts: [
      [-1.5, -1.5],
      [1e9, 1e9],
      [2.25, 2.25],
    ],
    rejects: [-2, "2.25"],
  },
  {
    type: "date",
    config: { min: "2026-01-01", max: "2026-12-31" },
    accepts: [
      ["2026-01-01", "2026-01-01"],
      ["2026-12-31", "2026-12-31"],
    ],
    rejects: ["2025-12-31", "2027-01-01", "2026-02-30", "2026-06-01T00:00:00Z", 20260601],
  },
  {
    type: "single_choice",
    config: { options, display: "dropdown" },
    accepts: [["o-green", "o-green"]],
    rejects: ["Green", "o-purple", ["o-green"], ""],
  },
  {
    type: "multiple_choice",
    config: { options, minSelected: 2, maxSelected: 2 },
    accepts: [
      [
        ["o-blue", "o-red"],
        ["o-blue", "o-red"],
      ],
    ],
    rejects: [
      ["o-red"],
      ["o-red", "o-green", "o-blue"],
      ["o-red", "o-red"],
      ["o-red", "x"],
      "o-red",
    ],
  },
  {
    type: "multiple_choice",
    config: { options },
    accepts: [
      [["o-red"], ["o-red"]],
      [
        ["o-red", "o-green", "o-blue"],
        ["o-red", "o-green", "o-blue"],
      ],
    ],
    rejects: [[]],
  },
  {
    type: "boolean",
    config: {},
    accepts: [
      [true, true],
      [false, false],
    ],
    rejects: ["true", 0, null],
  },
  {
    type: "phone",
    config: {},
    accepts: [
      ["+14155550100", "+14155550100"],
      ["+1 (415) 555-0100", "+14155550100"],
      ["+1.415.555.0100", "+14155550100"],
      ["+1-415-555-0100", "+14155550100"],
    ],
    rejects: ["4155550100", "+", `+${"1".repeat(16)}`, 14155550100],
  },
  {
    type: "url",
    config: {},
    accepts: [
      ["https://example.com", "https://example.com"],
      ["  HTTPS://Example.COM/a  ", "HTTPS://Example.COM/a"],
    ],
    rejects: ["example.com", "ftp://example.com", "javascript:alert(1)", ""],
  },
  {
    type: "time_of_day",
    config: { earliest: "09:00", latest: "17:00" },
    accepts: [
      ["09:00", "09:00"],
      ["12:30", "12:30"],
      ["17:00", "17:00"],
    ],
    rejects: ["08:59", "17:01", "9:00", "17:00:00", "24:00"],
  },
  {
    type: "date_time",
    config: { min: "2026-05-01T09:00", max: "2026-05-31T18:00" },
    accepts: [
      ["2026-05-01T09:00", "2026-05-01T09:00"],
      ["2026-05-04T15:30", "2026-05-04T15:30"],
    ],
    rejects: ["2026-05-01T08:59", "2026-05-04T15:30:00", "2026-05-04T15:30Z", "2026-02-31T10:00"],
  },
  {
    type: "date_range",
    config: { min: "2026-05-01", max: "2026-05-31" },
    accepts: [
      [
        { start: "2026-05-01", end: "2026-05-03" },
        { start: "2026-05-01", end: "2026-05-03" },
      ],
      [
        { start: "2026-05-04", end: "2026-05-04" },
        { start: "2026-05-04", end: "2026-05-04" },
      ],
    ],
    rejects: [
      { start: "2026-05-03", end: "2026-05-01" },
      { start: "2026-05-01" },
      ["2026-05-01", "2026-05-03"],
      { start: "2026-04-30", end: "2026-05-02" },
    ],
  },
];

describe("buildAnswerSchema", () => {
  const id = ids.name;

  describe.each(cases)("$type $config", ({ type, config, accepts, rejects }) => {
    const form = define([{ id, type, label: "Question", required: true, config }]);

    test.each(accepts)("accepts %j", (input, output) => {
      expect(buildAnswerSchema(form).safeParse({ [id]: input })).toEqual({
        success: true,
        data: { [id]: output },
      });
    });

    test.each(rejects.map((input) => [input]))("rejects %j", (input) => {
      expect(buildAnswerSchema(form).safeParse({ [id]: input }).success).toBe(false);
    });

    test("an optional question may be left out, and a required one may not", () => {
      const optional = define([{ id, type, label: "Question", required: false, config }]);
      expect(buildAnswerSchema(optional).safeParse({}).success).toBe(true);
      expect(buildAnswerSchema(form).safeParse({}).success).toBe(false);
    });
  });

  test("covers every question type", () => {
    expect(new Set(cases.map((c) => c.type))).toEqual(new Set(Object.keys(questionTypes)));
  });

  test("is built afresh on every call", () => {
    const form = define([text(id, true)]);
    expect(buildAnswerSchema(form)).not.toBe(buildAnswerSchema(form));
  });
});

describe("interpretAnswers", () => {
  const q = {
    text: "00000000-0000-4000-8000-000000000011",
    email: "00000000-0000-4000-8000-000000000012",
    number: "00000000-0000-4000-8000-000000000013",
    date: "00000000-0000-4000-8000-000000000014",
    single: "00000000-0000-4000-8000-000000000015",
    multiple: "00000000-0000-4000-8000-000000000016",
    yes: "00000000-0000-4000-8000-000000000017",
    no: "00000000-0000-4000-8000-000000000018",
  };
  const question = (id: string, type: string, label: string, config: object) => ({
    id,
    type,
    label,
    required: false,
    config,
  });
  const questions = [
    question(q.text, "text", "Name", { display: "single_line" }),
    question(q.email, "email", "Email", {}),
    question(q.number, "number", "Age", { integer: true }),
    question(q.date, "date", "Start", {}),
    question(q.single, "single_choice", "Colour", { options, display: "radio" }),
    question(q.multiple, "multiple_choice", "Colours", { options }),
    question(q.yes, "boolean", "Subscribe", {}),
    question(q.no, "boolean", "Share", {}),
  ];
  const form = define(questions);
  const answers = {
    [q.text]: "Ada",
    [q.email]: "ada@example.com",
    [q.number]: 36,
    [q.date]: "1843-07-01",
    [q.single]: "o-green",
    [q.multiple]: ["o-blue", "o-red"],
    [q.yes]: true,
    [q.no]: false,
  };

  const shown = (definition: FormDefinition) =>
    questionsOf(definition).map((question) => question.id);

  const displayed = (definition: FormDefinition, input: Answers) =>
    interpretAnswers(definition, input, shown(definition)).map(({ question, answer }) => [
      question.label,
      answer?.display,
    ]);

  test("shows every type's answer in the version's order", () => {
    expect(displayed(form, answers)).toEqual([
      ["Name", "Ada"],
      ["Email", "ada@example.com"],
      ["Age", "36"],
      ["Start", "1843-07-01"],
      ["Colour", "Green"],
      ["Colours", "Blue, Red"],
      ["Subscribe", "Yes"],
      ["Share", "No"],
    ]);
  });

  test("pairs each question's snapshot with its raw, untagged value", () => {
    const [first, , , , , multiple] = interpretAnswers(form, answers, shown(form));
    expect(first).toEqual({
      question: form.questions[0],
      status: "answered",
      answer: { value: "Ada", display: "Ada" },
    });
    expect(multiple?.answer?.value).toEqual(["o-blue", "o-red"]);
  });

  test("a missing key reads as skipped", () => {
    const { [q.email]: _skipped, ...rest } = answers;
    const [, email] = interpretAnswers(form, rest, shown(form));
    expect(email).toEqual({ question: form.questions[1], status: "skipped" });
  });

  test("questions absent from the response's version don't appear", () => {
    const v2 = define([...questions.slice(0, 1), question(q.no, "boolean", "Share", {})]);
    expect(displayed(v2, { [q.text]: "Ada", [q.yes]: true })).toEqual([
      ["Name", "Ada"],
      ["Share", undefined],
    ]);
  });

  test("reads answers through the given version's snapshots", () => {
    const v2Options = [{ value: "o-green", label: "Lime" }, ...options.slice(0, 1)];
    const v2 = define([
      question(q.single, "single_choice", "Colour", { options: v2Options, display: "radio" }),
    ]);
    expect(displayed(form, { [q.single]: "o-green" })[4]).toEqual(["Colour", "Green"]);
    expect(displayed(v2, { [q.single]: "o-green" })).toEqual([["Colour", "Lime"]]);
  });
});
