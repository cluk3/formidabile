import { validateAnswers, type Answers } from "@fb/core/answers";
import type { FormDefinition, Issue, QuestionTypeName } from "@fb/core/definition";

/** What each type's input holds while the respondent works on it: `undefined` until first touched. */
type Drafts = {
  text: string;
  email: string;
  number: string;
  date: string;
  single_choice: string;
  multiple_choice: string[];
  boolean: boolean;
};
export type DraftOf<T extends QuestionTypeName> = Drafts[T] | undefined;
export type Draft = DraftOf<QuestionTypeName>;

type Answer = Answers[string];

const unlessBlank = (draft: string | undefined) =>
  draft === undefined || draft.trim() === "" ? undefined : draft;

/** The answer an input's draft stands for, or `undefined` while the question is unanswered. */
const answerOf = {
  text: unlessBlank,
  email: unlessBlank,
  number: (draft) => (unlessBlank(draft) === undefined ? undefined : Number(draft)),
  date: unlessBlank,
  single_choice: unlessBlank,
  multiple_choice: (draft) => (draft === undefined || draft.length === 0 ? undefined : draft),
  boolean: (draft) => draft,
} satisfies { [T in QuestionTypeName]: (draft: DraftOf<T>) => Answer | undefined };

const stringDraft = (answer: Answer) => (typeof answer === "string" ? answer : undefined);

/** The draft that shows a stored answer, or `undefined` if the answer doesn't fit the question's type. */
const draftOf = {
  text: stringDraft,
  email: stringDraft,
  number: (answer) => (typeof answer === "number" ? String(answer) : undefined),
  date: stringDraft,
  single_choice: stringDraft,
  multiple_choice: (answer) => (Array.isArray(answer) ? [...answer] : undefined),
  boolean: (answer) => (typeof answer === "boolean" ? answer : undefined),
} satisfies { [T in QuestionTypeName]: (answer: Answer) => DraftOf<T> };

/** The drafts that show a response's stored answers, for editing it. */
export const draftsOf = (
  definition: FormDefinition,
  answers: Readonly<Record<string, Answer>>,
): Record<string, Draft> => {
  const drafts: Record<string, Draft> = {};
  for (const question of definition.questions) {
    const answer = answers[question.id];
    if (answer !== undefined) drafts[question.id] = draftOf[question.type](answer);
  }
  return drafts;
};

export const unanswered = "Answer this question";

/** Each question's first problem, keyed by question identity. Issues about the whole body are dropped. */
export const questionErrors = (issues: readonly Issue[]): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const { path, message } of issues) {
    const [key] = path;
    if (typeof key === "string" && !(key in errors)) errors[key] = message;
  }
  return errors;
};

export type Checked =
  | { readonly ok: true; readonly answers: Answers }
  | { readonly ok: false; readonly errors: Record<string, string> };

/**
 * The answers to send, validated by the version's own answer schema, or each invalid question's message. An
 * unanswered optional question has no key.
 */
export const checkDrafts = (
  definition: FormDefinition,
  drafts: Readonly<Record<string, Draft>>,
): Checked => {
  const answers: Answers = {};
  const missing: Record<string, string> = {};
  for (const question of definition.questions) {
    const answer = (answerOf[question.type] as (draft: Draft) => Answer | undefined)(
      drafts[question.id],
    );
    if (answer !== undefined) answers[question.id] = answer;
    else if (question.required) missing[question.id] = unanswered;
  }
  const result = validateAnswers(definition, answers);
  if (result.ok && Object.keys(missing).length === 0) return { ok: true, answers: result.value };
  return { ok: false, errors: { ...(result.ok ? {} : questionErrors(result.issues)), ...missing } };
};
