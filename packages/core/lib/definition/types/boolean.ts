import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

/**
 * A yes/no answer. `mustBeYes` is the consent constraint: the answer must be `true`, and the question
 * is required wherever it is asked. Without it, the respondent picks yes or no, because an unticked
 * checkbox cannot tell no from unanswered.
 */
const snapshot = z
  .strictObject({
    ...base,
    type: z.literal("boolean"),
    config: z.strictObject({
      mustBeYes: z.optional(z.boolean()),
    }),
  })
  .check(
    z.superRefine((question, ctx) => {
      if (question.config.mustBeYes === true && !question.required)
        ctx.issues.push({
          code: "custom",
          input: question.required,
          path: ["required"],
          message: "A question that must be yes is required",
        });
    }),
  );

export const boolean = {
  snapshot,
  answer: (question) => (question.config.mustBeYes === true ? z.literal(true) : z.boolean()),
  publishIssues: nonEmptyLabel,
  display: (_question, answer) => (answer ? "Yes" : "No"),
} satisfies QuestionType<z.output<typeof snapshot>, boolean>;
