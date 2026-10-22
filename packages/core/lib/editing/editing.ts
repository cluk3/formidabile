import {
  QUESTIONS_CAP,
  questionsOf,
  type FormDefinition,
  type Page,
  type QuestionSnapshot,
  type QuestionSnapshotOf,
  type QuestionTypeName,
} from "../definition/form-definition.ts";
import { OPTIONS_CAP } from "../definition/types/choice-options.ts";

/**
 * Mints identifiers for the editing functions. Core has no `crypto`, so the builder supplies one
 * built on Web Crypto. Each question identity is a fresh UUID, each page id a fresh UUID, and each
 * option value a fresh opaque string, never derived from a label.
 */
export type IdSource = { questionId(): string; optionValue(): string; pageId(): string };

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
  number: () => ({ integer: false }),
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

const questionCount = (definition: FormDefinition) => questionsOf(definition).length;

/**
 * Replaces one question in place. The format, the pages, and the other questions stay. Throws when
 * the definition has no such question.
 */
export const replaceQuestion = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  replace: (question: QuestionSnapshot) => QuestionSnapshot,
): D => {
  if (definition.format === 1) {
    const index = definition.questions.findIndex((q) => q.id === questionId);
    if (index === -1) throw new RangeError(`No question ${questionId}`);
    return {
      ...definition,
      questions: definition.questions.with(index, replace(definition.questions[index]!)),
    } as D;
  }
  let found = false;
  const pages = definition.pages.map((page) => {
    const index = page.questions.findIndex((q) => q.id === questionId);
    if (index === -1) return page;
    found = true;
    return {
      ...page,
      questions: page.questions.with(index, replace(page.questions[index]!)),
    };
  });
  if (!found) throw new RangeError(`No question ${questionId}`);
  return { ...definition, pages } as D;
};

/**
 * Appends a blank question of `type` with a new question identity. On format 2 it goes at the end of
 * the last page. Throws at the question cap, so the builder disables adding there.
 */
export const addQuestion = <D extends FormDefinition>(
  definition: D,
  type: QuestionTypeName,
  ids: IdSource,
): D => {
  if (questionCount(definition) >= QUESTIONS_CAP)
    throw new RangeError(`A form has at most ${QUESTIONS_CAP} questions`);
  const question = newQuestion(type, { label: "", required: false }, [], ids);
  if (definition.format === 1)
    return { ...definition, questions: [...definition.questions, question] } as D;
  const last = definition.pages.length - 1;
  const page = definition.pages[last]!;
  return {
    ...definition,
    pages: definition.pages.with(last, { ...page, questions: [...page.questions, question] }),
  } as D;
};

/**
 * "Treat as a new question" (ADR 0009): the same content, position and option values under a new
 * question identity, so analytics stop combining it with the old one.
 */
export const reidentifyQuestion = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  ids: IdSource,
): D => replaceQuestion(definition, questionId, (q) => ({ ...q, id: ids.questionId() }));

/**
 * A question identity keeps one type for life (ADR 0005), so a new type means a new identity. The
 * label, description, required flag and position carry over, and so do the options between the
 * choice types; the rest of the config starts blank.
 */
export const changeQuestionType = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  type: QuestionTypeName,
  ids: IdSource,
): D => {
  const current = questionsOf(definition).find((q) => q.id === questionId);
  if (current === undefined) throw new RangeError(`No question ${questionId}`);
  if (current.type === type) return definition;
  return replaceQuestion(definition, questionId, ({ id: _id, type: _type, config, ...content }) =>
    newQuestion(type, content, "options" in config ? config.options : [], ids),
  );
};

/** Removes a question. Adding it back later mints a new identity, so analytics don't combine the two. */
export const removeQuestion = <D extends FormDefinition>(definition: D, questionId: string): D => {
  if (definition.format === 1) {
    const index = definition.questions.findIndex((q) => q.id === questionId);
    if (index === -1) throw new RangeError(`No question ${questionId}`);
    return { ...definition, questions: definition.questions.toSpliced(index, 1) } as D;
  }
  let found = false;
  const pages = definition.pages.map((page) => {
    const index = page.questions.findIndex((q) => q.id === questionId);
    if (index === -1) return page;
    found = true;
    return { ...page, questions: page.questions.toSpliced(index, 1) };
  });
  if (!found) throw new RangeError(`No question ${questionId}`);
  return { ...definition, pages } as D;
};

/** Moves a question to position `to` in display order. Identities and content are untouched. */
export const moveQuestion = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  to: number,
): D => {
  const questions = [...questionsOf(definition)];
  const from = questions.findIndex((q) => q.id === questionId);
  if (from === -1) throw new RangeError(`No question ${questionId}`);
  if (!Number.isInteger(to) || to < 0 || to >= questions.length)
    throw new RangeError(`No position ${to} among ${questions.length} questions`);
  const [question] = questions.splice(from, 1);
  questions.splice(to, 0, question!);
  if (definition.format === 1) return { ...definition, questions } as D;
  let offset = 0;
  const pages = definition.pages.map((page) => {
    const next = questions.slice(offset, offset + page.questions.length);
    offset += page.questions.length;
    return sameQuestions(page.questions, next) ? page : { ...page, questions: next };
  });
  return { ...definition, pages } as D;
};

const sameQuestions = (left: readonly QuestionSnapshot[], right: readonly QuestionSnapshot[]) =>
  left.length === right.length && left.every((q, i) => q === right[i]);

const replaceOptions = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  replace: (options: ChoiceOption[]) => ChoiceOption[],
): D =>
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
export const addOption = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  ids: IdSource,
): D =>
  replaceOptions(definition, questionId, (options) => {
    if (options.length >= OPTIONS_CAP)
      throw new RangeError(`A question has at most ${OPTIONS_CAP} options`);
    return optionsFrom(options, options.length + 1, ids);
  });

/** Removes a choice question's option. Re-adding it later mints a new value. */
export const removeOption = <D extends FormDefinition>(
  definition: D,
  questionId: string,
  value: string,
): D =>
  replaceOptions(definition, questionId, (options) => {
    const index = options.findIndex((option) => option.value === value);
    if (index === -1) throw new RangeError(`Question ${questionId} has no option ${value}`);
    return options.toSpliced(index, 1);
  });

/**
 * The format a draft is stored as after the builder saves it: one page, with a minted id, holding the
 * questions the draft already had. A format-2 definition is returned unchanged.
 */
export const upgradeToFormat2 = (
  definition: FormDefinition,
  ids: IdSource,
): Extract<FormDefinition, { format: 2 }> => {
  if (definition.format === 2) return definition;
  const page: Page = {
    id: ids.pageId(),
    questions: [...definition.questions],
    jumps: [],
  };
  return {
    format: 2,
    title: definition.title,
    ...(definition.description === undefined ? {} : { description: definition.description }),
    pages: [page],
  };
};
