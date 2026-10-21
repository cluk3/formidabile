import {
  QUESTIONS_CAP,
  type FormDefinition,
  type QuestionSnapshot,
  type QuestionSnapshotOf,
  type QuestionTypeName,
} from "../definition/form-definition.ts";

/**
 * Mints identifiers for the editing functions. Core has no `crypto`, so the builder supplies one
 * built on Web Crypto. Each question identity is a fresh UUID and each option value a fresh opaque
 * string, never derived from a label.
 */
export type IdSource = { questionId(): string; optionValue(): string };

const blankOption = (ids: IdSource) => ({ value: ids.optionValue(), label: "" });

/** A new question's config. Choice questions start with as many blank options as publish needs. */
const blankConfig = {
  text: () => ({ display: "single_line" }),
  email: () => ({}),
  number: () => ({ integer: false }),
  date: () => ({}),
  single_choice: (ids) => ({ options: [blankOption(ids), blankOption(ids)], display: "radio" }),
  multiple_choice: (ids) => ({ options: [blankOption(ids)] }),
  boolean: () => ({}),
} satisfies {
  [T in QuestionTypeName]: (ids: IdSource) => QuestionSnapshotOf<T>["config"];
};

const configFor = (type: QuestionTypeName, ids: IdSource) =>
  blankConfig[type](ids) as QuestionSnapshot["config"];

/**
 * Appends a blank question of `type` with a new question identity. Throws at the question cap, so
 * the builder disables adding there.
 */
export const addQuestion = (
  definition: FormDefinition,
  type: QuestionTypeName,
  ids: IdSource,
): FormDefinition => {
  if (definition.questions.length >= QUESTIONS_CAP)
    throw new RangeError(`A form has at most ${QUESTIONS_CAP} questions`);
  return {
    ...definition,
    questions: [
      ...definition.questions,
      {
        id: ids.questionId(),
        type,
        label: "",
        required: false,
        config: configFor(type, ids),
      } as QuestionSnapshot,
    ],
  };
};
