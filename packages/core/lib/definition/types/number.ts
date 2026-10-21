import * as z from "zod/mini";
import {
  base,
  nonEmptyLabel,
  rangeIssues,
  type Issue,
  type QuestionType,
} from "../question-type.ts";

const snapshot = z.strictObject({
  ...base,
  type: z.literal("number"),
  config: z.strictObject({
    integer: z.boolean(),
    min: z.optional(z.number()),
    max: z.optional(z.number()),
  }),
});

export const number = {
  snapshot,
  answer: (q) => {
    const { integer, min, max } = q.config;
    return (integer ? z.int() : z.number()).check(
      ...(min === undefined ? [] : [z.gte(min)]),
      ...(max === undefined ? [] : [z.lte(max)]),
    );
  },
  publishIssues: (q) => {
    const { integer, min, max } = q.config;
    const issues: Issue[] = [...nonEmptyLabel(q)];
    if (integer)
      for (const [key, bound] of [
        ["min", min],
        ["max", max],
      ] as const)
        if (bound !== undefined && !Number.isInteger(bound))
          issues.push({
            path: ["config", key],
            message: "Must be a whole number when only whole numbers are accepted",
          });
    issues.push(...rangeIssues(min, max));
    return issues;
  },
  display: (_q, answer) => String(answer),
} satisfies QuestionType<z.output<typeof snapshot>, number>;
