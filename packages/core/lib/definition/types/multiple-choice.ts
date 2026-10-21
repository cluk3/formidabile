import * as z from "zod/mini";
import {
  base,
  nonEmptyLabel,
  rangeIssues,
  type Issue,
  type QuestionType,
} from "../question-type.ts";
import {
  ChoiceOptions,
  OPTIONS_CAP,
  optionIssues,
  optionLabel,
  optionValue,
} from "./choice-options.ts";

const Count = z.int().check(z.gte(1), z.lte(OPTIONS_CAP));

const snapshot = z.strictObject({
  ...base,
  type: z.literal("multiple_choice"),
  config: z.strictObject({
    options: ChoiceOptions,
    minSelected: z.optional(Count),
    maxSelected: z.optional(Count),
  }),
});

export const multipleChoice = {
  snapshot,
  answer: (q) => {
    const { options, minSelected, maxSelected } = q.config;
    return z.array(optionValue(options)).check(
      z.minLength(minSelected ?? 1),
      z.maxLength(maxSelected ?? options.length),
      z.refine((values) => new Set(values).size === values.length, "An option was selected twice"),
    );
  },
  publishIssues: (q) => {
    const { options, minSelected, maxSelected } = q.config;
    const issues: Issue[] = [...nonEmptyLabel(q), ...optionIssues(options, 1)];
    for (const [key, count] of [
      ["minSelected", minSelected],
      ["maxSelected", maxSelected],
    ] as const)
      if (count !== undefined && count > options.length)
        issues.push({ path: ["config", key], message: "More than the number of options" });
    issues.push(...rangeIssues(minSelected, maxSelected, "maxSelected"));
    return issues;
  },
  display: (q, answer) => answer.map((value) => optionLabel(q.config.options, value)).join(", "),
} satisfies QuestionType<z.output<typeof snapshot>, string[]>;
