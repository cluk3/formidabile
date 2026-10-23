import * as z from "zod/mini";
import { base, nonEmptyLabel, type QuestionType } from "../question-type.ts";

/** ADR-018. Counted in Unicode code points, after trim. */
const URL_CAP = 2_048;

/**
 * `protocol` must be this pattern for Zod to require `://`. `normalize: false` stores the trimmed
 * text rather than the parser's canonical form. A non-empty host includes localhost and an IP.
 * The URL check would also delete tabs and newlines, so a value it would rewrite is rejected.
 */
const httpUrl = z.url({
  protocol: /^https?$/,
  hostname: /.+/,
  normalize: false,
});

const snapshot = z.strictObject({
  ...base,
  type: z.literal("url"),
  config: z.strictObject({}),
});

const storedAsTyped = (value: string) => {
  const parsed = httpUrl.safeParse(value);
  return parsed.success && parsed.data === value;
};

export const url = {
  snapshot,
  answer: () =>
    z
      .string()
      .check(z.trim(), z.maxLength(URL_CAP), z.refine(storedAsTyped, { error: "Invalid URL" })),
  publishIssues: nonEmptyLabel,
  display: (_question, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
