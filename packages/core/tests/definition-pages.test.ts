import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, validateAnswers } from "@fb/core/answers";
import {
  JUMPS_CAP,
  PAGES_CAP,
  pagesOf,
  parseDefinition,
  QUESTIONS_CAP,
  questionsOf,
  validateForPublish,
  type Result,
} from "@fb/core/definition";
import { upgradeToFormat2, type IdSource } from "@fb/core/editing";

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const textQuestion = (n: number, label = "Name") => ({
  id: uuid(n),
  type: "text" as const,
  label,
  required: true,
  config: { display: "single_line" as const },
});

const format1 = (overrides: object = {}) => ({
  format: 1 as const,
  title: "Feedback",
  questions: [textQuestion(1)],
  ...overrides,
});

const page = (
  n: number,
  questions: object[] = [textQuestion(n)],
  jumps: object[] = [],
  extra: object = {},
) => ({
  id: uuid(n),
  questions,
  jumps,
  ...extra,
});

const format2 = (pages: ReturnType<typeof page>[], overrides: object = {}) => ({
  format: 2 as const,
  title: "Feedback",
  pages,
  ...overrides,
});

const parsed = (input: unknown) => {
  const result = parseDefinition(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const ids: IdSource = {
  questionId: () => uuid(50),
  optionValue: () => "opt",
  pageId: () => uuid(7),
};

describe("parseDefinition reads format 1 as one page", () => {
  test("a format-1 definition round-trips with no show conditions and no jumps added", () => {
    const stored = format1({ description: "Hello" });
    const result = parseDefinition(stored);
    expect(result).toEqual({ ok: true, value: stored });
    if (!result.ok) return;
    expect(pagesOf(result.value)).toEqual([{ id: null, questions: stored.questions, jumps: [] }]);
    expect(questionsOf(result.value)).toEqual(stored.questions);
    expect(result.value).not.toHaveProperty("pages");
  });

  test("rejects a missing format and an unknown format", () => {
    const { format: _format, ...missing } = format1();
    expect(issuePaths(parseDefinition(missing))).toEqual([["format"]]);
    expect(issuePaths(parseDefinition(format1({ format: 3 })))).toEqual([["format"]]);
  });

  test("rejects a key the format does not define", () => {
    expect(issuePaths(parseDefinition(format1({ name: "Feedback" })))).toEqual([[]]);
  });
});

describe("parseDefinition accepts format 2", () => {
  test("a page list with ids, optional title and description, and empty jumps round-trips", () => {
    const stored = format2([
      page(2, [textQuestion(1)], [], { title: "Start", description: "About" }),
    ]);
    expect(parseDefinition(stored)).toEqual({ ok: true, value: stored });
    const value = parsed(stored);
    expect(pagesOf(value)).toEqual(stored.pages);
    expect(questionsOf(value)).toEqual([textQuestion(1)]);
  });

  test("a draft may contain an empty page", () => {
    const stored = format2([page(2, []), page(3, [textQuestion(1)])]);
    expect(parseDefinition(stored).ok).toBe(true);
  });

  test("an optional show condition is a leaf or a group, and an unknown key is rejected", () => {
    const leaf = { questionId: uuid(9), operator: "is_answered" };
    const withLeaf = format2([
      page(2, [{ ...textQuestion(1), showCondition: { all: [{ any: [leaf] }, leaf] } }]),
    ]);
    expect(parseDefinition(withLeaf)).toEqual({ ok: true, value: withLeaf });
    expect(
      issuePaths(
        parseDefinition(format2([page(2, [{ ...textQuestion(1), showCondition: { all: [] } }])])),
      ),
    ).toEqual([]);
    expect(
      issuePaths(
        parseDefinition(
          format2([page(2, [{ ...textQuestion(1), showCondition: { nope: true } }])]),
        ),
      ),
    ).not.toEqual([]);
  });

  test("a jump target is a page id or the end, and a fourth condition group is rejected", () => {
    const leaf = { questionId: uuid(1), operator: "equals", constant: "Ada" };
    const stored = format2([
      page(
        2,
        [textQuestion(1)],
        [
          { condition: leaf, target: uuid(3) },
          { condition: { all: [leaf] }, target: "end" },
        ],
      ),
      page(3, [textQuestion(4)]),
    ]);
    expect(parseDefinition(stored)).toEqual({ ok: true, value: stored });
    const tooDeep = { all: [{ any: [{ all: [{ any: [leaf] }] }] }] };
    expect(
      issuePaths(
        parseDefinition(
          format2([page(2, [textQuestion(1)], [{ condition: tooDeep, target: "end" }])]),
        ),
      ),
    ).not.toEqual([]);
    expect(
      issuePaths(
        parseDefinition(
          format2([page(2, [textQuestion(1)], [{ condition: leaf, target: "end", extra: 1 }])]),
        ),
      ),
    ).not.toEqual([]);
  });

  test("caps pages, jumps, and questions across pages, and page ids are unique", () => {
    const questions = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => textQuestion(from + i));
    expect(
      parseDefinition(format2(Array.from({ length: PAGES_CAP }, (_, i) => page(i + 1)))).ok,
    ).toBe(true);
    expect(
      issuePaths(
        parseDefinition(format2(Array.from({ length: PAGES_CAP + 1 }, (_, i) => page(i + 1)))),
      ),
    ).toEqual([["pages"]]);

    const jumps = Array.from({ length: JUMPS_CAP }, () => ({
      condition: { questionId: uuid(1), operator: "is_answered" },
      target: "end" as const,
    }));
    expect(parseDefinition(format2([page(2, [textQuestion(1)], jumps)])).ok).toBe(true);
    expect(
      issuePaths(parseDefinition(format2([page(2, [textQuestion(1)], [...jumps, jumps[0]!])]))),
    ).toEqual([["pages", 0, "jumps"]]);

    expect(
      parseDefinition(format2([page(2, questions(1, 100)), page(3, questions(101, 100))])).ok,
    ).toBe(true);
    expect(
      issuePaths(
        parseDefinition(format2([page(2, questions(1, 100)), page(3, questions(101, 101))])),
      ),
    ).toEqual([["pages"]]);
    expect(
      issuePaths(parseDefinition(format2([page(2, questions(1, QUESTIONS_CAP + 1))]))),
    ).toEqual([["pages", 0, "questions"]]);

    expect(
      issuePaths(
        parseDefinition(format2([page(2, [textQuestion(1)]), page(2, [textQuestion(4)])])),
      ),
    ).toEqual([["pages", 1, "id"]]);
    expect(
      issuePaths(parseDefinition(format2([page(2, [textQuestion(1), textQuestion(1)])]))),
    ).toEqual([["pages", 0, "questions", 1, "id"]]);
  });

  test("rejects a key format 2 does not define, including a top-level questions list", () => {
    expect(issuePaths(parseDefinition({ ...format2([page(2)]), questions: [] }))).toEqual([[]]);
    expect(issuePaths(parseDefinition(format2([])))).toEqual([["pages"]]);
  });
});

describe("validateForPublish rejects an empty page", () => {
  test("a format-1 definition with no questions still fails the way it does today", () => {
    expect(validateForPublish(format1({ title: " ", questions: [] }), [])).toEqual({
      ok: false,
      issues: [
        { path: ["title"], message: "A form needs a title before publishing" },
        { path: ["questions"], message: "A form needs at least one question" },
      ],
    });
  });

  test("a format-2 draft with an empty page publishes only once every page has a question", () => {
    const draft = format2([page(2, [{ ...textQuestion(1), label: "" }]), page(3, [])], {
      title: "",
    });
    expect(validateForPublish(draft, [])).toEqual({
      ok: false,
      issues: [
        { path: ["title"], message: "A form needs a title before publishing" },
        {
          path: ["pages", 0, "questions", 0, "label"],
          message: "A question needs a label before publishing",
        },
        {
          path: ["pages", 1, "questions"],
          message: "A page needs at least one question before publishing",
        },
      ],
    });
    expect(
      validateForPublish(format2([page(2, [textQuestion(1)]), page(3, [textQuestion(4)])]), []).ok,
    ).toBe(true);
  });

  test("a question keeps one type across a format-1 version and a format-2 version", () => {
    const earlier = parsed(
      format1({
        questions: [{ id: uuid(1), type: "boolean", label: "Agree?", required: true, config: {} }],
      }),
    );
    expect(validateForPublish(format2([page(2, [textQuestion(1)])]), [earlier])).toEqual({
      ok: false,
      issues: [
        {
          path: ["pages", 0, "questions", 0, "type"],
          message:
            'This question was "boolean" in an earlier version; a different type needs a new question identity',
        },
      ],
    });
  });
});

describe("answers and upgrade use the same question order", () => {
  test("format 2 answers follow the pages, and upgrade stores one page with a minted id", () => {
    const stored = format2([
      page(2, [textQuestion(1, "First")]),
      page(3, [textQuestion(4, "Second")]),
    ]);
    const definition = parsed(stored);
    expect(validateAnswers(definition, { [uuid(1)]: "Ada", [uuid(4)]: "Lovelace" }).ok).toBe(true);
    expect(
      interpretAnswers(definition, { [uuid(1)]: "Ada" }).map((row) => row.question.label),
    ).toEqual(["First", "Second"]);

    const formatOne = parsed(format1({ description: "Hello" }));
    const upgraded = upgradeToFormat2(formatOne, ids);
    expect(upgraded).toEqual({
      format: 2,
      title: "Feedback",
      description: "Hello",
      pages: [{ id: uuid(7), questions: format1().questions, jumps: [] }],
    });
    expect(upgradeToFormat2(upgraded, ids)).toBe(upgraded);
  });
});
