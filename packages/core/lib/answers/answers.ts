import * as z from "zod/mini";
import {
  moduleOf,
  questionsOf,
  type FormDefinition,
  type PageView,
  type QuestionSnapshot,
} from "../definition/form-definition.ts";
import { toIssues, type Result } from "../definition/question-type.ts";
import {
  nextDestination as nextPage,
  pathFromInput,
  pathOf as questionsOnPath,
  type FormPath,
  type NextDestination,
} from "./path.ts";

/**
 * Any version's answers: keyed by question identity, with untagged values. Documents the request
 * body; only the version's own schema says whether the answers are valid.
 */
export const AnyAnswers = z.record(
  z.uuid(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
);
export type Answers = z.output<typeof AnyAnswers>;

const schemaFor = (questions: readonly QuestionSnapshot[]): z.ZodMiniType<Answers, unknown> =>
  z.strictObject(
    Object.fromEntries(
      questions.map((q) => {
        const answer = moduleOf(q).answer(q);
        return [q.id, q.required ? answer : z.exactOptional(answer)];
      }),
    ),
  ) as z.ZodMiniType<Answers, unknown>;

/**
 * The strict schema for one version's answers. An unanswered optional question has no key. Built on
 * every call: nothing caches it per version. This is the whole version; {@link validateAnswers}
 * builds the same shape from the questions on the path only.
 */
export const buildAnswerSchema = (definition: FormDefinition): z.ZodMiniType<Answers, unknown> =>
  schemaFor(questionsOf(definition));

/**
 * The answers to the questions on the path. A required question off the path is not demanded, and an
 * answer for a question off the path is rejected. `required` applies only on the path, including a
 * question that must be yes.
 */
/** The pages reached and the questions shown for these answers. Pure, and total on a broken draft. */
export const pathOf = (definition: FormDefinition, answers: Answers): FormPath =>
  questionsOnPath(definition, answers);

/** Where Next goes from `page`: the next page that still has a question on the path, or the end. */
export const nextDestination = (
  definition: FormDefinition,
  answers: Answers,
  page: PageView,
): NextDestination => nextPage(definition, answers, page);

export type { FormPath, NextDestination };

export const validateAnswers = (definition: FormDefinition, input: unknown): Result<Answers> => {
  const result = schemaFor(pathFromInput(definition, input).questions).safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: toIssues(result.error) };
};

export type AnswerStatus = "answered" | "skipped" | "not_shown";

export type InterpretedAnswer = {
  question: QuestionSnapshot;
  /** `skipped` is on the stored path with no answer; `not_shown` was off that path. */
  status: AnswerStatus;
  /** Present when `status` is `answered`. */
  answer?: { value: Answers[string]; display: string };
};

/**
 * Historical view (ADR 0001 §8.1, ADR-017): a response read through its own version's snapshots, in
 * that version's order. `shown` is the path stored with the response, not a path recomputed from
 * `answers`. A response collected before conditions existed lists every question of its version.
 */
export const interpretAnswers = (
  definition: FormDefinition,
  answers: Answers,
  shown: readonly string[],
): InterpretedAnswer[] => {
  const onPath = new Set(shown);
  return questionsOf(definition).map((question) => {
    if (!onPath.has(question.id)) return { question, status: "not_shown" };
    const value = answers[question.id];
    return value === undefined
      ? { question, status: "skipped" }
      : {
          question,
          status: "answered",
          answer: { value, display: moduleOf(question).display(question, value) },
        };
  });
};
