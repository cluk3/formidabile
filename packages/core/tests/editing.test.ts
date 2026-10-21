import { describe, expect, test } from "vite-plus/test";
import {
  parseDefinition,
  questionTypes,
  type FormDefinition,
  type QuestionTypeName,
} from "@fb/core/definition";
import { addQuestion } from "@fb/core/editing";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** Mints `uuid(101)`, `uuid(102)`… and `minted-1`, `minted-2`…, in call order. */
const idSource = () => {
  let questions = 100;
  let options = 0;
  return {
    questionId: () => uuid(++questions),
    optionValue: () => `minted-${++options}`,
  };
};

const deepFreeze = <T>(value: T): T => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/** Parsed and frozen, so an editing function that mutates its input throws. */
const parsed = (input: unknown): FormDefinition => {
  const result = parseDefinition(input);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return deepFreeze(result.value);
};

const empty = parsed({ format: 1, title: "Feedback", questions: [] });

describe("addQuestion", () => {
  test("appends a blank question with a minted identity", () => {
    const edited = addQuestion(empty, "text", idSource());
    expect(edited.questions).toEqual([
      {
        id: uuid(101),
        type: "text",
        label: "",
        required: false,
        config: { display: "single_line" },
      },
    ]);
    expect(parsed(edited)).toEqual(edited);
  });

  test("gives choice questions the blank options publish needs, with minted values", () => {
    const ids = idSource();
    const edited = addQuestion(addQuestion(empty, "single_choice", ids), "multiple_choice", ids);
    expect(edited.questions.map((q) => q.config)).toEqual([
      {
        options: [
          { value: "minted-1", label: "" },
          { value: "minted-2", label: "" },
        ],
        display: "radio",
      },
      { options: [{ value: "minted-3", label: "" }] },
    ]);
    expect(parsed(edited)).toEqual(edited);
  });

  test("adds a question of every type that passes parseDefinition", () => {
    const ids = idSource();
    const types = Object.keys(questionTypes) as QuestionTypeName[];
    const edited = types.reduce((definition, type) => addQuestion(definition, type, ids), empty);
    expect(edited.questions.map((q) => q.type)).toEqual(types);
    expect(parsed(edited)).toEqual(edited);
  });

  test("refuses a 201st question", () => {
    const ids = idSource();
    const full = Array.from({ length: 200 }).reduce<FormDefinition>(
      (definition) => addQuestion(definition, "email", ids),
      empty,
    );
    expect(parsed(full).questions).toHaveLength(200);
    expect(() => addQuestion(full, "email", ids)).toThrow("A form has at most 200 questions");
  });
});
