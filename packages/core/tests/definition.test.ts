import { describe, expect, test } from "vite-plus/test";
import { parseDefinition, validateForPublish, type Result } from "@fb/core/definition";

const issuePaths = (result: Result<unknown>) => (result.ok ? [] : result.issues.map((i) => i.path));

const parsed = (input: unknown) => {
  const result = parseDefinition(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const q1 = "00000000-0000-4000-8000-000000000001";

const textQuestion = {
  id: q1,
  type: "text",
  label: "Name",
  required: true,
  config: { display: "single_line" },
};

const definition = (overrides: object = {}) => ({
  format: 1,
  title: "Feedback",
  questions: [textQuestion],
  ...overrides,
});

describe("parseDefinition", () => {
  test("accepts a format 1 definition", () => {
    expect(parseDefinition(definition())).toEqual({ ok: true, value: definition() });
  });

  test("rejects an unknown format", () => {
    const result = parseDefinition(definition({ format: 3 }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.path)).toEqual([["format"]]);
  });

  test("rejects two questions with one identity", () => {
    const result = parseDefinition(definition({ questions: [textQuestion, textQuestion] }));
    expect(result).toEqual({
      ok: false,
      issues: [{ path: ["questions", 1, "id"], message: "Duplicate question identity" }],
    });
  });

  test("caps the title at 200 code points", () => {
    expect(parseDefinition(definition({ title: "😀".repeat(200) })).ok).toBe(true);
    expect(issuePaths(parseDefinition(definition({ title: "😀".repeat(201) })))).toEqual([
      ["title"],
    ]);
  });

  test("caps a definition at 200 questions", () => {
    const questions = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        ...textQuestion,
        id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      }));
    expect(parseDefinition(definition({ questions: questions(200) })).ok).toBe(true);
    expect(issuePaths(parseDefinition(definition({ questions: questions(201) })))).toEqual([
      ["questions"],
    ]);
  });

  test("trims text and accepts an empty title while drafting", () => {
    const result = parseDefinition(definition({ title: "  ", description: " About us " }));
    expect(result.ok && [result.value.title, result.value.description]).toEqual(["", "About us"]);
  });

  test("rejects unknown keys", () => {
    expect(issuePaths(parseDefinition(definition({ name: "Feedback" })))).toEqual([[]]);
  });
});

describe("validateForPublish", () => {
  test("accepts a complete definition", () => {
    expect(validateForPublish(definition(), [])).toEqual({ ok: true, value: definition() });
  });

  test("reports structural problems without the publish rules", () => {
    expect(issuePaths(validateForPublish(definition({ title: "", format: 3 }), []))).toEqual([
      ["format"],
    ]);
  });

  test("needs a title and at least one question", () => {
    expect(validateForPublish(definition({ title: " ", questions: [] }), [])).toEqual({
      ok: false,
      issues: [
        { path: ["title"], message: "A form needs a title before publishing" },
        { path: ["questions"], message: "A form needs at least one question" },
      ],
    });
  });

  test("reports every problem in a draft in one result", () => {
    const q2 = "00000000-0000-4000-8000-000000000002";
    const draft = definition({
      title: "",
      questions: [
        { ...textQuestion, label: "" },
        { ...textQuestion, id: q2, label: "" },
      ],
    });
    expect(issuePaths(validateForPublish(draft, []))).toEqual([
      ["title"],
      ["questions", 0, "label"],
      ["questions", 1, "label"],
    ]);
  });

  test("publishes a definition holding all seven question types", () => {
    const configs = {
      text: { display: "single_line" },
      email: {},
      number: { integer: true, min: 0, max: 10 },
      date: { min: "2026-01-01" },
      single_choice: {
        display: "dropdown",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
      },
      multiple_choice: { options: [{ value: "a", label: "A" }], minSelected: 1, maxSelected: 1 },
      boolean: {},
    };
    const questions = Object.entries(configs).map(([type, config], i) => ({
      id: `00000000-0000-4000-8000-00000000000${i}`,
      type,
      label: type,
      required: i % 2 === 0,
      config,
    }));
    expect(validateForPublish(definition({ questions }), []).ok).toBe(true);
  });

  test("rejects an unknown question type", () => {
    const unknown = { ...textQuestion, type: "rating", config: {} };
    expect(issuePaths(validateForPublish(definition({ questions: [unknown] }), []))).toEqual([
      ["questions", 0, "type"],
    ]);
  });

  test("rejects a question identity whose type differs from an earlier version's", () => {
    const earlier = parsed(
      definition({
        questions: [{ id: q1, type: "boolean", label: "Agree?", required: true, config: {} }],
      }),
    );
    expect(validateForPublish(definition(), [earlier])).toEqual({
      ok: false,
      issues: [
        {
          path: ["questions", 0, "type"],
          message:
            'This question was "boolean" in an earlier version; a different type needs a new question identity',
        },
      ],
    });
  });
});
