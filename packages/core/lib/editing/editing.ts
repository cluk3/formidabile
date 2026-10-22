import {
  QUESTIONS_CAP,
  type FormDefinition,
  type QuestionSnapshot,
  type QuestionSnapshotOf,
  type QuestionTypeName,
} from "../definition/form-definition.ts";
import { OPTIONS_CAP } from "../definition/types/choice-options.ts";

/**
 * Mints identifiers for the editing functions. Core has no `crypto`, so the builder supplies one
 * built on Web Crypto. Each question identity is a fresh UUID and each option value a fresh opaque
 * string, never derived from a label.
 */
export type IdSource = { questionId(): string; optionValue(): string };

type ChoiceOption = QuestionSnapshotOf<"single_choice">["config"]["options"][number];

/** `kept`, then blank options with minted values up to `atLeast`. */
const optionsFrom = (kept: readonly ChoiceOption[], atLeast: number, ids: IdSource) => [
  ...kept,
  ...Array.from({ length: Math.max(0, atLeast - kept.length) }, () => ({
    value: ids.optionValue(),
    label: "",
  })),
];

/**
 * A new question's config, keeping the options of a choice question it replaces. Choice questions
 * start with at least as many options as publish needs.
 */
const newConfig = {
  text: () => ({ display: "single_line" }),
  email: () => ({}),
  number: () => ({ integer: false, display: "input" }),
  date: () => ({}),
  single_choice: (kept, ids) => ({ options: optionsFrom(kept, 2, ids), display: "radio" }),
  multiple_choice: (kept, ids) => ({ options: optionsFrom(kept, 1, ids) }),
  boolean: () => ({}),
} satisfies {
  [T in QuestionTypeName]: (
    kept: readonly ChoiceOption[],
    ids: IdSource,
  ) => QuestionSnapshotOf<T>["config"];
};

const newQuestion = (
  type: QuestionTypeName,
  content: Pick<QuestionSnapshot, "label" | "description" | "required">,
  kept: readonly ChoiceOption[],
  ids: IdSource,
) =>
  ({
    id: ids.questionId(),
    type,
    ...content,
    config: newConfig[type](kept, ids),
  }) as QuestionSnapshot;

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
      newQuestion(type, { label: "", required: false }, [], ids),
    ],
  };
};

const indexOf = (definition: FormDefinition, questionId: string) => {
  const index = definition.questions.findIndex((q) => q.id === questionId);
  if (index === -1) throw new RangeError(`No question ${questionId}`);
  return index;
};

const replaceQuestion = (
  definition: FormDefinition,
  questionId: string,
  replace: (q: QuestionSnapshot) => QuestionSnapshot,
): FormDefinition => {
  const index = indexOf(definition, questionId);
  return {
    ...definition,
    questions: definition.questions.with(index, replace(definition.questions[index]!)),
  };
};

/**
 * "Treat as a new question" (ADR 0009): the same content, position and option values under a new
 * question identity, so analytics stop combining it with the old one.
 */
export const reidentifyQuestion = (
  definition: FormDefinition,
  questionId: string,
  ids: IdSource,
): FormDefinition =>
  replaceQuestion(definition, questionId, (q) => ({ ...q, id: ids.questionId() }));

/**
 * A question identity keeps one type for life (ADR 0005), so a new type means a new identity. The
 * label, description, required flag and position carry over, and so do the options between the
 * choice types; the rest of the config starts blank.
 */
export const changeQuestionType = (
  definition: FormDefinition,
  questionId: string,
  type: QuestionTypeName,
  ids: IdSource,
): FormDefinition => {
  if (definition.questions[indexOf(definition, questionId)]!.type === type) return definition;
  return replaceQuestion(definition, questionId, ({ id: _id, type: _type, config, ...content }) =>
    newQuestion(type, content, "options" in config ? config.options : [], ids),
  );
};

/** Removes a question. Adding it back later mints a new identity, so analytics don't combine the two. */
export const removeQuestion = (definition: FormDefinition, questionId: string): FormDefinition => ({
  ...definition,
  questions: definition.questions.toSpliced(indexOf(definition, questionId), 1),
});

/** Moves a question to position `to` in display order. Identities and content are untouched. */
export const moveQuestion = (
  definition: FormDefinition,
  questionId: string,
  to: number,
): FormDefinition => {
  const from = indexOf(definition, questionId);
  const { questions } = definition;
  if (!Number.isInteger(to) || to < 0 || to >= questions.length)
    throw new RangeError(`No position ${to} among ${questions.length} questions`);
  const rest = questions.toSpliced(from, 1);
  return { ...definition, questions: rest.toSpliced(to, 0, questions[from]!) };
};

const replaceOptions = (
  definition: FormDefinition,
  questionId: string,
  replace: (options: ChoiceOption[]) => ChoiceOption[],
): FormDefinition =>
  replaceQuestion(definition, questionId, (q) => {
    if (q.type !== "single_choice" && q.type !== "multiple_choice")
      throw new RangeError(`Question ${questionId} has no options`);
    return {
      ...q,
      config: { ...q.config, options: replace(q.config.options) },
    } as QuestionSnapshot;
  });

/**
 * Appends a blank option with a minted value to a choice question. Throws at the option cap, so the
 * builder disables adding there.
 */
export const addOption = (
  definition: FormDefinition,
  questionId: string,
  ids: IdSource,
): FormDefinition =>
  replaceOptions(definition, questionId, (options) => {
    if (options.length >= OPTIONS_CAP)
      throw new RangeError(`A question has at most ${OPTIONS_CAP} options`);
    return optionsFrom(options, options.length + 1, ids);
  });

/** Removes a choice question's option. Re-adding it later mints a new value. */
export const removeOption = (
  definition: FormDefinition,
  questionId: string,
  value: string,
): FormDefinition =>
  replaceOptions(definition, questionId, (options) => {
    const index = options.findIndex((option) => option.value === value);
    if (index === -1) throw new RangeError(`Question ${questionId} has no option ${value}`);
    return options.toSpliced(index, 1);
  });
