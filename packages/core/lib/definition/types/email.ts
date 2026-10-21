import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

const snapshot = z.strictObject({
  ...base,
  type: z.literal("email"),
  config: z.strictObject({}),
});

export const email = {
  snapshot,
  answer: () => z.email().check(z.maxLength(254)),
  publishIssues: nonEmptyLabel,
  display: (_q, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
