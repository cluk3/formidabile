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
