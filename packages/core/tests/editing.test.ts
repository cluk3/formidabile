import { describe, expect, test } from "vite-plus/test";
import {
  parseDefinition,
  questionTypes,
  type FormDefinition,
  type QuestionTypeName,
} from "@fb/core/definition";
import {
  addQuestion,
  changeQuestionType,
  moveQuestion,
  reidentifyQuestion,
} from "@fb/core/editing";

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

const name = {
  id: uuid(1),
  type: "text",
  label: "Name",
  description: "As it appears on your badge",
  required: true,
  config: { display: "multi_line", maxLength: 80 },
} as const;
const colour = {
  id: uuid(2),
  type: "single_choice",
  label: "Favourite colour",
  required: false,
  config: {
    options: [
      { value: "r", label: "Red" },
      { value: "g", label: "Green" },
      { value: "b", label: "Blue" },
    ],
    display: "dropdown",
  },
} as const;
const age = {
  id: uuid(3),
  type: "number",
  label: "Age",
  required: true,
  config: { integer: true, min: 0, max: 120 },
} as const;

const survey = parsed({ format: 1, title: "Survey", questions: [name, colour, age] });

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

describe("reidentifyQuestion", () => {
  test("mints a new question identity and keeps the content, position and option values", () => {
    const edited = reidentifyQuestion(survey, colour.id, idSource());
    expect(edited).toEqual({ ...survey, questions: [name, { ...colour, id: uuid(101) }, age] });
    expect(parsed(edited)).toEqual(edited);
  });

  test("refuses an identity the definition doesn't have", () => {
    expect(() => reidentifyQuestion(survey, uuid(9), idSource())).toThrow(`No question ${uuid(9)}`);
  });
});

describe("changeQuestionType", () => {
  test("mints a new identity and keeps the label, description, required flag and position", () => {
    const edited = changeQuestionType(survey, name.id, "email", idSource());
    expect(edited).toEqual({
      ...survey,
      questions: [
        {
          id: uuid(101),
          type: "email",
          label: "Name",
          description: "As it appears on your badge",
          required: true,
          config: {},
        },
        colour,
        age,
      ],
    });
    expect(parsed(edited)).toEqual(edited);
  });

  test("gives a new choice question the blank options publish needs", () => {
    const edited = changeQuestionType(survey, age.id, "single_choice", idSource());
    expect(edited.questions[2]).toEqual({
      id: uuid(101),
      type: "single_choice",
      label: "Age",
      required: true,
      config: {
        options: [
          { value: "minted-1", label: "" },
          { value: "minted-2", label: "" },
        ],
        display: "radio",
      },
    });
  });

  test("keeps the options between choice types, and their values", () => {
    const edited = changeQuestionType(survey, colour.id, "multiple_choice", idSource());
    expect(edited.questions[1]).toEqual({
      id: uuid(101),
      type: "multiple_choice",
      label: "Favourite colour",
      required: false,
      config: { options: colour.config.options },
    });
  });

  test("tops kept options up to the blank options publish needs", () => {
    const ids = idSource();
    const oneOption = parsed({
      format: 1,
      title: "Survey",
      questions: [
        { ...colour, type: "multiple_choice", config: { options: [{ value: "r", label: "Red" }] } },
      ],
    });
    const edited = changeQuestionType(oneOption, colour.id, "single_choice", ids);
    expect(edited.questions[0]!.config).toEqual({
      options: [
        { value: "r", label: "Red" },
        { value: "minted-1", label: "" },
      ],
      display: "radio",
    });
  });

  test("keeps the identity when the type doesn't change", () => {
    expect(changeQuestionType(survey, colour.id, "single_choice", idSource())).toBe(survey);
  });

  test("changes every type into every other type, passing parseDefinition", () => {
    const ids = idSource();
    const types = Object.keys(questionTypes) as QuestionTypeName[];
    for (const from of types)
      for (const to of types) {
        const start = addQuestion(survey, from, ids);
        const id = start.questions.at(-1)!.id;
        const edited = changeQuestionType(start, id, to, ids);
        expect(edited.questions.at(-1)!.type).toBe(to);
        expect(parsed(edited)).toEqual(edited);
      }
  });

  test("refuses an identity the definition doesn't have", () => {
    expect(() => changeQuestionType(survey, uuid(9), "email", idSource())).toThrow(
      `No question ${uuid(9)}`,
    );
  });
});

describe("moveQuestion", () => {
  test("moves a question to a position, keeping every identity", () => {
    const edited = moveQuestion(survey, name.id, 2);
    expect(edited).toEqual({ ...survey, questions: [colour, age, name] });
    expect(parsed(edited)).toEqual(edited);
    expect(moveQuestion(survey, age.id, 0).questions).toEqual([age, name, colour]);
    expect(moveQuestion(survey, colour.id, 1).questions).toEqual([name, colour, age]);
  });

  test("refuses a position outside the form", () => {
    expect(() => moveQuestion(survey, name.id, 3)).toThrow("No position 3 among 3 questions");
    expect(() => moveQuestion(survey, name.id, -1)).toThrow("No position -1 among 3 questions");
  });

  test("refuses an identity the definition doesn't have", () => {
    expect(() => moveQuestion(survey, uuid(9), 0)).toThrow(`No question ${uuid(9)}`);
  });
});
