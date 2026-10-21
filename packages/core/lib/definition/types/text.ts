import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

const TEXT_CAP = 10_000;

const snapshot = z.strictObject({
  ...base,
  type: z.literal("text"),
  config: z.strictObject({
    maxLength: z.optional(z.int().check(z.gte(1), z.lte(TEXT_CAP))),
    /** Presentation only, like the single-choice display. */
    display: z.enum(["single_line", "multi_line"]),
  }),
});

type Text = z.output<typeof snapshot>;

export const text = {
  snapshot,
  answer: (q) =>
    z.string().check(z.trim(), z.minLength(1), z.maxLength(q.config.maxLength ?? TEXT_CAP)),
  publishIssues: nonEmptyLabel,
  display: (_q, answer) => answer,
} satisfies QuestionType<Text, string>;
