import * as z from "zod/mini";
import { base, nonEmptyLabel, rangeIssues, type QuestionType } from "../question-type.ts";

/** A start and an end, both `YYYY-MM-DD`, compared as strings so no time zone is involved. */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("date_range"),
  config: z.strictObject({
    min: z.optional(z.iso.date()),
    max: z.optional(z.iso.date()),
  }),
});

const day = (min: string | undefined, max: string | undefined) =>
  z.iso.date({ error: "Enter a date" }).check(
    z.refine((date) => min === undefined || date >= min, `Must be on or after ${min}`),
    z.refine((date) => max === undefined || date <= max, `Must be on or before ${max}`),
  );

export const dateRange = {
  snapshot,
  /** Both dates, or the answer is absent. A single day has the same start and end. */
  answer: (q) => {
    const { min, max } = q.config;
    return z
      .strictObject({ start: day(min, max), end: day(min, max) })
      .check(
        z.refine((range) => range.start <= range.end, "The start must be on or before the end"),
      );
  },
  publishIssues: (q) => [...nonEmptyLabel(q), ...rangeIssues(q.config.min, q.config.max)],
  display: (_q, answer) => `${answer.start} to ${answer.end}`,
} satisfies QuestionType<z.output<typeof snapshot>, { start: string; end: string }>;
