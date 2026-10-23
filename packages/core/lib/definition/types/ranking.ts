import * as z from "zod/mini";
import { RANKING_OPTIONS_MAX } from "../ranking-limit.ts";
import { base, nonEmptyLabel, type Issue, type QuestionType } from "../question-type.ts";
import { ChoiceOptions, optionIssues, optionLabel, optionValue } from "./choice-options.ts";

/** Publish needs at least two options. A draft may hold fewer while the editor is filling them in. */
const RANKING_OPTIONS_MIN = 2;

/**
 * A ranking answer lists every option value once, best first. Fewer than that is not an answer: an
 * optional ranking is the full permutation or absent. Starting from a displayed order would store an
 * untouched list as agreement, so the renderer begins unranked (ADR-018).
 */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("ranking"),
  config: z.strictObject({
    options: ChoiceOptions,
  }),
});

type Ranking = z.output<typeof snapshot>;

/** No option can be ranked twice, and nothing outside the question's options can appear. */
const permutation = (options: Ranking["config"]["options"]) => {
  if (options.length === 0)
    return z.array(z.string()).check(z.refine(() => false, "A ranking needs its options"));
  return z.array(optionValue(options)).check(
    z.length(options.length),
    z.refine((items) => new Set(items).size === items.length, "Rank each option once"),
  );
};

export const ranking = {
  snapshot,
  answer: (question) => permutation(question.config.options),
  publishIssues: (question) => {
    const issues: Issue[] = [
      ...nonEmptyLabel(question),
      ...optionIssues(question.config.options, RANKING_OPTIONS_MIN),
    ];
    if (question.config.options.length > RANKING_OPTIONS_MAX)
      issues.push({
        path: ["config", "options"],
        message: `A ranking has at most ${RANKING_OPTIONS_MAX} options`,
      });
    return issues;
  },
  display: (question, answer) =>
    answer.map((value) => optionLabel(question.config.options, value)).join(", "),
} satisfies QuestionType<Ranking, string[]>;
