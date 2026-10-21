import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

/** A yes/no answer. Required means the respondent must pick one; there is no "must be checked" mode. */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("boolean"),
  config: z.strictObject({}),
});

export const boolean = {
  snapshot,
  answer: () => z.boolean(),
  publishIssues: nonEmptyLabel,
  display: (_q, answer) => (answer ? "Yes" : "No"),
} satisfies QuestionType<z.output<typeof snapshot>, boolean>;
