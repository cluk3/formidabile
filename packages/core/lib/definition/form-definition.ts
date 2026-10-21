import * as z from "zod/mini";
import {
  DraftText,
  toIssues,
  type Issue,
  type QuestionType,
  type Result,
} from "./question-type.ts";
import { boolean } from "./types/boolean.ts";
import { date } from "./types/date.ts";
import { email } from "./types/email.ts";
import { number } from "./types/number.ts";
import { text } from "./types/text.ts";

export const QuestionSnapshot = z.discriminatedUnion("type", [
  text.snapshot,
  email.snapshot,
  number.snapshot,
  date.snapshot,
  boolean.snapshot,
]);
export type QuestionSnapshot = z.output<typeof QuestionSnapshot>;
export type QuestionTypeName = QuestionSnapshot["type"];

/** The content of a draft and of a form version: the same type for both. */
export const FormDefinition = z
  .strictObject({
    /** Published versions are never rewritten, so readers accept every format ever written. */
    format: z.literal(1),
    title: DraftText(200),
    description: z.optional(DraftText(5000)),
    /** Array order is display order. */
    questions: z.array(QuestionSnapshot).check(z.maxLength(200)),
  })
  .check(
    z.superRefine((definition, ctx) => {
      const ids = new Set<string>();
      definition.questions.forEach((q, i) => {
        if (ids.has(q.id))
          ctx.issues.push({
            code: "custom",
            input: q.id,
            path: ["questions", i, "id"],
            message: "Duplicate question identity",
          });
        ids.add(q.id);
      });
    }),
  );
export type FormDefinition = z.output<typeof FormDefinition>;

/**
 * Draft save, and reading any stored definition back: structure only. Publish rules are never re-run
 * on read, so tightening them never makes a stored version unreadable.
 */
export const parseDefinition = (input: unknown): Result<FormDefinition> => {
  const result = FormDefinition.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: toIssues(result.error) };
};

export type QuestionSnapshotOf<T extends QuestionTypeName> = Extract<QuestionSnapshot, { type: T }>;

/** Every question type's module, keyed by its type name. */
export const questionTypes = { text, email, number, date, boolean } satisfies {
  [T in QuestionTypeName]: QuestionType<QuestionSnapshotOf<T>, unknown>;
};

const moduleOf = (q: QuestionSnapshot) =>
  questionTypes[q.type] as QuestionType<QuestionSnapshot, unknown>;

/**
 * Publish: the structural rules, then completeness and the form's history, reporting every problem at
 * once. A definition that passes has no question that rejects every answer.
 */
export const validateForPublish = (
  input: unknown,
  priorVersions: readonly FormDefinition[],
): Result<FormDefinition> => {
  const parsed = parseDefinition(input);
  if (!parsed.ok) return parsed;
  const definition = parsed.value;
  const issues: Issue[] = [];
  if (definition.title === "")
    issues.push({ path: ["title"], message: "A form needs a title before publishing" });
  if (definition.questions.length === 0)
    issues.push({ path: ["questions"], message: "A form needs at least one question" });

  const earlierType = new Map<string, QuestionTypeName>();
  for (const version of priorVersions)
    for (const q of version.questions) earlierType.set(q.id, q.type);

  definition.questions.forEach((q, i) => {
    for (const issue of moduleOf(q).publishIssues(q))
      issues.push({ ...issue, path: ["questions", i, ...issue.path] });
    const was = earlierType.get(q.id);
    if (was !== undefined && was !== q.type)
      issues.push({
        path: ["questions", i, "type"],
        message: `This question was "${was}" in an earlier version; a different type needs a new question identity`,
      });
  });
  return issues.length === 0 ? { ok: true, value: definition } : { ok: false, issues };
};
