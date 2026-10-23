import * as z from "zod/mini";
import { base, nonEmptyLabel, rangeIssues, type QuestionType } from "../question-type.ts";

/**
 * `HH:MM` on a 24-hour clock, with no seconds and no time zone, so two times compare as strings.
 * `precision: -1` is hours and minutes only.
 */
const clockTime = z.iso.time({ precision: -1 });

/** A time of day, with an optional window that cannot cross midnight. */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("time_of_day"),
  config: z.strictObject({
    earliest: z.optional(clockTime),
    latest: z.optional(clockTime),
  }),
});

export const timeOfDay = {
  snapshot,
  answer: (q) => {
    const { earliest, latest } = q.config;
    return clockTime.check(
      z.refine(
        (value) => earliest === undefined || value >= earliest,
        `Must be at or after ${earliest}`,
      ),
      z.refine(
        (value) => latest === undefined || value <= latest,
        `Must be at or before ${latest}`,
      ),
    );
  },
  publishIssues: (q) => [
    ...nonEmptyLabel(q),
    ...rangeIssues(q.config.earliest, q.config.latest, "latest"),
  ],
  display: (_q, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
