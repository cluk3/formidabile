import { describe, expect, test } from "vite-plus/test";
import { interpretAnswers, pathOf, validateAnswers } from "@fb/core/answers";
import {
  conditionOperators,
  parseDefinition,
  questionsOf,
  validateForPublish,
  type FormDefinition,
  type QuestionTypeName,
} from "@fb/core/definition";
import { addQuestion } from "@fb/core/editing";

const phoneId = "0192f5a0-7c3e-7b1a-9d2e-000000000071";
const noteId = "0192f5a0-7c3e-7b1a-9d2e-000000000072";

const phone = {
  id: phoneId,
  type: "phone" as const,
  label: "Phone",
  required: true,
  config: {},
};

const note = (showCondition?: object) => ({
  id: noteId,
  type: "text" as const,
  label: "Note",
  required: false,
  config: { display: "single_line" as const },
  ...(showCondition === undefined ? {} : { showCondition }),
});

const form = (questions: object[]): FormDefinition => {
  const parsed = parseDefinition({ format: 1, title: "Feedback", questions });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  return parsed.value;
};

const stored = (input: unknown) => validateAnswers(form([phone]), { [phoneId]: input });

const messages = (input: unknown) => {
  const result = stored(input);
  return result.ok ? [] : result.issues.map((issue) => issue.message);
};

const shown = (condition: object, value?: string) =>
  pathOf(
    form([phone, note(condition)]),
    value === undefined ? {} : { [phoneId]: value },
  ).questions.map((question) => question.id);

describe("phone", () => {
  test("structure: has no config", () => {
    expect(parseDefinition({ format: 1, title: "Feedback", questions: [phone] }).ok).toBe(true);
    const extra = parseDefinition({
      format: 1,
      title: "Feedback",
      questions: [{ ...phone, config: { country: "US" } }],
    });
    expect(extra.ok).toBe(false);
    if (!extra.ok)
      expect(extra.issues.map((issue) => issue.path)).toEqual([["questions", 0, "config"]]);
  });

  test("publish: needs a label, and accepts phone operators", () => {
    expect(validateForPublish(form([phone]), []).ok).toBe(true);
    const blank = validateForPublish(
      { format: 1, title: "Feedback", questions: [{ ...phone, label: "  " }] },
      [],
    );
    expect(blank.ok).toBe(false);
    if (!blank.ok)
      expect(blank.issues.map((issue) => issue.path)).toEqual([["questions", 0, "label"]]);

    expect(
      validateForPublish(
        form([phone, note({ questionId: phoneId, operator: "starts_with", constant: "+1" })]),
        [],
      ).ok,
    ).toBe(true);
    const unfit = validateForPublish(
      form([phone, note({ questionId: phoneId, operator: "contains", constant: "+1" })]),
      [],
    );
    expect(unfit.ok).toBe(false);
    if (!unfit.ok)
      expect(unfit.issues).toContainEqual({
        path: ["questions", 1, "showCondition", "operator"],
        message: "This operator does not fit this question",
      });
  });

  test("an answer is stored as E.164, with spaces, dashes, dots, and parentheses stripped", () => {
    const fifteen = `+${"1".repeat(15)}`;
    const cases: Array<[string, string]> = [
      ["+14155550100", "+14155550100"],
      ["+1 (415) 555-0100", "+14155550100"],
      ["+1.415.555.0100", "+14155550100"],
      ["+1-415-555-0100", "+14155550100"],
      ["+1 415 555 0100", "+14155550100"],
      [" +1 (415).555-0100 ", "+14155550100"],
      ["+0123", "+0123"],
      [fifteen, fifteen],
    ];
    for (const [input, value] of cases)
      expect(stored(input)).toEqual({ ok: true, value: { [phoneId]: value } });

    const optional = form([{ ...phone, required: false }]);
    expect(validateAnswers(optional, {}).ok).toBe(true);
  });

  test("a number with no country code asks for one, and any other shape is refused", () => {
    for (const input of [
      "4155550100",
      "(415) 555-0100",
      "415.555.0100",
      "415-555-0100",
      "0044155550100",
      "",
    ])
      expect(messages(input)).toEqual(["Include a country code, starting with +"]);

    for (const input of ["+", "+1234567890123456", "+1abc", "++14155550100"])
      expect(messages(input)).toEqual(["Use + followed by at most 15 digits"]);

    expect(messages(12).length).toBeGreaterThan(0);
  });

  test("display is the stored number", () => {
    const definition = form([phone]);
    if (definition.format !== 1) throw new Error("expected format 1");
    const value = "+14155550100";
    expect(interpretAnswers(definition, { [phoneId]: value }, [phoneId])).toEqual([
      {
        question: definition.questions[0],
        status: "answered",
        answer: { value, display: value },
      },
    ]);
  });

  test("operators are equals, does not equal, starts with, and does not start with", () => {
    const ids = (type: QuestionTypeName) => conditionOperators[type].map((operator) => operator.id);
    expect(ids("phone")).toEqual([
      "equals",
      "does_not_equal",
      "starts_with",
      "does_not_start_with",
      "is_answered",
      "is_not_answered",
    ]);
    expect(
      conditionOperators.phone.find((operator) => operator.id === "starts_with")?.constant,
    ).toBe("string");

    const onPath = [phoneId, noteId];
    expect(
      shown(
        { questionId: phoneId, operator: "equals", constant: "+1 415 555 0100" },
        "+1 (415) 555-0100",
      ),
    ).toEqual(onPath);
    expect(
      shown({ questionId: phoneId, operator: "equals", constant: "+44" }, "+14155550100"),
    ).toEqual([phoneId]);
    expect(
      shown({ questionId: phoneId, operator: "does_not_equal", constant: "+44" }, "+14155550100"),
    ).toEqual(onPath);
    expect(
      shown(
        { questionId: phoneId, operator: "does_not_equal", constant: "+1 (415) 555-0100" },
        "+14155550100",
      ),
    ).toEqual([phoneId]);
    expect(
      shown({ questionId: phoneId, operator: "starts_with", constant: "+1" }, "+1 415 555 0100"),
    ).toEqual(onPath);
    expect(
      shown({ questionId: phoneId, operator: "starts_with", constant: "+44" }, "+14155550100"),
    ).toEqual([phoneId]);
    expect(
      shown(
        { questionId: phoneId, operator: "does_not_start_with", constant: "+44" },
        "+14155550100",
      ),
    ).toEqual(onPath);
    expect(
      shown(
        { questionId: phoneId, operator: "does_not_start_with", constant: "+1" },
        "+14155550100",
      ),
    ).toEqual([phoneId]);
    expect(shown({ questionId: phoneId, operator: "is_answered" }, "+14155550100")).toEqual(onPath);
    expect(shown({ questionId: phoneId, operator: "is_not_answered" })).toEqual(onPath);
    expect(shown({ questionId: phoneId, operator: "is_not_answered" }, "+14155550100")).toEqual([
      phoneId,
    ]);
    expect(shown({ questionId: phoneId, operator: "equals", constant: "+1" })).toEqual([phoneId]);
    expect(shown({ questionId: phoneId, operator: "starts_with", constant: "+1" })).toEqual([
      phoneId,
    ]);
  });

  test("adding a phone question starts it with an empty config", () => {
    const blank = parseDefinition({ format: 1, title: "Feedback", questions: [] });
    if (!blank.ok) throw new Error(JSON.stringify(blank.issues));
    const added = addQuestion(blank.value, "phone", {
      questionId: () => phoneId,
      optionValue: () => "opt",
      pageId: () => "0192f5a0-7c3e-7b1a-9d2e-000000000098",
    });
    expect(questionsOf(added)).toEqual([
      { id: phoneId, type: "phone", label: "", required: false, config: {} },
    ]);
  });
});
