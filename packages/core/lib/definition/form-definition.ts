import * as z from "zod/mini";
import { Condition, conditionCount, CONDITIONS_CAP } from "./condition.ts";
import { conditionIssues } from "./condition-issues.ts";
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
import { multipleChoice } from "./types/multiple-choice.ts";
import { number } from "./types/number.ts";
import { singleChoice } from "./types/single-choice.ts";
import { text } from "./types/text.ts";
import { ranking } from "./types/ranking.ts";

export const QuestionSnapshot = z.discriminatedUnion("type", [
  text.snapshot,
  email.snapshot,
  number.snapshot,
  date.snapshot,
  singleChoice.snapshot,
  multipleChoice.snapshot,
  boolean.snapshot,
  ranking.snapshot,
]);
export type QuestionSnapshot = z.output<typeof QuestionSnapshot>;
export type QuestionTypeName = QuestionSnapshot["type"];

export const QUESTIONS_CAP = 200;
/** ADR-017. A definition is at most this many pages. */
export const PAGES_CAP = 50;
/** ADR-017. One page is at most this many jumps. */
export const JUMPS_CAP = 20;

/** A jump's target: a page id in this definition, or the end of the form. */
export const JumpTarget = z.union([z.uuid(), z.literal("end")]);
export type JumpTarget = z.output<typeof JumpTarget>;

/** One forward jump. The condition's meaning is checked at publish, not on read. */
export const Jump = z.strictObject({
  condition: Condition,
  target: JumpTarget,
});
export type Jump = z.output<typeof Jump>;

const questionList = z.array(QuestionSnapshot).check(z.maxLength(QUESTIONS_CAP));

const Page = z.strictObject({
  id: z.uuid(),
  title: z.optional(DraftText(200)),
  description: z.optional(DraftText(5000)),
  /** Array order is display order on the page. */
  questions: questionList,
  /** Empty while the page has no jumps. Order is the order they are checked. */
  jumps: z.array(Jump).check(z.maxLength(JUMPS_CAP)),
});
export type Page = z.output<typeof Page>;

const titleAndDescription = {
  title: DraftText(200),
  description: z.optional(DraftText(5000)),
};

/** Format 1: one flat question list. Readers treat it as a single page. */
const Format1 = z.strictObject({
  /** Published versions are never rewritten, so readers accept every format ever written. */
  format: z.literal(1),
  ...titleAndDescription,
  /** Array order is display order. */
  questions: questionList,
});

/** Format 2: an ordered, non-empty list of pages. */
const Format2 = z.strictObject({
  format: z.literal(2),
  ...titleAndDescription,
  pages: z.array(Page).check(z.minLength(1), z.maxLength(PAGES_CAP)),
});

/** The content of a draft and of a form version: the same type for both. */
export const FormDefinition = z.discriminatedUnion("format", [Format1, Format2]).check(
  z.superRefine((definition, ctx) => {
    if (definition.format === 1) {
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
    } else {
      const pageIds = new Set<string>();
      const questionIds = new Set<string>();
      let count = 0;
      definition.pages.forEach((page, p) => {
        if (pageIds.has(page.id))
          ctx.issues.push({
            code: "custom",
            input: page.id,
            path: ["pages", p, "id"],
            message: "Duplicate page id",
          });
        pageIds.add(page.id);
        page.questions.forEach((q, i) => {
          count += 1;
          if (questionIds.has(q.id))
            ctx.issues.push({
              code: "custom",
              input: q.id,
              path: ["pages", p, "questions", i, "id"],
              message: "Duplicate question identity",
            });
          questionIds.add(q.id);
        });
      });
      if (count > QUESTIONS_CAP)
        ctx.issues.push({
          code: "custom",
          input: count,
          path: ["pages"],
          message: `A form has at most ${QUESTIONS_CAP} questions`,
        });
    }
    const conditions = countConditions(definition);
    if (conditions > CONDITIONS_CAP)
      ctx.issues.push({
        code: "custom",
        input: conditions,
        path: definition.format === 1 ? ["questions"] : ["pages"],
        message: `A form has at most ${CONDITIONS_CAP} conditions`,
      });
  }),
);

const countConditions = (
  definition: z.output<typeof Format1> | z.output<typeof Format2>,
): number => {
  const leaves = (condition: Condition | undefined) =>
    condition === undefined ? 0 : conditionCount(condition);
  if (definition.format === 1)
    return definition.questions.reduce((sum, question) => sum + leaves(question.showCondition), 0);
  return definition.pages.reduce(
    (sum, page) =>
      sum +
      page.questions.reduce((inner, question) => inner + leaves(question.showCondition), 0) +
      page.jumps.reduce((inner, jump) => inner + leaves(jump.condition), 0),
    0,
  );
};
export type FormDefinition = z.output<typeof FormDefinition>;

/**
 * A definition read as pages. Format 1 is one page whose id is null: that id is not stored, and the page has
 * no jumps. Show conditions are whatever the question snapshots already carried; reading adds none.
 */
export type PageView = {
  readonly id: string | null;
  readonly title?: string;
  readonly description?: string;
  readonly questions: readonly QuestionSnapshot[];
  readonly jumps: readonly Jump[];
};

/** Every definition as ordered pages. Format 1 is one page. */
export const pagesOf = (definition: FormDefinition): readonly PageView[] =>
  definition.format === 1
    ? [{ id: null, questions: definition.questions, jumps: [] }]
    : definition.pages;

/** Questions in display order, across every page. */
export const questionsOf = (definition: FormDefinition): readonly QuestionSnapshot[] =>
  definition.format === 1
    ? definition.questions
    : definition.pages.flatMap((page) => page.questions);

/**
 * Draft save, and reading any stored definition back: structure only. Publish rules are never re-run
 * on read, so tightening them never makes a stored version unreadable. Reading does not change the format.
 */
export const parseDefinition = (input: unknown): Result<FormDefinition> => {
  const result = FormDefinition.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: toIssues(result.error) };
};

export type QuestionSnapshotOf<T extends QuestionTypeName> = Extract<QuestionSnapshot, { type: T }>;

/** Every question type's module, keyed by its type name. */
export const questionTypes = {
  text,
  email,
  number,
  date,
  single_choice: singleChoice,
  multiple_choice: multipleChoice,
  boolean,
  ranking,
} satisfies {
  [T in QuestionTypeName]: QuestionType<QuestionSnapshotOf<T>, unknown>;
};

export const moduleOf = (q: QuestionSnapshot) =>
  questionTypes[q.type] as QuestionType<QuestionSnapshot, unknown>;

const questionIssues = (
  q: QuestionSnapshot,
  path: (string | number)[],
  earlierType: ReadonlyMap<string, QuestionTypeName>,
): Issue[] => {
  const issues: Issue[] = [];
  for (const issue of moduleOf(q).publishIssues(q))
    issues.push({ ...issue, path: [...path, ...issue.path] });
  const was = earlierType.get(q.id);
  if (was !== undefined && was !== q.type)
    issues.push({
      path: [...path, "type"],
      message: `This question was "${was}" in an earlier version; a different type needs a new question identity`,
    });
  return issues;
};

/**
 * Publish: the structural rules, then completeness and the form's history, reporting every problem at
 * once. A definition that passes has no question that rejects every answer. An empty page is rejected;
 * a draft may still hold one.
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

  const earlierType = new Map<string, QuestionTypeName>();
  for (const version of priorVersions)
    for (const q of questionsOf(version)) earlierType.set(q.id, q.type);

  if (definition.format === 1) {
    if (definition.questions.length === 0)
      issues.push({ path: ["questions"], message: "A form needs at least one question" });
    definition.questions.forEach((q, i) => {
      issues.push(...questionIssues(q, ["questions", i], earlierType));
    });
  } else {
    definition.pages.forEach((page, p) => {
      if (page.questions.length === 0)
        issues.push({
          path: ["pages", p, "questions"],
          message: "A page needs at least one question before publishing",
        });
      page.questions.forEach((q, i) => {
        issues.push(...questionIssues(q, ["pages", p, "questions", i], earlierType));
      });
    });
  }
  issues.push(...conditionIssues(definition));
  return issues.length === 0 ? { ok: true, value: definition } : { ok: false, issues };
};
