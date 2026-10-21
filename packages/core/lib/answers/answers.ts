import * as z from "zod/mini";
import {
  moduleOf,
  type FormDefinition,
  type QuestionSnapshot,
} from "../definition/form-definition.ts";
import { toIssues, type Result } from "../definition/question-type.ts";

/**
 * Any version's answers: keyed by question identity, with untagged values. Documents the request
 * body; only the version's own schema says whether the answers are valid.
 */
export const AnyAnswers = z.record(
  z.uuid(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
);
export type Answers = z.output<typeof AnyAnswers>;

/**
 * The strict schema for one version's answers. An unanswered optional question has no key. Built on
 * every call: nothing caches it per version.
 */
export const buildAnswerSchema = (definition: FormDefinition): z.ZodMiniType<Answers, unknown> =>
  z.strictObject(
    Object.fromEntries(
      definition.questions.map((q) => {
        const answer = moduleOf(q).answer(q);
        return [q.id, q.required ? answer : z.exactOptional(answer)];
      }),
    ),
  ) as z.ZodMiniType<Answers, unknown>;

export const validateAnswers = (definition: FormDefinition, input: unknown): Result<Answers> => {
  const result = buildAnswerSchema(definition).safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: toIssues(result.error) };
};

export type InterpretedAnswer = {
  question: QuestionSnapshot;
  /** Absent when the respondent skipped the question. */
  answer?: { value: Answers[string]; display: string };
};

/**
 * Historical view (ADR 0001 §8.1): a response read through its own version's snapshots, in that
 * version's order. `answers` must have passed that version's schema.
 */
export const interpretAnswers = (
  definition: FormDefinition,
  answers: Answers,
): InterpretedAnswer[] =>
  definition.questions.map((question) => {
    const value = answers[question.id];
    return value === undefined
      ? { question }
      : { question, answer: { value, display: moduleOf(question).display(question, value) } };
  });
