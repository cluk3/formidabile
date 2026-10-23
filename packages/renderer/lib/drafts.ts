import { pathOf, validateAnswers, type Answers } from "@fb/core/answers";
import {
  questionsOf,
  type FormDefinition,
  type Issue,
  type QuestionSnapshot,
  type QuestionTypeName,
} from "@fb/core/definition";

/** What each type's input holds while the respondent works on it: `undefined` until first touched. */
type Drafts = {
  text: string;
  email: string;
  number: string;
  date: string;
  single_choice: string;
  multiple_choice: string[];
  boolean: boolean;
  time_of_day: string;
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
  time_of_day: unlessBlank,
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
  time_of_day: stringDraft,
} satisfies { [T in QuestionTypeName]: (answer: Answer) => DraftOf<T> };

/** The drafts that show a response's stored answers, for editing it. */
export const draftsOf = (
  definition: FormDefinition,
  answers: Readonly<Record<string, Answer>>,
): Record<string, Draft> => {
  const drafts: Record<string, Draft> = {};
  for (const question of questionsOf(definition)) {
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

/** The answers the current drafts stand for, including invalid ones. An unanswered question has no key. */
export const answersFromDrafts = (
  definition: FormDefinition,
  drafts: Readonly<Record<string, Draft>>,
): Answers => {
  const answers: Answers = {};
  for (const question of questionsOf(definition)) {
    const answer = (answerOf[question.type] as (draft: Draft) => Answer | undefined)(
      drafts[question.id],
    );
    if (answer !== undefined) answers[question.id] = answer;
  }
  return answers;
};

/**
 * The answers to send. A question off the path is left out, and a required question off the path is not
 * demanded. An unanswered optional question on the path has no key.
 */
export const checkDrafts = (
  definition: FormDefinition,
  drafts: Readonly<Record<string, Draft>>,
): Checked => {
  const all = answersFromDrafts(definition, drafts);
  const questions = pathOf(definition, all).questions;
  const answers: Answers = {};
  for (const question of questions) {
    const answer = all[question.id];
    if (answer !== undefined) answers[question.id] = answer;
  }
  const missing: Record<string, string> = {};
  for (const question of questions)
    if (answers[question.id] === undefined && question.required) missing[question.id] = unanswered;
  const result = validateAnswers(definition, answers);
  if (result.ok && Object.keys(missing).length === 0) return { ok: true, answers: result.value };
  return { ok: false, errors: { ...(result.ok ? {} : questionErrors(result.issues)), ...missing } };
};

const checkedPageId = "00000000-0000-4000-8000-00000000c000";

const withoutShowCondition = (question: QuestionSnapshot): QuestionSnapshot => {
  if (question.showCondition === undefined) return question;
  const { showCondition: _showCondition, ...rest } = question;
  return rest;
};

/**
 * Next checks the questions on the path on this page. The path is decided from the whole definition, so a
 * condition can read an earlier page, and a required question on another page is not demanded yet.
 */
export const checkPage = (
  definition: FormDefinition,
  drafts: Readonly<Record<string, Draft>>,
  questions: readonly QuestionSnapshot[],
): Checked => {
  const onPath = new Set(
    pathOf(definition, answersFromDrafts(definition, drafts)).questions.map(
      (question) => question.id,
    ),
  );
  return checkDrafts(
    {
      format: 2,
      title: definition.title,
      ...(definition.description === undefined ? {} : { description: definition.description }),
      pages: [
        {
          id: checkedPageId,
          questions: questions
            .filter((question) => onPath.has(question.id))
            .map(withoutShowCondition),
          jumps: [],
        },
      ],
    },
    drafts,
  );
};
