import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

/**
 * Spaces, dashes, dots, and parentheses a respondent may type. Stripped before the check, so the
 * browser and the server store the same E.164 number (ADR-018). There is no default country.
 */
const PHONE_PUNCTUATION = /[ ().-]/g;

/** `+` and 1 to 15 digits. The advisory answer schema repeats this pattern. */
const E164 = /^\+[0-9]{1,15}$/;

const COUNTRY_CODE = "Include a country code, starting with +";
const DIGITS = "Use + followed by at most 15 digits";

const stripPhoneFormatting = (value: string): string => value.replace(PHONE_PUNCTUATION, "");

const normalized = (value: unknown): string | undefined =>
  typeof value === "string" ? stripPhoneFormatting(value) : undefined;

/** Both sides are stripped, so a condition can route on a country code typed with punctuation. */
const phoneIs =
  (compare: (answer: string, constant: string) => boolean) =>
  (answer: unknown, constant: unknown): boolean => {
    const left = normalized(answer);
    const right = normalized(constant);
    return left !== undefined && right !== undefined && compare(left, right);
  };

export const phoneOperators = [
  {
    id: "equals",
    constant: "string" as const,
    matches: phoneIs((answer, constant) => answer === constant),
  },
  {
    id: "does_not_equal",
    constant: "string" as const,
    matches: phoneIs((answer, constant) => answer !== constant),
  },
  {
    id: "starts_with",
    constant: "string" as const,
    matches: phoneIs((answer, constant) => answer.startsWith(constant)),
  },
  {
    id: "does_not_start_with",
    constant: "string" as const,
    matches: phoneIs((answer, constant) => !answer.startsWith(constant)),
  },
];

const snapshot = z.strictObject({
  ...base,
  type: z.literal("phone"),
  config: z.strictObject({}),
});

export const phone = {
  snapshot,
  answer: () =>
    z.string().check(
      z.overwrite(stripPhoneFormatting),
      z.refine((value) => value.startsWith("+"), { error: COUNTRY_CODE, abort: true }),
      z.regex(E164, DIGITS),
    ),
  publishIssues: nonEmptyLabel,
  display: (_question, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
