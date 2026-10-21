import * as z from "zod/mini";
import { base, nonEmptyLabel, rangeIssues, type QuestionType } from "../question-type.ts";

/** Calendar dates (`YYYY-MM-DD`) with no time or time zone, so they compare as strings. */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("date"),
  config: z.strictObject({
    min: z.optional(z.iso.date()),
    max: z.optional(z.iso.date()),
  }),
});

export const date = {
  snapshot,
  answer: (q) => {
    const { min, max } = q.config;
    return z.iso.date().check(
      z.refine((d) => min === undefined || d >= min, `Must be on or after ${min}`),
      z.refine((d) => max === undefined || d <= max, `Must be on or before ${max}`),
    );
  },
  publishIssues: (q) => [...nonEmptyLabel(q), ...rangeIssues(q.config.min, q.config.max)],
  display: (_q, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
