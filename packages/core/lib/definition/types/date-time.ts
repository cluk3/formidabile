import * as z from "zod/mini";
import { base, nonEmptyLabel, rangeIssues, type QuestionType } from "../question-type.ts";

/**
 * Zod's calendar-date pattern (`z.iso.date`), without the surrounding anchors.
 * `z.iso.datetime({ local: true, precision: -1 })` still accepts a trailing `Z`, so a date and time
 * is this date plus a 24-hour minute: local wall-clock `YYYY-MM-DDTHH:MM`, no seconds and no zone.
 */
const CALENDAR_DATE = String.raw`(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))`;

const LOCAL_DATE_TIME = new RegExp(`^${CALENDAR_DATE}T(?:[01]\\d|2[0-3]):[0-5]\\d$`);

/** A local `YYYY-MM-DDTHH:MM`: a real calendar day and a 24-hour minute, with no zone and no seconds. */
export const isLocalDateTime = (value: unknown): value is string =>
  typeof value === "string" && LOCAL_DATE_TIME.test(value);

const localDateTime = z.string().check(z.regex(LOCAL_DATE_TIME));

/** Local wall-clock date and time. It compares as text, the way a calendar date does. */
const snapshot = z.strictObject({
  ...base,
  type: z.literal("date_time"),
  config: z.strictObject({
    min: z.optional(localDateTime),
    max: z.optional(localDateTime),
  }),
});

export const dateTime = {
  snapshot,
  answer: (q) => {
    const { min, max } = q.config;
    return localDateTime.check(
      z.refine((value) => min === undefined || value >= min, `Must be at or after ${min}`),
      z.refine((value) => max === undefined || value <= max, `Must be at or before ${max}`),
    );
  },
  publishIssues: (q) => [...nonEmptyLabel(q), ...rangeIssues(q.config.min, q.config.max)],
  display: (_q, answer) => answer,
} satisfies QuestionType<z.output<typeof snapshot>, string>;
