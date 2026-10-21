import { describe, expect, test } from "vite-plus/test";
import { buildAnswerSchema, validateAnswers } from "@fb/core/answers";
import {
  parseDefinition,
  questionTypes,
  type FormDefinition,
  type Result,
} from "@fb/core/definition";

const ids = {
  name: "00000000-0000-4000-8000-000000000001",
  bio: "00000000-0000-4000-8000-000000000002",
};

const define = (questions: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
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
