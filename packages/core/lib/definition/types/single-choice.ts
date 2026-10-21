import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";
import { ChoiceOptions, optionIssues, optionLabel, optionValue } from "./choice-options.ts";

const snapshot = z.strictObject({
  ...base,
  type: z.literal("single_choice"),
  config: z.strictObject({
    options: ChoiceOptions,
    /** Presentation only: switching keeps the question identity and its analytics. */
    display: z.enum(["radio", "dropdown"]),
  }),
});

export const singleChoice = {
  snapshot,
  answer: (q) => optionValue(q.config.options),
  publishIssues: (q) => [...nonEmptyLabel(q), ...optionIssues(q.config.options, 2)],
  display: (q, answer) => optionLabel(q.config.options, answer),
} satisfies QuestionType<z.output<typeof snapshot>, string>;
