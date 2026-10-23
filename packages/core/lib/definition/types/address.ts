import * as z from "zod/mini";
import { countryCodes } from "../countries.ts";
import { base, nonEmptyLabel, type Issue, type QuestionType } from "../question-type.ts";

/** The six fixed lines, in the order an address is read back. */
export const addressLines = ["line1", "line2", "city", "region", "postalCode", "country"] as const;
export type AddressLine = (typeof addressLines)[number];

/** A filled line is at most this many Unicode code points. */
const LINE_CAP = 200;

const lineSetting = z.strictObject({
  shown: z.boolean(),
  required: z.boolean(),
});

const snapshot = z.strictObject({
  ...base,
  type: z.literal("address"),
  config: z.strictObject({
    lines: z.strictObject({
      line1: lineSetting,
      line2: lineSetting,
      city: lineSetting,
      region: lineSetting,
      postalCode: lineSetting,
      country: lineSetting,
    }),
  }),
});

type AddressQuestion = z.output<typeof snapshot>;

/** Only the lines the respondent filled. Hidden lines are not keys. */
export type AddressAnswer = { [K in AddressLine]?: string };

const textLine = z.string().check(z.trim(), z.minLength(1), z.maxLength(LINE_CAP), z.regex(/\S/));
const countryLine = z.enum(countryCodes);

/**
 * The answered object. A required line is a required key; an optional line may be omitted. An empty
 * object is not an answer: the caller leaves the question key out instead.
 */
const answerSchema = (question: AddressQuestion): z.ZodMiniType<AddressAnswer, unknown> => {
  const shape: Record<string, z.ZodMiniType> = {};
  for (const line of addressLines) {
    const setting = question.config.lines[line];
    if (!setting.shown) continue;
    const value = line === "country" ? countryLine : textLine;
    shape[line] = setting.required ? value : z.optional(value);
  }
  return z
    .strictObject(shape)
    .check(
      z.refine(
        (value: AddressAnswer) => addressLines.some((line) => value[line] !== undefined),
        "Fill in at least one line",
      ),
    ) as z.ZodMiniType<AddressAnswer, unknown>;
};

export const address = {
  snapshot,
  answer: answerSchema,
  publishIssues: (question): Issue[] => [
    ...nonEmptyLabel(question),
    ...(addressLines.some((line) => question.config.lines[line].shown)
      ? []
      : [{ path: ["config", "lines"], message: "Show at least one line" }]),
  ],
  display: (_question, answer) =>
    addressLines
      .flatMap((line) => {
        const value = answer[line];
        return value === undefined ? [] : [value];
      })
      .join(", "),
} satisfies QuestionType<AddressQuestion, AddressAnswer>;
