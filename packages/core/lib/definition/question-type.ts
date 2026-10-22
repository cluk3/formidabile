import * as z from "zod/mini";
import { Condition } from "./condition.ts";

z.config(z.locales.en());

export type Issue = { path: (string | number)[]; message: string };
export type Result<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

export const toIssues = (error: z.core.$ZodError): Issue[] =>
  error.issues.map((issue) => ({
    path: issue.path.map((key) => (typeof key === "symbol" ? String(key) : key)),
    message: issue.message,
  }));

/**
 * One question type: its snapshot schema, the schema for one answer, its publish rules, and how an
 * answer reads back in a historical view. Adding a type is one module plus one registry entry.
 */
export type QuestionType<Q, A> = {
  snapshot: z.ZodMiniType<Q, unknown>;
  /** One answer to `q`, when answered. The caller applies optionality. */
  answer(q: Q): z.ZodMiniType<A, unknown>;
  /** Completeness rules beyond the snapshot schema. Paths are relative to the question. */
  publishIssues(q: Q): Issue[];
  display(q: Q, answer: A): string;
};

/** Trimmed text that may be empty while drafting. Caps count Unicode code points. */
export const DraftText = (max: number) => z.string().check(z.trim(), z.maxLength(max));

/** Fields every question snapshot shares. */
export const base = {
  /** Question identity: minted by the builder, kept across versions while the question keeps its meaning. */
  id: z.uuid(),
  label: DraftText(500),
  description: z.optional(DraftText(2000)),
  required: z.boolean(),
  /**
   * Show condition. Absent means the question is always shown once its page is reached. Format 1 snapshots
   * omit it. Whether the condition fits the question is a publish rule, not part of this shape.
   */
  showCondition: z.optional(Condition),
};

/** A `min` above `max` leaves no answer in between. */
export const rangeIssues = <T extends number | string>(
  min: T | undefined,
  max: T | undefined,
  maxKey = "max",
): Issue[] =>
  min !== undefined && max !== undefined && min > max
    ? [{ path: ["config", maxKey], message: "The minimum is greater than the maximum" }]
    : [];

export const nonEmptyLabel = (q: { label: string }): Issue[] =>
  q.label === ""
    ? [{ path: ["label"], message: "A question needs a label before publishing" }]
    : [];
